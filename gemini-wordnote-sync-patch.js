/* gemini-wordnote-sync-patch.js  v20260713-1
   Word Note ↔ Gemini 資料同步 patch
   功能：
   1) Word Note 開啟時，自動檢查 db.learn[word] 有沒有 Gemini 資料
   2) 沒有 → 呼叫 lookupWordWithGemini(word) → 存回 db.learn
   3) 保留舊欄位（word/lemma/pos/tw/tip）同時新增 Gemini 欄位
   4) 提供「🔄 用 Gemini 更新」按鈕強制重新查詢
   5) 用 MutationObserver 偵測 Word Note 開啟
*/
(function () {
  'use strict';
  var TAG = '[GeminiSync]';
  var VER = 'v20260713-1';

  // ---- 資料層 ----
  function getDB() {
    try { return JSON.parse(localStorage.getItem('notebook_platform_v3')) || {}; }
    catch (e) { return {}; }
  }
  function saveDB(db) {
    try { localStorage.setItem('notebook_platform_v3', JSON.stringify(db)); }
    catch (e) { console.error(TAG, 'save fail', e); }
  }

  function hasGeminiData(entry) {
    return entry && entry.geminiSource === 'gemini' && entry.geminiTw;
  }

  // 更新 db.learn[word] 的 Gemini 欄位
  function updateEntry(word, gemini) {
    var db = getDB();
    if (!db.learn) db.learn = {};
    var entry = db.learn[word] || {};

    // Ultimate 版可能有 defs 陣列，簡短版直接是 pos/tw
    var pos = gemini.pos || (gemini.defs && gemini.defs[0] && gemini.defs[0].pos) || '';
    var tw = gemini.tw || (gemini.defs && gemini.defs[0] && gemini.defs[0].tw) || '';

    entry.word = entry.word || word;
    entry.lemma = gemini.word || entry.lemma || word;
    entry.geminiPos = pos;
    entry.geminiTw = tw;
    entry.geminiEx = gemini.ex || '';
    entry.geminiTwEx = gemini.tw_ex || '';
    entry.geminiPhonetic = gemini.phonetic || '';
    entry.geminiSynonyms = gemini.synonyms || [];
    entry.geminiDerivatives = gemini.derivatives || [];
    entry.geminiCollocations = gemini.collocations || [];
    entry.geminiLevel = gemini.level || '';
    entry.geminiTip = gemini.tip || '';
    entry.geminiSource = 'gemini';
    entry.geminiUpdatedAt = Date.now();
    entry.geminiRaw = gemini;  // 完整原始資料

    db.learn[word] = entry;
    saveDB(db);
    console.log(TAG, '✅ 已同步 db.learn[' + word + ']');
    return entry;
  }

  // 主同步邏輯：查 Gemini 並更新 db
  async function syncWord(word, force) {
    if (!word) return null;
    if (typeof window.lookupWordWithGemini !== 'function') {
      console.warn(TAG, '❌ lookupWordWithGemini 未載入');
      return null;
    }

    var db = getDB();
    var entry = db.learn && db.learn[word];

    if (!force && hasGeminiData(entry)) {
      console.log(TAG, '📦 ' + word + ' 已有 Gemini 資料，跳過');
      return entry;
    }

    console.log(TAG, '🔍 查詢 Gemini: ' + word);
    var gemini = await window.lookupWordWithGemini(word);
    if (!gemini) {
      console.warn(TAG, '❌ ' + word + ' Gemini 查詢失敗');
      return null;
    }

    return updateEntry(word, gemini);
  }

  // 重新渲染 Word Note UI（覆蓋顯示的定義）
  function rerenderCard(word, entry) {
    if (!entry) return;

    // 找 Word Note 卡片
    var cards = document.querySelectorAll('h1, h2, .word-title, [class*="title"]');
    for (var i = 0; i < cards.length; i++) {
      var titleEl = cards[i];
      if (titleEl.textContent && titleEl.textContent.trim().toLowerCase() === word.toLowerCase()) {
        var card = titleEl.closest('div, section, article') || titleEl.parentElement;
        if (!card) continue;

        // 找定義區塊（含「定義」或 pos 標籤的區塊）
        var defBox = card.querySelector('[class*="definition"], [class*="def"]');
        if (!defBox) {
          // 用文字內容找
          var boxes = card.querySelectorAll('div, p');
          for (var j = 0; j < boxes.length; j++) {
            if (/定義|MyMemory|Auto translated/i.test(boxes[j].textContent)) {
              defBox = boxes[j];
              break;
            }
          }
        }

        if (defBox) {
          // 換掉裡面的內容
          defBox.innerHTML = 
            '<div style="font-weight:bold;color:#4dc9e6;margin-bottom:6px">' +
              '<span style="background:#4dc9e6;color:#000;padding:2px 8px;border-radius:4px;font-size:11px;margin-right:6px">' +
                (entry.geminiPos || '') + '</span>' +
              (entry.geminiTw || '') +
            '</div>' +
            (entry.geminiPhonetic ? 
              '<div style="color:#888;font-size:12px;margin-bottom:4px">' + entry.geminiPhonetic + '</div>' : '') +
            (entry.geminiEx ? 
              '<div style="margin-top:8px;padding:8px;background:rgba(77,201,230,.08);border-left:3px solid #4dc9e6;border-radius:4px">' +
                '<div style="color:#666;font-style:italic">' + entry.geminiEx + '</div>' +
                '<div style="color:#333;margin-top:4px">' + (entry.geminiTwEx || '') + '</div>' +
              '</div>' : '') +
            '<div style="color:#8f8;font-size:10px;margin-top:6px">✨ Gemini · ' + 
              new Date(entry.geminiUpdatedAt || Date.now()).toLocaleString('zh-TW') + '</div>';

          console.log(TAG, '🎨 已重新渲染 ' + word + ' 卡片');
        }

        // 加「更新」按鈕
        injectRefreshBtn(card, word);
      }
    }
  }

  // 注入「🔄 用 Gemini 更新」按鈕
  function injectRefreshBtn(card, word) {
    if (card.querySelector('.gsync-btn')) return;  // 已注入

    var btnBar = card.querySelector('[class*="button"], [class*="action"], .btn-group') 
              || card.querySelector('button')?.parentElement;
    if (!btnBar) return;

    var btn = document.createElement('button');
    btn.className = 'gsync-btn';
    btn.textContent = '🔄 Gemini 更新';
    btn.style.cssText = 'background:#4dc9e6;color:#000;border:none;padding:6px 12px;' +
                       'border-radius:6px;cursor:pointer;font-size:12px;margin-left:6px';
    btn.onclick = async function (e) {
      e.stopPropagation();
      btn.textContent = '⏳ 查詢中...';
      btn.disabled = true;
      var entry = await syncWord(word, true);  // force = true
      if (entry) {
        rerenderCard(word, entry);
        btn.textContent = '✅ 已更新';
      } else {
        btn.textContent = '❌ 失敗';
      }
      setTimeout(function () {
        btn.textContent = '🔄 Gemini 更新';
        btn.disabled = false;
      }, 2000);
    };
    btnBar.appendChild(btn);
  }

  // ---- MutationObserver：偵測 Word Note 開啟 ----
  var processed = {};  // 避免重複處理同一個字

  function scanAndSync() {
    // 找 h1/h2 標題（Word Note 標題）
    var titles = document.querySelectorAll('h1, h2');
    for (var i = 0; i < titles.length; i++) {
      var titleText = titles[i].textContent && titles[i].textContent.trim();
      if (!titleText || titleText.length > 30 || !/^[a-zA-Z\-']+$/.test(titleText)) continue;

      var word = titleText.toLowerCase();
      var processKey = word + '_' + Math.floor(Date.now() / 60000);  // 每分鐘可再處理一次
      if (processed[processKey]) continue;
      processed[processKey] = 1;

      // 檢查有沒有「Auto translated by MyMemory」文字（舊資料標記）
      var card = titles[i].closest('div, section, article') || titles[i].parentElement;
      var cardText = card ? card.textContent : '';
      var hasOldData = /MyMemory|Auto translated/i.test(cardText);

      var db = getDB();
      var entry = db.learn && db.learn[word];

      if (hasOldData || !hasGeminiData(entry)) {
        console.log(TAG, '🎯 偵測到 Word Note 開啟: ' + word + '（需要 Gemini 同步）');
        (function (w, c) {
          syncWord(w, false).then(function (e) {
            if (e) rerenderCard(w, e);
          });
        })(word, card);
      } else {
        // 已有 Gemini 資料，直接重新渲染
        rerenderCard(word, entry);
      }
    }
  }

  var observer = new MutationObserver(function (mutations) {
    // 節流：500ms 內只掃一次
    if (observer._pending) return;
    observer._pending = setTimeout(function () {
      observer._pending = null;
      scanAndSync();
    }, 500);
  });

  // ---- 手動 API ----
  window.__geminiSync = {
    sync: syncWord,
    scan: scanAndSync,
    rerender: rerenderCard,
    // 批次同步 db.learn 所有字
    syncAll: async function (limit) {
      limit = limit || 10;
      var db = getDB();
      var words = Object.keys(db.learn || {}).filter(function (w) {
        return !hasGeminiData(db.learn[w]);
      }).slice(0, limit);
      console.log(TAG, '📚 批次同步 ' + words.length + ' 個字（限制 ' + limit + '）');
      for (var i = 0; i < words.length; i++) {
        console.log(TAG, (i+1) + '/' + words.length + ' ' + words[i]);
        await syncWord(words[i], false);
        await new Promise(function (r) { setTimeout(r, 1200); });
      }
      console.log(TAG, '✅ 批次完成');
    }
  };

  // ---- 啟動 ----
  function boot() {
    observer.observe(document.body, { childList: true, subtree: true });
    scanAndSync();  // 首次掃描
    console.log(TAG, 'ready', VER);
    console.log(TAG, '手動 API:');
    console.log(TAG, '  __geminiSync.sync("word")     - 同步單字');
    console.log(TAG, '  __geminiSync.syncAll(10)      - 批次同步 (限 10 字)');
    console.log(TAG, '  __geminiSync.scan()           - 手動掃描頁面');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
