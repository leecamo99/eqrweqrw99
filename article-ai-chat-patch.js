/* article-ai-chat-patch.js v20260712-1
   Chat with AI about current article. Uses Gemini API.
*/

(function () {

  'use strict';

  var API_KEY_STORAGE = 'notebook_gemini_key_v1';   // 用 v2 patch 相同的 key
  var MODEL_KEY = 'notebook_gemini_model_v1';
  var DEFAULT_MODEL = 'gemini-2.5-flash';

  function log() {
    try {
      console.log.apply(console, ['[AIChat]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  }

  function getModel() {
    return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
  }

  function getArticleText() {

    var article = document.querySelector('.card .en');
    if (!article) return '';

    var clone = article.cloneNode(true);
    clone.querySelectorAll('button, script').forEach(function (el) { el.remove(); });

    return (clone.innerText || clone.textContent || '').trim();
  }

  var chatHistory = [];

  async function callGemini(userMessage) {

    var key = getKey();
    if (!key) {
      alert('請先在設定選單設定 Gemini API Key');
      return null;
    }

    var article = getArticleText();

    // 建立 messages，包含 system context 和歷史
    var contents = [];

    // 第一次對話時，加入文章 context
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
          text: '好的，我已經閱讀了這篇文章。請問你有什麼問題？我可以協助你解釋單字、討論文法、分析主題或做任何相關的討論。'
        }]
      });
    }

    // 加入歷史對話
    chatHistory.forEach(function (msg) {
      contents.push({
        role: msg.role,
        parts: [{ text: msg.text }]
      });
    });

    // 加入新的使用者訊息
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    var model = getModel();
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';

    try {

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
        log('API error:', errText);
        return '⚠️ API 錯誤：' + res.status + '\n' + errText.slice(0, 200);
      }

      var data = await res.json();
      var reply = data.candidates?.[0]?.content?.parts?.map(function (p) { return p.text; }).join('\n') || '';

      if (!reply) return '⚠️ AI 沒有回應';

      // 更新歷史
      chatHistory.push({ role: 'user', text: userMessage });
      chatHistory.push({ role: 'model', text: reply });

      return reply;

    } catch (e) {
      log('err:', e);
      return '⚠️ 錯誤：' + e.message;
    }
  }

  function appendMessage(role, text) {

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
      msg.innerHTML = '<div style="font-weight: bold; margin-bottom: 4px; color: #a68a56;">🤖 AI</div>' + escapeHtml(text).replace(/\n/g, '<br>');
    }

    chatBody.appendChild(msg);

    // 自動滾動到底
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
            '例如：解釋 "overtime"、造 3 個句子、翻譯這段、討論主題' +
          '</div>' +
        '</div>' +

        '<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; flex-shrink: 0;">' +
          '<button class="quickQ" data-q="請解釋這篇文章的重點主題" style="padding: 5px 10px; background: #e0d5b7; color: #333; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">📖 解釋主題</button>' +
          '<button class="quickQ" data-q="這篇文章有哪些難的單字？請解釋" style="padding: 5px 10px; background: #e0d5b7; color: #333; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">🔤 難字解釋</button>' +
          '<button class="quickQ" data-q="請翻譯這篇文章成繁體中文" style="padding: 5px 10px; background: #e0d5b7; color: #333; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">🌏 翻譯</button>' +
          '<button class="quickQ" data-q="請根據文章出 5 題閱讀理解問題" style="padding: 5px 10px; background: #e0d5b7; color: #333; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">❓ 出題</button>' +
          '<button class="quickQ" data-q="請簡化這篇文章成初級英文" style="padding: 5px 10px; background: #e0d5b7; color: #333; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">📝 簡化</button>' +
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

    // 綁定關閉
    document.getElementById('aiChatCloseBtn').onclick = function () {
      modal.style.display = 'none';
    };

    // 綁定清空
    document.getElementById('aiChatClearBtn').onclick = function () {
      if (confirm('確定清空對話？')) {
        clearHistory();
      }
    };

    // 綁定送出
    var sendMessage = async function () {

      var input = document.getElementById('aiChatInput');
      var text = input.value.trim();

      if (!text) return;

      var sendBtn = document.getElementById('aiChatSendBtn');

      appendMessage('user', text);
      input.value = '';

      // 顯示 AI 正在思考
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
        var reply = await callGemini(text);

        loading.remove();

        if (reply) {
          appendMessage('ai', reply);
        }
      } catch (e) {
        loading.remove();
        appendMessage('ai', '⚠️ 錯誤：' + e.message);
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = '送出';
        input.focus();
      }
    };

    document.getElementById('aiChatSendBtn').onclick = sendMessage;

    // Enter 送出
    document.getElementById('aiChatInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // 快速問題
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

    // 聚焦輸入框
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

  log('ready v20260712-1');

})();
