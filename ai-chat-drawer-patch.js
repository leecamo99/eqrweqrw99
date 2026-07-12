/* ai-chat-drawer-patch.js  v20260713-1
   ChatGPT 風格 AI 對話介面

   功能：
   1) 右下角 💬 按鈕開啟右側抽屜
   2) 5 個預設角色 + 自訂 prompt
   3) 對話清單 + 新對話 + 改名 + 刪除
   4) 自動存檔（每則訊息即時存）
   5) 智慧摘要壓縮（訊息 > 20 則自動摘要）
   6) 開啟時自動載入最後對話
   7) 手機 RWD
   8) 用 Gemini API (讀 notebook_gemini_keys_v1 / notebook_gemini_api_key_v1)
*/
(function () {
  'use strict';
  var TAG = '[AIChatDrawer]';
  var VER = 'v20260713-1';
  var STORAGE_KEY = 'notebook_ai_chats_v1';
  var MODEL_FALLBACK = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3-flash-preview'];

  // 5 個預設角色
  var ROLES = {
    english_tutor: {
      name: '📚 英語學習助教',
      prompt: '你是專業的繁體中文英語家教。幫學生解釋文法、單字、寫作。用繁體中文回答，簡潔清楚，多舉 TOEIC 商務例句。'
    },
    writing_coach: {
      name: '✍️ 英文寫作教練',
      prompt: '你是英文寫作教練。修改我的英文句子並解釋為什麼改，指出用字/文法錯誤與更自然的說法。回答用繁體中文。'
    },
    translator: {
      name: '🈶 翻譯專家',
      prompt: '你是雙語翻譯專家。中英互譯，保留原意、語氣自然、優先商務/正式風格。只輸出翻譯，不要多餘解釋。'
    },
    toeic: {
      name: '🎯 TOEIC 出題官',
      prompt: '你是 TOEIC 出題老師。給我一題 Part 5/6/7 難度的題目讓我做，答完後用繁體中文解析。'
    },
    free: {
      name: '💬 自由對話',
      prompt: ''
    }
  };

  // ---- 資料層 ----
  function loadData() {
    try {
      var d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!d.chats) d.chats = {};
      return d;
    } catch (e) { return { chats: {} }; }
  }
  function saveData(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
    catch (e) { console.error(TAG, e); }
  }

  function newChatId() { return 'chat_' + Date.now(); }
  function todayTitle() {
    var d = new Date();
    return (d.getMonth()+1) + '/' + d.getDate() + ' ' + 
           String(d.getHours()).padStart(2,'0') + ':' + 
           String(d.getMinutes()).padStart(2,'0');
  }

  function getKeys() {
    var raw = localStorage.getItem('notebook_gemini_keys_v1') || 
              localStorage.getItem('notebook_gemini_api_key_v1') || '';
    var keys = [];
    if (raw.trim().charAt(0) === '[') {
      try {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) arr.forEach(function (k) { if (k) keys.push(String(k).trim()); });
      } catch (e) {}
    } else {
      raw.split(/[\n,;]+/).forEach(function (k) { k = k.trim(); if (k) keys.push(k); });
    }
    var seen = {}, valid = [];
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('AIza') === 0 && !seen[keys[i]]) {
        seen[keys[i]] = 1;
        valid.push(keys[i]);
      }
    }
    return valid;
  }

  // ---- Gemini 呼叫 ----
  async function callGeminiChat(messages, systemPrompt) {
    var keys = getKeys();
    if (!keys.length) throw new Error('沒有 API key');

    // 建立 contents 陣列（Gemini 格式）
    var contents = [];
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
      contents.push({ role: 'model', parts: [{ text: '好，我明白了，請開始對話。' }] });
    }
    for (var i = 0; i < messages.length; i++) {
      contents.push({
        role: messages[i].role === 'user' ? 'user' : 'model',
        parts: [{ text: messages[i].content }]
      });
    }

    var lastErr = null;
    for (var ki = 0; ki < keys.length; ki++) {
      for (var mi = 0; mi < MODEL_FALLBACK.length; mi++) {
        var model = MODEL_FALLBACK[mi];
        try {
          var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
          var res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': keys[ki]
            },
            body: JSON.stringify({
              contents: contents,
              generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
            })
          });
          if (res.status === 429) { lastErr = 'Rate limit'; continue; }
          if (res.status === 404) { lastErr = 'Model not found'; continue; }
          if (!res.ok) { lastErr = 'HTTP ' + res.status; continue; }
          var data = await res.json();
          var text = data && data.candidates && data.candidates[0] && 
                     data.candidates[0].content && data.candidates[0].content.parts && 
                     data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
          if (text) {
            console.log(TAG, '✅ 用 ' + model);
            return text;
          }
        } catch (e) { lastErr = e.message; }
      }
    }
    throw new Error(lastErr || '全部失敗');
  }

  // ---- 智慧摘要 ----
  async function summarizeIfNeeded(chat) {
    if (!chat || !chat.messages || chat.messages.length <= 20) return chat;
    if (chat.summarized) return chat;  // 已摘要過就跳過

    console.log(TAG, '📝 訊息 ' + chat.messages.length + ' 則，開始摘要前 15 則');
    var toSummarize = chat.messages.slice(0, 15);
    var summaryPrompt = '請用繁體中文簡潔摘要以下對話（150 字內），保留關鍵資訊：\n\n' +
      toSummarize.map(function (m) {
        return (m.role === 'user' ? '使用者' : 'AI') + '：' + m.content;
      }).join('\n\n');

    try {
      var summary = await callGeminiChat(
        [{ role: 'user', content: summaryPrompt }],
        ''
      );
      // 用摘要 + 最後 5 則替代
      chat.messages = [
        { role: 'model', content: '[前情提要] ' + summary, ts: chat.messages[0].ts }
      ].concat(chat.messages.slice(-5));
      chat.summarized = true;
      console.log(TAG, '✅ 摘要完成');
    } catch (e) {
      console.warn(TAG, '摘要失敗:', e.message);
    }
    return chat;
  }

  // ---- CSS ----
  var CSS = '' +
    '#aiChatBtn{position:fixed;right:12px;bottom:230px;z-index:99998;' +
    '  width:48px;height:48px;border-radius:50%;background:#a68a56;color:#fff;' +
    '  border:none;font-size:22px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3);' +
    '  transition:transform .2s}' +
    '#aiChatBtn:hover{transform:scale(1.1)}' +
    '' +
    '#aiChatDrawer{position:fixed;top:0;right:-450px;width:420px;height:100vh;' +
    '  background:#f5f1e8;box-shadow:-4px 0 20px rgba(0,0,0,.2);z-index:100000;' +
    '  transition:right .3s ease;display:flex;flex-direction:column;' +
    '  font:13px/1.5 -apple-system,"Segoe UI",sans-serif}' +
    '#aiChatDrawer.open{right:0}' +
    '' +
    '#aiChatDrawer .aiHead{padding:12px 16px;background:#a68a56;color:#fff;' +
    '  display:flex;align-items:center;justify-content:space-between;gap:8px}' +
    '#aiChatDrawer .aiTitle{font-weight:bold;font-size:14px;flex:1;cursor:pointer}' +
    '#aiChatDrawer .aiTitle:hover{opacity:0.85}' +
    '#aiChatDrawer .aiTitle input{background:rgba(255,255,255,0.2);border:none;color:#fff;' +
    '  padding:4px 8px;border-radius:4px;font-size:14px;font-weight:bold;width:100%}' +
    '#aiChatDrawer .aiHeadBtn{background:none;border:none;color:#fff;cursor:pointer;' +
    '  font-size:16px;padding:4px 8px;border-radius:4px}' +
    '#aiChatDrawer .aiHeadBtn:hover{background:rgba(255,255,255,0.2)}' +
    '' +
    '#aiChatDrawer .aiRoleBar{padding:8px 12px;background:#ebe4d1;' +
    '  border-bottom:1px solid #d5c9a8;display:flex;gap:6px;align-items:center;flex-wrap:wrap}' +
    '#aiChatDrawer .aiRoleBar select{flex:1;padding:4px 8px;border:1px solid #a68a56;' +
    '  border-radius:4px;background:#fff;font-size:12px}' +
    '#aiChatDrawer .aiRoleBar button{padding:4px 10px;border:1px solid #a68a56;' +
    '  background:#fff;color:#a68a56;border-radius:4px;cursor:pointer;font-size:12px}' +
    '' +
    '#aiChatDrawer .aiCustomPrompt{padding:8px 12px;background:#ebe4d1;display:none;' +
    '  border-bottom:1px solid #d5c9a8}' +
    '#aiChatDrawer .aiCustomPrompt.show{display:block}' +
    '#aiChatDrawer .aiCustomPrompt textarea{width:100%;box-sizing:border-box;padding:6px;' +
    '  border:1px solid #a68a56;border-radius:4px;font-size:12px;resize:vertical;' +
    '  min-height:50px;font-family:inherit}' +
    '' +
    '#aiChatDrawer .aiBody{flex:1;display:flex;overflow:hidden}' +
    '#aiChatDrawer .aiListPanel{width:120px;border-right:1px solid #d5c9a8;' +
    '  overflow-y:auto;background:#f5f1e8}' +
    '#aiChatDrawer .aiListItem{padding:8px;border-bottom:1px solid #e8dfc4;' +
    '  cursor:pointer;font-size:11px;position:relative;color:#555}' +
    '#aiChatDrawer .aiListItem:hover{background:#ebe4d1}' +
    '#aiChatDrawer .aiListItem.active{background:#a68a56;color:#fff}' +
    '#aiChatDrawer .aiListItem .aiListDel{position:absolute;top:6px;right:6px;' +
    '  color:#999;opacity:0;transition:opacity .15s;font-size:12px}' +
    '#aiChatDrawer .aiListItem:hover .aiListDel{opacity:1}' +
    '#aiChatDrawer .aiListItem.active .aiListDel{color:#fff}' +
    '#aiChatDrawer .aiListNew{padding:10px;text-align:center;color:#a68a56;' +
    '  cursor:pointer;font-weight:bold;border-bottom:1px solid #d5c9a8}' +
    '#aiChatDrawer .aiListNew:hover{background:#ebe4d1}' +
    '' +
    '#aiChatDrawer .aiChatPanel{flex:1;display:flex;flex-direction:column;' +
    '  background:#fdfaf3}' +
    '#aiChatDrawer .aiMessages{flex:1;overflow-y:auto;padding:12px}' +
    '#aiChatDrawer .aiMsg{margin:8px 0;max-width:85%;padding:8px 12px;' +
    '  border-radius:12px;word-wrap:break-word;white-space:pre-wrap;line-height:1.5;' +
    '  font-size:13px}' +
    '#aiChatDrawer .aiMsg.user{background:#a68a56;color:#fff;margin-left:auto;' +
    '  border-bottom-right-radius:4px}' +
    '#aiChatDrawer .aiMsg.model{background:#ebe4d1;color:#333;margin-right:auto;' +
    '  border-bottom-left-radius:4px}' +
    '#aiChatDrawer .aiMsg.typing{background:#ebe4d1;color:#999;font-style:italic}' +
    '#aiChatDrawer .aiEmpty{color:#999;text-align:center;padding:40px 20px;font-size:12px}' +
    '' +
    '#aiChatDrawer .aiInputBar{padding:8px;border-top:1px solid #d5c9a8;' +
    '  background:#f5f1e8;display:flex;gap:6px}' +
    '#aiChatDrawer .aiInputBar textarea{flex:1;padding:8px;border:1px solid #a68a56;' +
    '  border-radius:6px;font-size:13px;resize:none;font-family:inherit;' +
    '  min-height:38px;max-height:120px}' +
    '#aiChatDrawer .aiInputBar button{padding:0 16px;background:#a68a56;color:#fff;' +
    '  border:none;border-radius:6px;cursor:pointer;font-weight:bold}' +
    '#aiChatDrawer .aiInputBar button:disabled{background:#ccc;cursor:not-allowed}' +
    '' +
    '@media (max-width:600px){' +
    '  #aiChatDrawer{width:100vw;right:-100vw}' +
    '  #aiChatDrawer .aiListPanel{width:100px}' +
    '  #aiChatBtn{bottom:200px;right:8px;width:44px;height:44px;font-size:20px}' +
    '}';

  function injectCSS() {
    if (document.getElementById('aiChatCSS')) return;
    var s = document.createElement('style');
    s.id = 'aiChatCSS';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---- 狀態 ----
  var data = loadData();
  var currentChatId = null;
  var sending = false;

  function getCurrentChat() {
    return data.chats[currentChatId];
  }

  function ensureCurrentChat() {
    if (!currentChatId || !data.chats[currentChatId]) {
      currentChatId = data.currentId;
    }
    if (!currentChatId || !data.chats[currentChatId]) {
      // 找最新的一個
      var ids = Object.keys(data.chats).sort(function (a, b) {
        return data.chats[b].updatedAt - data.chats[a].updatedAt;
      });
      currentChatId = ids[0];
    }
    if (!currentChatId) {
      // 建新的
      currentChatId = createNewChat();
    }
    data.currentId = currentChatId;
    saveData(data);
    return getCurrentChat();
  }

  function createNewChat() {
    var id = newChatId();
    data.chats[id] = {
      id: id,
      title: todayTitle(),
      role: 'english_tutor',
      customPrompt: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    data.currentId = id;
    saveData(data);
    return id;
  }

  // ---- UI ----
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderTitle() {
    var chat = getCurrentChat();
    var titleEl = document.getElementById('aiChatTitle');
    if (titleEl && chat) titleEl.textContent = '💬 ' + chat.title;
  }

  function renderList() {
    var listEl = document.getElementById('aiChatList');
    if (!listEl) return;
    var ids = Object.keys(data.chats).sort(function (a, b) {
      return data.chats[b].updatedAt - data.chats[a].updatedAt;
    });
    var html = '<div class="aiListNew" onclick="window.__aiChat.newChat()">+ 新對話</div>';
    for (var i = 0; i < ids.length; i++) {
      var c = data.chats[ids[i]];
      var active = ids[i] === currentChatId ? ' active' : '';
      html += '<div class="aiListItem' + active + '" data-id="' + ids[i] + '">' +
                escapeHtml(c.title) +
                '<span class="aiListDel" data-id="' + ids[i] + '">×</span>' +
              '</div>';
    }
    listEl.innerHTML = html;
    // 綁事件
    var items = listEl.querySelectorAll('.aiListItem');
    for (var j = 0; j < items.length; j++) {
      (function (it) {
        it.onclick = function (e) {
          if (e.target.classList.contains('aiListDel')) return;
          switchChat(it.getAttribute('data-id'));
        };
      })(items[j]);
    }
    var dels = listEl.querySelectorAll('.aiListDel');
    for (var k = 0; k < dels.length; k++) {
      (function (d) {
        d.onclick = function (e) {
          e.stopPropagation();
          if (confirm('刪除這個對話？')) {
            deleteChat(d.getAttribute('data-id'));
          }
        };
      })(dels[k]);
    }
  }

  function renderMessages() {
    var msgsEl = document.getElementById('aiChatMessages');
    if (!msgsEl) return;
    var chat = getCurrentChat();
    if (!chat || !chat.messages.length) {
      msgsEl.innerHTML = '<div class="aiEmpty">開始新對話...<br>選擇左側角色 or 直接輸入</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < chat.messages.length; i++) {
      var m = chat.messages[i];
      html += '<div class="aiMsg ' + m.role + '">' + escapeHtml(m.content) + '</div>';
    }
    msgsEl.innerHTML = html;
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function renderRoleBar() {
    var sel = document.getElementById('aiRoleSelect');
    var custom = document.getElementById('aiCustomPrompt');
    var customTa = document.getElementById('aiCustomPromptTa');
    var chat = getCurrentChat();
    if (!chat) return;
    if (sel) sel.value = chat.role;
    if (customTa) customTa.value = chat.customPrompt || '';
    // 顯示/隱藏自訂區
    if (custom) {
      if (chat.customPrompt) custom.classList.add('show');
      else custom.classList.remove('show');
    }
  }

  function renderAll() {
    renderTitle();
    renderList();
    renderMessages();
    renderRoleBar();
  }

  // ---- 動作 ----
  function switchChat(id) {
    if (!data.chats[id]) return;
    currentChatId = id;
    data.currentId = id;
    saveData(data);
    renderAll();
  }

  function deleteChat(id) {
    delete data.chats[id];
    if (currentChatId === id) currentChatId = null;
    saveData(data);
    ensureCurrentChat();
    renderAll();
  }

  function newChat() {
    createNewChat();
    renderAll();
  }

  function renameChat() {
    var chat = getCurrentChat();
    if (!chat) return;
    var titleEl = document.getElementById('aiChatTitle');
    var old = chat.title;
    titleEl.innerHTML = '<input id="aiTitleInput" value="' + escapeHtml(old) + '">';
    var input = document.getElementById('aiTitleInput');
    input.focus();
    input.select();
    function commit() {
      chat.title = input.value.trim() || old;
      saveData(data);
      renderTitle();
      renderList();
    }
    input.onblur = commit;
    input.onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { renderTitle(); }
    };
  }

  function setRole(role) {
    var chat = getCurrentChat();
    if (!chat) return;
    chat.role = role;
    chat.updatedAt = Date.now();
    saveData(data);
    var custom = document.getElementById('aiCustomPrompt');
    if (custom) {
      if (role === 'free' || chat.customPrompt) custom.classList.add('show');
      else custom.classList.remove('show');
    }
  }

  function setCustomPrompt(text) {
    var chat = getCurrentChat();
    if (!chat) return;
    chat.customPrompt = text;
    chat.updatedAt = Date.now();
    saveData(data);
  }

  async function sendMessage() {
    if (sending) return;
    var input = document.getElementById('aiChatInput');
    var text = input.value.trim();
    if (!text) return;

    var chat = getCurrentChat();
    if (!chat) return;

    // 加使用者訊息
    chat.messages.push({ role: 'user', content: text, ts: Date.now() });
    chat.updatedAt = Date.now();

    // 如果標題還是預設日期，用第一句改標題
    if (/^\d+\/\d+ \d+:\d+$/.test(chat.title) && chat.messages.length === 1) {
      chat.title = text.slice(0, 20) + (text.length > 20 ? '...' : '');
    }

    saveData(data);
    input.value = '';
    input.style.height = 'auto';
    renderMessages();
    renderList();
    renderTitle();

    // 顯示 typing
    var msgsEl = document.getElementById('aiChatMessages');
    var typing = document.createElement('div');
    typing.className = 'aiMsg model typing';
    typing.textContent = '思考中...';
    msgsEl.appendChild(typing);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    sending = true;
    var sendBtn = document.getElementById('aiChatSend');
    if (sendBtn) sendBtn.disabled = true;

    try {
      // 智慧摘要
      chat = await summarizeIfNeeded(chat);

      // 決定 system prompt
      var systemPrompt = chat.customPrompt || (ROLES[chat.role] && ROLES[chat.role].prompt) || '';

      var reply = await callGeminiChat(chat.messages, systemPrompt);

      chat.messages.push({ role: 'model', content: reply, ts: Date.now() });
      chat.updatedAt = Date.now();
      saveData(data);
    } catch (e) {
      chat.messages.push({ 
        role: 'model', 
        content: '❌ 錯誤：' + e.message, 
        ts: Date.now() 
      });
      saveData(data);
    }

    sending = false;
    if (sendBtn) sendBtn.disabled = false;
    renderMessages();
  }

  // ---- 建立 UI ----
  function build() {
    if (document.getElementById('aiChatDrawer')) return;

    // 浮動按鈕
    var btn = document.createElement('button');
    btn.id = 'aiChatBtn';
    btn.title = 'AI 對話';
    btn.textContent = '💬';
    btn.onclick = openDrawer;
    document.body.appendChild(btn);

    // 抽屜
    var drawer = document.createElement('div');
    drawer.id = 'aiChatDrawer';
    var roleOptions = '';
    Object.keys(ROLES).forEach(function (k) {
      roleOptions += '<option value="' + k + '">' + ROLES[k].name + '</option>';
    });

    drawer.innerHTML = '' +
      '<div class="aiHead">' +
      '  <div class="aiTitle" id="aiChatTitle" title="雙擊改名">💬 對話</div>' +
      '  <button class="aiHeadBtn" id="aiBtnRename" title="改名">✏️</button>' +
      '  <button class="aiHeadBtn" id="aiBtnClose" title="關閉">✕</button>' +
      '</div>' +
      '<div class="aiRoleBar">' +
      '  <label style="color:#555;font-size:12px">🎭 角色:</label>' +
      '  <select id="aiRoleSelect">' + roleOptions + '</select>' +
      '  <button id="aiBtnCustomToggle" title="自訂 prompt">⚙️</button>' +
      '</div>' +
      '<div class="aiCustomPrompt" id="aiCustomPrompt">' +
      '  <textarea id="aiCustomPromptTa" placeholder="自訂 system prompt（覆蓋預設角色）..."></textarea>' +
      '</div>' +
      '<div class="aiBody">' +
      '  <div class="aiListPanel" id="aiChatList"></div>' +
      '  <div class="aiChatPanel">' +
      '    <div class="aiMessages" id="aiChatMessages"></div>' +
      '    <div class="aiInputBar">' +
      '      <textarea id="aiChatInput" placeholder="Enter 送出，Shift+Enter 換行" rows="1"></textarea>' +
      '      <button id="aiChatSend">送出</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(drawer);

    // 綁事件
    document.getElementById('aiBtnClose').onclick = closeDrawer;
    document.getElementById('aiBtnRename').onclick = renameChat;
    document.getElementById('aiChatTitle').ondblclick = renameChat;
    document.getElementById('aiRoleSelect').onchange = function (e) {
      setRole(e.target.value);
    };
    document.getElementById('aiBtnCustomToggle').onclick = function () {
      document.getElementById('aiCustomPrompt').classList.toggle('show');
    };
    document.getElementById('aiCustomPromptTa').oninput = function (e) {
      setCustomPrompt(e.target.value);
    };
    var input = document.getElementById('aiChatInput');
    input.oninput = function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    };
    input.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
    document.getElementById('aiChatSend').onclick = sendMessage;
  }

  function openDrawer() {
    injectCSS();
    build();
    ensureCurrentChat();
    document.getElementById('aiChatDrawer').classList.add('open');
    renderAll();
    // Focus input
    setTimeout(function () {
      document.getElementById('aiChatInput').focus();
    }, 300);
  }

  function closeDrawer() {
    var d = document.getElementById('aiChatDrawer');
    if (d) d.classList.remove('open');
  }

  // 對外 API
  window.__aiChat = {
    open: openDrawer,
    close: closeDrawer,
    newChat: function () { newChat(); },
    switchChat: switchChat,
    getData: function () { return data; },
    reset: function () {
      if (confirm('刪除全部對話？')) {
        data = { chats: {} };
        currentChatId = null;
        saveData(data);
        ensureCurrentChat();
        renderAll();
      }
    }
  };

  function boot() {
    setTimeout(function () {
      injectCSS();
      // 只建按鈕，抽屜點按鈕才建
      var btn = document.createElement('button');
      btn.id = 'aiChatBtn';
      btn.title = 'AI 對話';
      btn.textContent = '💬';
      btn.onclick = openDrawer;
      document.body.appendChild(btn);

      console.log(TAG, 'ready', VER);
      console.log(TAG, '手動 API:');
      console.log(TAG, '  __aiChat.open()      開啟抽屜');
      console.log(TAG, '  __aiChat.newChat()   新對話');
      console.log(TAG, '  __aiChat.reset()     清空全部');
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
