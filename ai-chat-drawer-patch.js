/* ai-chat-drawer-patch.js  v20260713-2 Phase A + Blocker Fix
   AI 駐站助理 - Phase A + Blocker Fix（Level 1 + 部分 Level 2）

   新增功能（相對 v1）：
   1) 📎 上下文按鈕：勾選要附加什麼給 AI
      - 📖 當前文章
      - 📝 選取文字（自動偵測）
      - 📚 單字庫統計
      - 🎯 今天要複習
      - 📓 最近筆記
   2) 訊息送出時自動附加上下文
   3) 輸入框下方顯示啟用的上下文標籤
   4) 上下文設定跟隨對話儲存
*/
(function () {
  'use strict';
  var TAG = '[AIChatDrawer]';
  var VER = 'v20260713-3';
  var STORAGE_KEY = 'notebook_ai_chats_v1';
  var MODEL_FALLBACK = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3-flash-preview'];
  var MAX_ARTICLE_CHARS = 3000;
  var MAX_DUE_LIST = 30;

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

  var CONTEXT_TYPES = [
    { key: 'article',   label: '📖 當前文章',   desc: '文章標題與內文' },
    { key: 'selection', label: '📝 選取文字',   desc: '目前反白的文字' },
    { key: 'wordbank',  label: '📚 單字庫統計', desc: '總數與最近新增' },
    { key: 'due',       label: '🎯 今天要複習', desc: 'SRS 到期字清單' },
    { key: 'notes',     label: '📓 最近筆記',   desc: '近 5 個筆記標題' }
  ];

  var DEFAULT_CONTEXTS = {
    article: false, selection: false, wordbank: false, due: false, notes: false
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

  // ---- 上下文提取 ----
  function getPlatformDB() {
    try { return JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}'); }
    catch (e) { return {}; }
  }

  function extractArticle() {
    // 找當前文章：多種可能選擇器
    var candidates = [
      document.querySelector('#chapters .chapter'),
      document.querySelector('.chapter'),
      document.querySelector('#article'),
      document.querySelector('article'),
      document.querySelector('.notebook-content'),
      document.querySelector('#chapters')
    ];
    var el = null;
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i]) { el = candidates[i]; break; }
    }
    if (!el) return null;

    // 找標題
    var title = '';
    var titleEl = el.querySelector('h1, h2, h3, .chapter-title, [class*="title"]');
    if (titleEl) title = titleEl.textContent.trim();

    // 抓內文（去掉標題、按鈕、控制元素）
    var clone = el.cloneNode(true);
    clone.querySelectorAll('button, script, style, .flash-close-btn, .gsync-btn, [class*="btn"]').forEach(function (n) {
      n.remove();
    });
    var text = clone.textContent.replace(/\s+/g, ' ').trim();
    if (title && text.indexOf(title) === 0) text = text.slice(title.length).trim();
    if (text.length > MAX_ARTICLE_CHARS) text = text.slice(0, MAX_ARTICLE_CHARS) + '\n...(內文已截斷)';

    return { title: title || '(無標題)', content: text };
  }

  function extractSelection() {
    var s = window.getSelection && window.getSelection().toString().trim();
    return s || null;
  }

  function extractWordbank() {
    var db = getPlatformDB();
    var learn = db.learn || {};
    var words = Object.keys(learn);
    var total = words.length;
    var now = Date.now();
    var week = 7 * 24 * 60 * 60 * 1000;
    var recent7 = 0;
    words.forEach(function (w) {
      var e = learn[w];
      var t = e.createdAt || e.firstSeenAt || e.addedAt || 0;
      if (t && now - t < week) recent7++;
    });
    return { total: total, recent7: recent7 };
  }

  function extractDue() {
    var db = getPlatformDB();
    var learn = db.learn || {};
    var now = Date.now();
    var due = [];
    Object.keys(learn).forEach(function (w) {
      var e = learn[w];
      if (!e) return;
      var d = e.due || e.dueAt || (e.srs && e.srs.due) || 0;
      if (!d || d <= now) due.push(w);
    });
    return {
      count: due.length,
      list: due.slice(0, MAX_DUE_LIST),
      truncated: due.length > MAX_DUE_LIST
    };
  }

  function extractNotes() {
    var db = getPlatformDB();
    var notebooks = db.notebooks || db.chapters || {};
    var titles = [];
    var keys = Object.keys(notebooks);
    // 用 updatedAt 排序（如果有）
    keys.sort(function (a, b) {
      var ta = (notebooks[a] && notebooks[a].updatedAt) || 0;
      var tb = (notebooks[b] && notebooks[b].updatedAt) || 0;
      return tb - ta;
    });
    for (var i = 0; i < Math.min(5, keys.length); i++) {
      var n = notebooks[keys[i]];
      var title = (n && (n.title || n.name)) || keys[i];
      titles.push(title);
    }
    return titles;
  }

  function buildContextText(contexts) {
    var parts = [];

    if (contexts.article) {
      var art = extractArticle();
      if (art) {
        parts.push('【當前文章】\n標題: ' + art.title + '\n' + art.content);
      }
    }

    if (contexts.selection) {
      var sel = extractSelection();
      if (sel) {
        parts.push('【選取文字】\n"' + sel + '"');
      }
    }

    if (contexts.wordbank) {
      var wb = extractWordbank();
      parts.push('【單字庫】\n共 ' + wb.total + ' 字，7 天內新增 ' + wb.recent7 + ' 個');
    }

    if (contexts.due) {
      var due = extractDue();
      var listStr = due.list.join(', ');
      if (due.truncated) listStr += ' ... (共 ' + due.count + ' 個，僅列前 ' + MAX_DUE_LIST + ')';
      parts.push('【今天要複習】\n共 ' + due.count + ' 字：' + listStr);
    }

    if (contexts.notes) {
      var notes = extractNotes();
      if (notes.length) {
        parts.push('【最近筆記】\n' + notes.map(function (t) { return '- ' + t; }).join('\n'));
      }
    }

    if (!parts.length) return '';
    return '===== 📎 上下文（來自使用者的網頁）=====\n' +
           parts.join('\n\n') +
           '\n===== 使用者問題 =====\n';
  }

  // ---- Gemini 呼叫 ----
  async function callGeminiChat(messages, systemPrompt) {
    var keys = getKeys();
    if (!keys.length) throw new Error('沒有 API key');

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
    if (chat.summarized) return chat;

    console.log(TAG, '📝 訊息 ' + chat.messages.length + ' 則，開始摘要');
    var toSummarize = chat.messages.slice(0, 15);
    var summaryPrompt = '請用繁體中文簡潔摘要以下對話（150 字內），保留關鍵資訊：\n\n' +
      toSummarize.map(function (m) {
        return (m.role === 'user' ? '使用者' : 'AI') + '：' + m.content;
      }).join('\n\n');

    try {
      var summary = await callGeminiChat(
        [{ role: 'user', content: summaryPrompt }], ''
      );
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
    '  display:flex;align-items:center;justify-content:space-between;gap:6px}' +
    '#aiChatDrawer .aiTitle{font-weight:bold;font-size:14px;flex:1;cursor:pointer;' +
    '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#aiChatDrawer .aiTitle:hover{opacity:0.85}' +
    '#aiChatDrawer .aiTitle input{background:rgba(255,255,255,0.2);border:none;color:#fff;' +
    '  padding:4px 8px;border-radius:4px;font-size:14px;font-weight:bold;width:100%}' +
    '#aiChatDrawer .aiHeadBtn{background:none;border:none;color:#fff;cursor:pointer;' +
    '  font-size:16px;padding:4px 8px;border-radius:4px;position:relative}' +
    '#aiChatDrawer .aiHeadBtn:hover{background:rgba(255,255,255,0.2)}' +
    '#aiChatDrawer .aiHeadBtn.on{background:rgba(255,255,255,0.25)}' +
    '#aiChatDrawer .aiHeadBtn .aiCtxDot{position:absolute;top:2px;right:2px;' +
    '  width:8px;height:8px;background:#5cd45c;border-radius:50%;border:1px solid #fff}' +
    '' +
    '#aiChatDrawer .aiCtxPop{position:absolute;top:52px;right:12px;width:280px;' +
    '  background:#fff;border:1px solid #a68a56;border-radius:8px;padding:8px;' +
    '  box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:100001;display:none}' +
    '#aiChatDrawer .aiCtxPop.open{display:block}' +
    '#aiChatDrawer .aiCtxPop h4{margin:4px 0 8px;font-size:12px;color:#a68a56}' +
    '#aiChatDrawer .aiCtxItem{display:flex;align-items:center;padding:6px;' +
    '  cursor:pointer;border-radius:4px;font-size:12px}' +
    '#aiChatDrawer .aiCtxItem:hover{background:#f5f1e8}' +
    '#aiChatDrawer .aiCtxItem input{margin-right:8px}' +
    '#aiChatDrawer .aiCtxItem .aiCtxDesc{color:#999;font-size:10px;margin-left:4px}' +
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
    '#aiChatDrawer .aiMsg .aiCtxTag{display:inline-block;background:rgba(255,255,255,0.3);' +
    '  color:inherit;padding:1px 6px;border-radius:3px;font-size:10px;margin-right:4px}' +
    '#aiChatDrawer .aiEmpty{color:#999;text-align:center;padding:40px 20px;font-size:12px}' +
    '' +
    '#aiChatDrawer .aiCtxBadges{padding:4px 8px;background:#f0e9d5;font-size:11px;' +
    '  color:#a68a56;border-top:1px solid #d5c9a8;min-height:20px;display:none}' +
    '#aiChatDrawer .aiCtxBadges.show{display:block}' +
    '#aiChatDrawer .aiCtxBadges .aiCtxBadge{display:inline-block;background:#a68a56;' +
    '  color:#fff;padding:1px 6px;border-radius:3px;margin:2px;font-size:10px}' +
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
    '  #aiChatDrawer .aiCtxPop{width:calc(100vw - 24px);right:12px}' +
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

  function getCurrentChat() { return data.chats[currentChatId]; }

  function ensureCurrentChat() {
    if (!currentChatId || !data.chats[currentChatId]) currentChatId = data.currentId;
    if (!currentChatId || !data.chats[currentChatId]) {
      var ids = Object.keys(data.chats).sort(function (a, b) {
        return data.chats[b].updatedAt - data.chats[a].updatedAt;
      });
      currentChatId = ids[0];
    }
    if (!currentChatId) currentChatId = createNewChat();
    data.currentId = currentChatId;
    // 保底：舊 chat 補 contexts 欄位
    var c = getCurrentChat();
    if (c && !c.contexts) {
      c.contexts = {};
      for (var k in DEFAULT_CONTEXTS) c.contexts[k] = DEFAULT_CONTEXTS[k];
    }
    saveData(data);
    return getCurrentChat();
  }

  function createNewChat() {
    var id = newChatId();
    var contexts = {};
    for (var k in DEFAULT_CONTEXTS) contexts[k] = DEFAULT_CONTEXTS[k];
    data.chats[id] = {
      id: id,
      title: todayTitle(),
      role: 'english_tutor',
      customPrompt: '',
      contexts: contexts,
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

  function anyContextActive(contexts) {
    for (var k in contexts) if (contexts[k]) return true;
    return false;
  }

  function renderTitle() {
    var chat = getCurrentChat();
    var titleEl = document.getElementById('aiChatTitle');
    if (titleEl && chat) titleEl.textContent = '💬 ' + chat.title;
  }

  function renderCtxBtn() {
    var btn = document.getElementById('aiBtnCtx');
    if (!btn) return;
    var chat = getCurrentChat();
    var oldDot = btn.querySelector('.aiCtxDot');
    if (oldDot) oldDot.remove();
    if (chat && anyContextActive(chat.contexts)) {
      var dot = document.createElement('span');
      dot.className = 'aiCtxDot';
      btn.appendChild(dot);
    }
  }

  function renderCtxBadges() {
    var el = document.getElementById('aiCtxBadges');
    if (!el) return;
    var chat = getCurrentChat();
    if (!chat || !anyContextActive(chat.contexts)) {
      el.classList.remove('show');
      el.innerHTML = '';
      return;
    }
    var html = '📎 附加上下文：';
    CONTEXT_TYPES.forEach(function (t) {
      if (chat.contexts[t.key]) {
        html += '<span class="aiCtxBadge">' + t.label + '</span>';
      }
    });
    el.innerHTML = html;
    el.classList.add('show');
  }

  function renderCtxPop() {
    var pop = document.getElementById('aiCtxPop');
    if (!pop) return;
    var chat = getCurrentChat();
    if (!chat) return;
    var html = '<h4>📎 附加什麼給 AI？</h4>';
    CONTEXT_TYPES.forEach(function (t) {
      var checked = chat.contexts[t.key] ? 'checked' : '';
      html += '<label class="aiCtxItem">' +
              '  <input type="checkbox" data-key="' + t.key + '" ' + checked + '>' +
              '  <span>' + t.label + '</span>' +
              '  <span class="aiCtxDesc">' + t.desc + '</span>' +
              '</label>';
    });
    pop.innerHTML = html;
    // 綁勾選
    var inputs = pop.querySelectorAll('input[type=checkbox]');
    for (var i = 0; i < inputs.length; i++) {
      (function (inp) {
        inp.onchange = function () {
          chat.contexts[inp.getAttribute('data-key')] = inp.checked;
          chat.updatedAt = Date.now();
          saveData(data);
          renderCtxBtn();
          renderCtxBadges();
        };
      })(inputs[i]);
    }
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
          if (confirm('刪除這個對話？')) deleteChat(d.getAttribute('data-id'));
        };
      })(dels[k]);
    }
  }

  function renderMessages() {
    var msgsEl = document.getElementById('aiChatMessages');
    if (!msgsEl) return;
    var chat = getCurrentChat();
    if (!chat || !chat.messages.length) {
      msgsEl.innerHTML = '<div class="aiEmpty">開始新對話...<br>💡 點右上 📎 加入上下文<br>讓 AI 看到你的文章/單字庫</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < chat.messages.length; i++) {
      var m = chat.messages[i];
      var content = m.content;
      // 使用者訊息如果有 raw 就顯示 raw（不含 context），沒 raw 就直接顯示 content
      var display = (m.role === 'user' && m.raw) ? m.raw : content;
      var ctxTag = '';
      if (m.role === 'user' && m.ctxUsed && m.ctxUsed.length) {
        ctxTag = '<span class="aiCtxTag">📎 ' + m.ctxUsed.join('·') + '</span>';
      }
      html += '<div class="aiMsg ' + m.role + '">' + ctxTag + escapeHtml(display) + '</div>';
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
    renderCtxBtn();
    renderCtxBadges();
    renderCtxPop();
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

    // ⭐ 智慧自動偵測選取
    var effectiveCtx = {};
    for (var k in chat.contexts) effectiveCtx[k] = chat.contexts[k];
    var sel = extractSelection();
    if (sel && !effectiveCtx.selection) {
      effectiveCtx.selection = true;
      console.log(TAG, '智慧偵測：自動附加選取文字');
    }

    // ⭐ 建立上下文文字
    var ctxText = buildContextText(effectiveCtx);
    var fullContent = ctxText ? (ctxText + text) : text;

    // 記錄用了哪些上下文（用來顯示標籤）
    var ctxUsed = [];
    CONTEXT_TYPES.forEach(function (t) {
      if (effectiveCtx[t.key]) ctxUsed.push(t.label.replace(/^\S+\s/, ''));  // 去掉 emoji
    });

    // 存訊息（content 是含上下文的完整內容給 AI，raw 是原始輸入給顯示）
    chat.messages.push({ 
      role: 'user', 
      content: fullContent, 
      raw: text,
      ctxUsed: ctxUsed,
      ts: Date.now() 
    });
    chat.updatedAt = Date.now();

    if (/^\d+\/\d+ \d+:\d+$/.test(chat.title) && chat.messages.length === 1) {
      chat.title = text.slice(0, 20) + (text.length > 20 ? '...' : '');
    }

    saveData(data);
    input.value = '';
    input.style.height = 'auto';
    renderMessages();
    renderList();
    renderTitle();

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
      chat = await summarizeIfNeeded(chat);
      var systemPrompt = chat.customPrompt || (ROLES[chat.role] && ROLES[chat.role].prompt) || '';
      var reply = await callGeminiChat(chat.messages, systemPrompt);
      chat.messages.push({ role: 'model', content: reply, ts: Date.now() });
      chat.updatedAt = Date.now();
      saveData(data);
    } catch (e) {
      chat.messages.push({ role: 'model', content: '❌ 錯誤：' + e.message, ts: Date.now() });
      saveData(data);
    }

    sending = false;
    if (sendBtn) sendBtn.disabled = false;
    renderMessages();
  }

  // ---- 建立 UI ----
  function build() {
    if (document.getElementById('aiChatDrawer')) return;

    var drawer = document.createElement('div');
    drawer.id = 'aiChatDrawer';
    var roleOptions = '';
    Object.keys(ROLES).forEach(function (k) {
      roleOptions += '<option value="' + k + '">' + ROLES[k].name + '</option>';
    });

    drawer.innerHTML = '' +
      '<div class="aiHead">' +
      '  <div class="aiTitle" id="aiChatTitle" title="雙擊改名">💬 對話</div>' +
      '  <button class="aiHeadBtn" id="aiBtnCtx" title="上下文">📎</button>' +
      '  <button class="aiHeadBtn" id="aiBtnRename" title="改名">✏️</button>' +
      '  <button class="aiHeadBtn" id="aiBtnClose" title="關閉">✕</button>' +
      '</div>' +
      '<div class="aiCtxPop" id="aiCtxPop"></div>' +
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
      '    <div class="aiCtxBadges" id="aiCtxBadges"></div>' +
      '    <div class="aiInputBar">' +
      '      <textarea id="aiChatInput" placeholder="Enter 送出，Shift+Enter 換行" rows="1"></textarea>' +
      '      <button id="aiChatSend">送出</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(drawer);

    document.getElementById('aiBtnClose').onclick = closeDrawer;
    document.getElementById('aiBtnRename').onclick = renameChat;
    document.getElementById('aiChatTitle').ondblclick = renameChat;
    document.getElementById('aiBtnCtx').onclick = function (e) {
      e.stopPropagation();
      var pop = document.getElementById('aiCtxPop');
      pop.classList.toggle('open');
      if (pop.classList.contains('open')) renderCtxPop();
    };
    // 點外面關掉 pop
    document.addEventListener('click', function (e) {
      var pop = document.getElementById('aiCtxPop');
      var btn = document.getElementById('aiBtnCtx');
      if (!pop || !btn) return;
      if (pop.classList.contains('open') && 
          !pop.contains(e.target) && !btn.contains(e.target)) {
        pop.classList.remove('open');
      }
    });
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

  // ⭐ 遮擋物隔離
  var BLOCKERS = ['fullTranslateBox', 'gcttsPanel'];
  var savedBlockerStyles = {};

  function hideBlockers() {
    BLOCKERS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !(id in savedBlockerStyles)) {
        savedBlockerStyles[id] = el.style.display || '';
        el.style.display = 'none';
        console.log(TAG, '\ud83d\udd07 隱藏遮擋物:', id);
      }
    });
  }

  function restoreBlockers() {
    Object.keys(savedBlockerStyles).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = savedBlockerStyles[id];
    });
    savedBlockerStyles = {};
  }

  function openDrawer() {
    injectCSS();
    build();
    ensureCurrentChat();
    var drawer = document.getElementById('aiChatDrawer');
    drawer.classList.add('open');
    drawer.style.zIndex = '2147483001';  // 高於 fullTranslateBox
    hideBlockers();  // ⭐ 隱藏遮擋物
    renderAll();
    setTimeout(function () {
      var i = document.getElementById('aiChatInput');
      if (i) i.focus();
    }, 300);
  }

  function closeDrawer() {
    var d = document.getElementById('aiChatDrawer');
    if (d) d.classList.remove('open');
    var pop = document.getElementById('aiCtxPop');
    if (pop) pop.classList.remove('open');
    restoreBlockers();  // ⭐ 還原遮擋物
    console.log(TAG, '\ud83d\udd04 已還原遮擋物');
  }

  window.__aiChat = {
    open: openDrawer,
    close: closeDrawer,
    newChat: function () { newChat(); },
    switchChat: switchChat,
    getData: function () { return data; },
    testContext: function () {
      console.log('=== 上下文提取測試 ===');
      console.log('article:', extractArticle());
      console.log('selection:', extractSelection());
      console.log('wordbank:', extractWordbank());
      console.log('due:', extractDue());
      console.log('notes:', extractNotes());
    },
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
      var btn = document.createElement('button');
      btn.id = 'aiChatBtn';
      btn.title = 'AI 對話（駐站助理）';
      btn.textContent = '💬';
      btn.onclick = openDrawer;
      document.body.appendChild(btn);

      console.log(TAG, 'ready', VER, 'Phase A + Blocker Fix');
      console.log(TAG, '📎 支援 5 種上下文附加');
      console.log(TAG, '手動 API:');
      console.log(TAG, '  __aiChat.open()          開啟');
      console.log(TAG, '  __aiChat.newChat()       新對話');
      console.log(TAG, '  __aiChat.testContext()   測試上下文提取');
      console.log(TAG, '  __aiChat.reset()         清空全部');
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
