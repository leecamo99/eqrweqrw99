/* article-ai-chat-patch.js v20260712-3
   v3: Auto try multiple models if 429.
*/

(function () {

  'use strict';

  var API_KEY_STORAGE = 'notebook_gemini_key_v1';
  var MODEL_KEY = 'notebook_gemini_model_v1';
  var LAST_WORKING_MODEL_KEY = 'notebook_gemini_last_working_model';

  // 模型嘗試順序（每分鐘 RPM 由大到小）
  var MODEL_LIST = [
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3-pro-preview'
];

  function log() {
    try {
      console.log.apply(console, ['[AIChat]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  }

  function getPreferredModel() {
    // 使用者手動設定的 > 上次成功的 > 清單第一個
    return localStorage.getItem(MODEL_KEY) ||
           localStorage.getItem(LAST_WORKING_MODEL_KEY) ||
           MODEL_LIST[0];
  }

  function saveWorkingModel(model) {
    localStorage.setItem(LAST_WORKING_MODEL_KEY, model);
  }

  // 建立嘗試順序：從偏好模型開始，然後試其他
  function buildAttemptOrder() {

    var preferred = getPreferredModel();
    var order = [preferred];

    MODEL_LIST.forEach(function (m) {
      if (order.indexOf(m) === -1) {
        order.push(m);
      }
    });

    return order;
  }

  function getArticleText() {

    var article = document.querySelector('.card .en');
    if (!article) return '';

    var clone = article.cloneNode(true);
    clone.querySelectorAll('button, script').forEach(function (el) { el.remove(); });

    return (clone.innerText || clone.textContent || '').trim();
  }

  var chatHistory = [];

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  async function callGeminiWithModel(userMessage, model) {

    var key = getKey();
    if (!key) {
      throw new Error('請先在設定選單設定 Gemini API Key');
    }

    var article = getArticleText();
    var contents = [];

    if (chatHistory.length === 0) {
      contents.push({
        role: 'user',
        parts: [{
          text:
            '以下是一篇英文文章，接下來我會針對這篇文章問你問題。請用繁體中文回答，簡潔明瞭。\n\n' +
            '文章：\n' + article +
            '\n\n請確認你已理解這篇文章。'
        }]
      });
      contents.push({
        role: 'model',
        parts: [{
          text: '好的，我已經閱讀了這篇文章。請問你有什麼問題？'
        }]
      });
    }

    chatHistory.forEach(function (msg) {
      contents.push({
        role: msg.role,
        parts: [{ text: msg.text }]
      });
    });

    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';

    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });

    if (!res.ok) {
      var errText = await res.text();
      var err = new Error('API ' + res.status);
      err.status = res.status;
      err.body = errText;
      err.model = model;
      throw err;
    }

    var data = await res.json();
    var reply = data.candidates?.[0]?.content?.parts?.map(function (p) { return p.text; }).join('\n') || '';

    if (!reply) throw new Error('AI 沒有回應');

    return reply;
  }

  async function callGeminiWithAutoSwitch(userMessage, statusCallback) {

    var attemptOrder = buildAttemptOrder();
    var errors = [];

    for (var i = 0; i < attemptOrder.length; i++) {

      var model = attemptOrder[i];

      if (statusCallback) {
        if (i === 0) {
          statusCallback('🤖 使用 ' + model + ' 中...');
        } else {
          statusCallback('⚠️ 上一個模型限額，改用 ' + model + '...');
        }
      }

      try {

        log('trying model:', model);

        var reply = await callGeminiWithModel(userMessage, model);

        // 成功
        log('success with model:', model);
        saveWorkingModel(model);

        // 更新歷史
        chatHistory.push({ role: 'user', text: userMessage });
        chatHistory.push({ role: 'model', text: reply });

        return { reply: reply, model: model };

      } catch (e) {

        errors.push({ model: model, status: e.status, message: e.message });

        // 429 或 404 才切換模型（403 API key 錯不切換）
        if (e.status === 429) {
          log('429 rate limit for', model, ', trying next...');
          continue;
        }

        if (e.status === 404) {
          log('404 model not found:', model, ', trying next...');
          continue;
        }

        // 500 系列可能是暫時錯誤，等等再切
        if (e.status >= 500 && e.status < 600) {
          log('5xx error for', model, ', trying next...');
          await sleep(1000);
          continue;
        }

        // 其他錯誤（401, 403）直接拋出
        throw e;
      }
    }

    // 所有模型都失敗
    var errorSummary = errors.map(function (e) {
      return e.model + ' (' + e.status + ')';
    }).join(', ');

    throw new Error(
      '所有模型都限額用完：\n' + errorSummary + '\n\n' +
      '建議：\n' +
      '1. 等 60 秒讓限額重置\n' +
      '2. 或升級到付費層'
    );
  }

  function appendMessage(role, text, modelUsed) {

    var chatBody = document.getElementById('aiChatBody');
    if (!chatBody) return;

    var msg = document.createElement('div');
    msg.style.cssText = ''
      + 'margin-bottom: 12px;'
      + 'padding: 10px 12px;'
      + 'border-radius: 8px;'
      + 'font-size: 13px;'
      + 'line-height: 1.6;'
      + 'word-wrap: break-word;';

    if (role === 'user') {
      msg.style.background = '#e8dfc7';
      msg.style.color = '#333';
      msg.style.marginLeft = '30px';
      msg.innerHTML = '<div style="font-weight: bold; margin-bottom: 4px; color: #7a6547;">你</div>' + escapeHtml(text);
    } else {
      msg.style.background = '#faf6ed';
      msg.style.color = '#333';
      msg.style.marginRight = '30px';
      msg.style.border = '1px solid #d9cfbc';

      var modelBadge = modelUsed ? 
        '<span style="background: #d9cfbc; color: #666; padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-left: 6px;">' + modelUsed + '</span>' : 
        '';

      msg.innerHTML = '<div style="font-weight: bold; margin-bottom: 4px; color: #a68a56;">🤖 AI ' + modelBadge + '</div>' + escapeHtml(text).replace(/\n/g, '<br>');
    }

    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function escapeHtml(text) {
    return text.replace(/[<>&"']/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clearHistory() {
    chatHistory = [];
    var chatBody = document.getElementById('aiChatBody');
    if (chatBody) chatBody.innerHTML = '<div style="color: #999; text-align: center; padding: 20px; font-size: 12px;">對話已清空</div>';
  }

  function ensureModal() {

    if (document.getElementById('aiChatModal')) return;

    var modal = document.createElement('div');
    modal.id = 'aiChatModal';

    modal.style.cssText = ''
      + 'position: fixed;'
      + 'inset: 0;'
      + 'background: rgba(0,0,0,0.5);'
      + 'z-index: 99985;'
      + 'display: none;'
      + 'padding: 18px;'
      + 'padding-bottom: 200px;'
      + 'font-family: Segoe UI, Microsoft JhengHei, sans-serif;';

    modal.innerHTML =
      '<div style="' +
        'max-width: 700px;' +
        'margin: 0 auto;' +
        'background: #f8f7f2;' +
        'border-radius: 10px;' +
        'padding: 16px;' +
        'box-shadow: 0 14px 38px rgba(0,0,0,0.35);' +
        'height: calc(100vh - 220px);' +
        'display: flex;' +
        'flex-direction: column;' +
      '">' +

        '<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-shrink: 0;">' +
          '<h2 style="flex: 1; margin: 0; font-size: 18px;">💬 與 AI 討論文章</h2>' +
          '<button id="aiChatClearBtn" style="padding: 5px 10px; background: transparent; border: 1px solid #aaa; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️ 清空</button>' +
          '<button id="aiChatCloseBtn" style="padding: 5px 10px; background: transparent; border: 1px solid #aaa; border-radius: 4px; cursor: pointer; font-size: 12px;">Close</button>' +
        '</div>' +

        '<div id="aiChatBody" style="' +
          'flex: 1;' +
          'overflow-y: auto;' +
          'padding: 10px;' +
          'background: white;' +
          'border: 1px solid #d9cfbc;' +
          'border-radius: 8px;' +
          'margin-bottom: 10px;' +
        '">' +
          '<div style="color: #999; text-align: center; padding: 20px; font-size: 12px;">' +
            '請問任何關於這篇文章的問題...<br>' +
            '例如：解釋 "overtime"、造 3 個句子、翻譯這段、討論主題<br><br>' +
            '<span style="color: #a68a56;">系統會自動選擇最合適的 Gemini 模型</span>' +
          '</div>' +
        '</div>' +

        '<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; flex-shrink: 0;">' +
          '<button class="quickQ" data-q="請解釋這篇文章的重點主題" style="padding: 5px 10px; background: #e0d5b7; color: #333; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">📖 解釋主題</button>' +
          '<button class="quickQ" data-q="這篇文章有哪些難的單字？請解釋" style="padding: 5px 10px; background: #e0d5b7; color: #333; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">🔤 難字解釋</button>' +
          '<button class="quickQ" data-q="請翻譯這篇文章成繁體中文" style="padding: 5px 10px; background: #e0d5b7; color: #333; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">🌏 翻譯</button>' +
          '<button class="quickQ" data-q="請根據文章出 5 題閱讀理解問題" style="padding: 5px 10px; background: #e0d5b7; color: #333; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">❓ 出題</button>' +
        '</div>' +

        '<div style="display: flex; gap: 6px; flex-shrink: 0;">' +
          '<input type="text" id="aiChatInput" placeholder="問任何問題..." style="' +
            'flex: 1;' +
            'padding: 10px 12px;' +
            'border: 1px solid #ccc;' +
            'border-radius: 6px;' +
            'font-size: 13px;' +
          '">' +
          '<button id="aiChatSendBtn" style="' +
            'padding: 10px 20px;' +
            'background: #2f6f9f;' +
            'color: white;' +
            'border: none;' +
            'border-radius: 6px;' +
            'cursor: pointer;' +
            'font-weight: bold;' +
          '">送出</button>' +
        '</div>' +

      '</div>';

    document.body.appendChild(modal);

    document.getElementById('aiChatCloseBtn').onclick = function () {
      modal.style.display = 'none';
    };

    document.getElementById('aiChatClearBtn').onclick = function () {
      if (confirm('確定清空對話？')) {
        clearHistory();
      }
    };

    var sendMessage = async function () {

      var input = document.getElementById('aiChatInput');
      var text = input.value.trim();

      if (!text) return;

      var sendBtn = document.getElementById('aiChatSendBtn');

      appendMessage('user', text);
      input.value = '';

      var chatBody = document.getElementById('aiChatBody');
      var loading = document.createElement('div');
      loading.id = 'aiChatLoading';
      loading.style.cssText = 'color: #a68a56; padding: 10px; font-size: 12px; text-align: center;';
      loading.textContent = '🤖 AI 思考中...';
      chatBody.appendChild(loading);
      chatBody.scrollTop = chatBody.scrollHeight;

      sendBtn.disabled = true;
      sendBtn.textContent = '思考中...';

      try {

        var result = await callGeminiWithAutoSwitch(text, function (status) {
          loading.textContent = status;
          chatBody.scrollTop = chatBody.scrollHeight;
        });

        loading.remove();

        if (result && result.reply) {
          appendMessage('ai', result.reply, result.model);
        }

      } catch (e) {
        loading.remove();
        appendMessage('ai', '⚠️ ' + e.message);
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = '送出';
        input.focus();
      }
    };

    document.getElementById('aiChatSendBtn').onclick = sendMessage;

    document.getElementById('aiChatInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    modal.querySelectorAll('.quickQ').forEach(function (btn) {
      btn.onclick = function () {
        document.getElementById('aiChatInput').value = this.dataset.q;
        sendMessage();
      };
    });

    log('modal created');
  }

  function openChat() {
    ensureModal();
    var modal = document.getElementById('aiChatModal');
    modal.style.display = 'block';

    setTimeout(function () {
      var input = document.getElementById('aiChatInput');
      if (input) input.focus();
    }, 100);
  }

  function addChatButton() {

    if (document.getElementById('aiChatBtn')) return;

    var editBtn = document.getElementById('articleEditBtn');
    if (!editBtn) return;

    var chatBtn = document.createElement('button');
    chatBtn.id = 'aiChatBtn';
    chatBtn.textContent = '💬 與 AI 討論';
    chatBtn.style.cssText = ''
      + 'padding: 5px 10px;'
      + 'background: transparent;'
      + 'color: #2f6f9f;'
      + 'border: 1px solid #2f6f9f;'
      + 'border-radius: 3px;'
      + 'cursor: pointer;'
      + 'font-size: 12px;'
      + 'margin-left: 8px;';

    chatBtn.onclick = openChat;

    editBtn.parentNode.insertBefore(chatBtn, editBtn.nextSibling);

    log('chat button added');
  }

  function startWatchdog() {
    setInterval(function () {
      addChatButton();
    }, 1000);
  }

  addChatButton();
  startWatchdog();

  window.openAIChat = openChat;

  log('ready v20260712-3');

})();
