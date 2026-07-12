/* article-ai-chat-patch.js v20260712-7
   v7: Auto-reset chat history when article changes.
*/

(function () {

  'use strict';

  var MODEL_KEY = 'notebook_gemini_model_v1';
  var LAST_WORKING_MODEL_KEY = 'notebook_gemini_last_working_model';

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

  function cleanMarkdown(text) {

    if (!text) return text;

    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/(?<![*])\*([^*\n]+)\*(?![*])/g, '$1')
      .replace(/(?<![_])_([^_\n]+)_(?![_])/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^-{3,}$/gm, '')
      .replace(/^={3,}$/gm, '');
  }

  function getPreferredModel() {
    return localStorage.getItem(MODEL_KEY) ||
           localStorage.getItem(LAST_WORKING_MODEL_KEY) ||
           MODEL_LIST[0];
  }

  function saveWorkingModel(model) {
    localStorage.setItem(LAST_WORKING_MODEL_KEY, model);
  }

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

    var selectors = [
      '.card .en',
      '.card article',
      '.card .content',
      '.card-body',
      '.article-body',
      '.article',
      '.en'
    ];

    var article = null;
    var foundSelector = null;

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && (el.innerText || '').trim().length > 20) {
        article = el;
        foundSelector = selectors[i];
        break;
      }
    }

    if (!article) {
      log('no article found');
      return '';
    }

    var clone = article.cloneNode(true);
    clone.querySelectorAll('button, script').forEach(function (el) { el.remove(); });

    return (clone.innerText || clone.textContent || '').trim();
  }

  // 生成文章 hash（用於偵測文章變更）
  function articleHash(text) {
    if (!text) return '';
    // 用前 100 字元和長度作為簡易 hash
    return text.slice(0, 100).replace(/\s+/g, '') + '_len_' + text.length;
  }

  var chatHistory = [];
  var currentArticleHash = '';   // 記錄當前對話的文章 hash

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  async function callGeminiWithKeyAndModel(userMessage, key, model) {

    var article = getArticleText();
    var newHash = articleHash(article);

    // 如果文章變了，自動重置 chatHistory
    if (chatHistory.length > 0 && currentArticleHash && currentArticleHash !== newHash) {
      log('article changed, resetting chat history');
      chatHistory = [];
      currentArticleHash = '';

      // 通知使用者
      var chatBody = document.getElementById('aiChatBody');
      if (chatBody) {
        var notice = document.createElement('div');
        notice.style.cssText = 'color: #a68a56; padding: 8px; font-size: 12px; text-align: center; background: rgba(166, 138, 86, 0.1); border-radius: 4px; margin-bottom: 10px;';
        notice.textContent = '📄 已切換文章，對話已重置';
        chatBody.appendChild(notice);
      }
    }

    var contents = [];

    if (chatHistory.length === 0) {

      currentArticleHash = newHash;

      if (!article) {
        contents.push({
          role: 'user',
          parts: [{
            text:
              '請用繁體中文回答，簡潔明瞭。\n\n' +
              '重要規則：\n' +
              '1. 輸出純文字，不要使用任何 Markdown 語法\n' +
              '2. 不要用 **, __, *, #, [], 等符號\n' +
              '3. 需要強調時用引號「」或全形括號（）\n' +
              '4. 需要列表時用 1. 2. 3.\n\n' +
              '注意：由於目前沒有可用的文章內容，你可以進行一般英文學習相關的討論。\n\n' +
              '請確認你已理解規則。'
          }]
        });
        contents.push({
          role: 'model',
          parts: [{
            text: '好的，我會用純文字回答。請問你有什麼問題？'
          }]
        });
      } else {
        contents.push({
          role: 'user',
          parts: [{
            text:
              '以下是一篇英文文章，接下來我會針對這篇文章問你問題。\n\n' +
              '請用繁體中文回答，簡潔明瞭。\n\n' +
              '重要規則：\n' +
              '1. 輸出純文字，不要使用任何 Markdown 語法\n' +
              '2. 不要用 **, __, *, #, [], 等符號\n' +
              '3. 需要強調時用引號「」或全形括號（）\n' +
              '4. 需要列表時用 1. 2. 3. 或 、 、 、\n' +
              '5. 單字直接以純文字呈現，不做粗體或斜體標記\n\n' +
              '文章：\n' + article +
              '\n\n請確認你已理解這篇文章與規則。'
          }]
        });
        contents.push({
          role: 'model',
          parts: [{
            text: '好的，我已經閱讀了這篇文章，並會用純文字回答，不使用任何 Markdown 符號。請問你有什麼問題？'
          }]
        });
      }
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
      err.key = key;
      throw err;
    }

    var data = await res.json();
    var reply = data.candidates?.[0]?.content?.parts?.map(function (p) { return p.text; }).join('\n') || '';

    if (!reply) throw new Error('AI 沒有回應');

    reply = cleanMarkdown(reply);

    return reply;
  }

  async function callGeminiWithAutoSwitch(userMessage, statusCallback) {

    var keys;
    if (typeof window.getGeminiKeys === 'function') {
      keys = window.getGeminiKeys();
    } else {
      var single = localStorage.getItem('notebook_gemini_key_v1');
      keys = single ? [single] : [];
    }

    if (keys.length === 0) {
      throw new Error('請先在設定選單設定 Gemini API Key');
    }

    var models = buildAttemptOrder();
    var errors = [];

    for (var ki = 0; ki < keys.length; ki++) {

      var key = keys[ki];

      if (typeof window.getGeminiKeyStatus === 'function') {
        var statuses = window.getGeminiKeyStatus();
        var status = statuses.find(function (s) { return s.keyFull === key; });
        if (status && !status.available) {
          log('skip key (cooldown):', key.slice(0, 10) + '...');
          continue;
        }
      }

      for (var mi = 0; mi < models.length; mi++) {

        var model = models[mi];

        if (statusCallback) {
          var keyLabel = 'Key ' + (ki + 1) + '/' + keys.length;
          statusCallback('🤖 ' + keyLabel + ' + ' + model + '...');
        }

        try {

          log('trying key', ki + 1, 'model:', model);

          var reply = await callGeminiWithKeyAndModel(userMessage, key, model);

          log('success with model:', model);
          saveWorkingModel(model);

          if (typeof window.markGeminiKeyOk === 'function') {
            window.markGeminiKeyOk(key);
          }

          chatHistory.push({ role: 'user', text: userMessage });
          chatHistory.push({ role: 'model', text: reply });

          return { reply: reply, model: model, keyIndex: ki };

        } catch (e) {

          errors.push({ 
            keyIndex: ki,
            model: model, 
            status: e.status
          });

          if (e.status === 429) {
            log('429 for key', ki + 1, 'model:', model);

            if (typeof window.markGeminiKey429 === 'function') {
              window.markGeminiKey429(key);
            }

            break;
          }

          if (e.status === 404) {
            log('404 model not found:', model);
            continue;
          }

          if (e.status >= 500 && e.status < 600) {
            await sleep(1000);
            continue;
          }

          throw e;
        }
      }
    }

    var summary = 'Keys 嘗試: ' + keys.length + '個，Models 嘗試: ' + models.length + '個\n';
    summary += '失敗次數: ' + errors.length + '\n';

    var errorTypes = {};
    errors.forEach(function (e) {
      var type = 'HTTP ' + e.status;
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });

    Object.keys(errorTypes).forEach(function (type) {
      summary += '  ' + type + ': ' + errorTypes[type] + ' 次\n';
    });

    throw new Error(
      '⚠️ 所有 API Key 和模型都限額用完\n\n' + summary +
      '\n建議：\n' +
      '1. 等 60 秒讓限額重置\n' +
      '2. 加入更多 API Key\n' +
      '3. 或升級到付費層'
    );
  }

  function appendMessage(role, text, meta) {

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

      var metaBadge = '';
      if (meta) {
        var parts = [];
        if (meta.model) parts.push(meta.model);
        if (typeof meta.keyIndex === 'number') parts.push('K' + (meta.keyIndex + 1));
        if (parts.length > 0) {
          metaBadge = '<span style="background: #d9cfbc; color: #666; padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-left: 6px;">' + parts.join(' · ') + '</span>';
        }
      }

      msg.innerHTML = '<div style="font-weight: bold; margin-bottom: 4px; color: #a68a56;">🤖 AI ' + metaBadge + '</div>' + escapeHtml(text).replace(/\n/g, '<br>');
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
    currentArticleHash = '';
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
          '<button id="aiChatKeysBtn" style="padding: 5px 10px; background: transparent; border: 1px solid #aaa; border-radius: 4px; cursor: pointer; font-size: 12px;">🔑 Keys</button>' +
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
            '<span style="color: #a68a56;">系統會自動切換 API Key 和模型</span>' +
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

    document.getElementById('aiChatKeysBtn').onclick = function () {
      if (typeof window.openGeminiKeyManager === 'function') {
        window.openGeminiKeyManager();
      } else {
        alert('請先加載 gemini-multi-key-patch.js');
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
          appendMessage('ai', result.reply, {
            model: result.model,
            keyIndex: result.keyIndex
          });
        }

      } catch (e) {
        loading.remove();
        appendMessage('ai', e.message);
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

    // 打開對話時檢查文章是否變更
    var article = getArticleText();
    var newHash = articleHash(article);

    if (chatHistory.length > 0 && currentArticleHash && currentArticleHash !== newHash) {
      log('article changed on open, resetting');
      clearHistory();
    }

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

  log('ready v20260712-7');

})();
