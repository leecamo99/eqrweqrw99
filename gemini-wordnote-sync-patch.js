/* gemini-wordnote-sync-patch.js  v20260713-2
   針對 Flash Card UI 的 Word Note ↔ Gemini 同步 patch
   目標元素：
   - #flashQ = 單字標題
   - #flashA = 答案容器（要覆寫這個）
   - #flash = 整張卡片

   功能：
   1) 監聽 #flashQ 文字變化 → 抓到單字 → 查 Gemini
   2) 覆寫 #flashA 為 Gemini 版顯示
   3) 保留原本按鈕列
   4) 加「🔄 Gemini 更新」按鈕
   5) 存回 db.learn 供其他頁面使用
*/
(function () {
  'use strict';
  var TAG = '[GeminiSync]';
  var VER = 'v20260713-2';

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

  function updateEntry(word, gemini) {
    var db = getDB();
    if (!db.learn) db.learn = {};
    var entry = db.learn[word] || {};

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
    entry.geminiRaw = gemini;

    db.learn[word] = entry;
    saveDB(db);
    console.log(TAG, 'db.learn[' + word + '] 已更新');
    return entry;
  }

  async function syncWord(word, force) {
    if (!word) return null;
    if (typeof window.lookupWordWithGemini !== 'function') {
      console.warn(TAG, 'lookupWordWithGemini 未載入');
      return null;
    }

    var db = getDB();
    var entry = db.learn && db.learn[word];

    if (!force && hasGeminiData(entry)) {
      console.log(TAG, word + ' 已有 Gemini 資料');
      return entry;
    }

    console.log(TAG, '查詢 Gemini: ' + word);
    var gemini = await window.lookupWordWithGemini(word);
    if (!gemini) {
      console.warn(TAG, word + ' 查詢失敗');
      return null;
    }

    return updateEntry(word, gemini);
  }

  // ⭐ 重新渲染 #flashA 內容
  function renderFlashA(entry) {
    var flashA = document.getElementById('flashA');
    if (!flashA || !entry) return false;

    var html = '';

    // 詞性 + 中文 + 音標
    html += '<div style="font-size:16px;margin-bottom:10px">';
    html +=   '<b style="color:#4dc9e6">' + escapeHtml(entry.geminiPos || '') + '</b> ';
    html +=   escapeHtml(entry.geminiTw || '');
    if (entry.geminiPhonetic) {
      html += '<span style="color:#888;font-size:12px;margin-left:8px">' + 
              escapeHtml(entry.geminiPhonetic) + '</span>';
    }
    html += '</div>';

    // 例句
    if (entry.geminiEx) {
      html += '<div style="color:#555;font-size:13px;padding:8px 10px;' +
              'background:rgba(77,201,230,0.08);border-left:3px solid #4dc9e6;' +
              'border-radius:3px;margin-bottom:4px">';
      html +=   '<b style="color:#4dc9e6">例句</b> ' + escapeHtml(entry.geminiEx);
      if (entry.geminiTwEx) {
        html += '<div style="color:#333;margin-top:4px">' + escapeHtml(entry.geminiTwEx) + '</div>';
      }
      html += '</div>';
    }

    // 同義字（如果有）
    if (entry.geminiSynonyms && entry.geminiSynonyms.length) {
      html += '<div style="color:#666;font-size:12px;margin-top:6px">';
      html +=   '<b style="color:#a68a56">同義</b> ' + 
                entry.geminiSynonyms.map(escapeHtml).join(' · ');
      html += '</div>';
    }

    // 派生字（如果有）
    if (entry.geminiDerivatives && entry.geminiDerivatives.length) {
      html += '<div style="color:#666;font-size:12px;margin-top:4px">';
      html +=   '<b style="color:#a68a56">派生</b> ' + 
                entry.geminiDerivatives.map(escapeHtml).join(' · ');
      html += '</div>';
    }

    // 常見搭配（如果有）
    if (entry.geminiCollocations && entry.geminiCollocations.length) {
      html += '<div style="color:#666;font-size:12px;margin-top:4px">';
      html +=   '<b style="color:#a68a56">搭配</b> ' + 
                entry.geminiCollocations.map(escapeHtml).join(' · ');
      html += '</div>';
    }

    // 記憶技巧（如果有）
    if (entry.geminiTip) {
      html += '<div style="color:#555;font-size:12px;margin-top:6px;' +
              'padding:6px 10px;background:rgba(166,138,86,0.08);border-radius:3px">';
      html +=   '💡 ' + escapeHtml(entry.geminiTip);
      html += '</div>';
    }

    // Level + 時間戳
    html += '<div style="color:#8f8;font-size:10px;margin-top:8px">';
    if (entry.geminiLevel) {
      html += '<span style="background:#4dc9e6;color:#000;padding:1px 6px;' +
              'border-radius:3px;margin-right:6px">' + escapeHtml(entry.geminiLevel) + '</span>';
    }
    html += '✨ Gemini · ' + new Date(entry.geminiUpdatedAt || Date.now()).toLocaleString('zh-TW');
    html += '</div>';

    flashA.innerHTML = html;
    return true;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ⭐ 注入「Gemini 更新」按鈕
  function injectRefreshBtn(word) {
    var flash = document.getElementById('flash');
    if (!flash) return;
    if (flash.querySelector('.gsync-btn')) return;

    // 找按鈕列（通常有「發音、看答案、還不熟」等）
    var btns = flash.querySelectorAll('button');
    if (!btns.length) return;
    var btnBar = btns[0].parentElement;
    if (!btnBar) return;

    var btn = document.createElement('button');
    btn.className = 'gsync-btn';
    btn.textContent = '🔄 Gemini';
    btn.style.cssText = 'background:#4dc9e6;color:#000;border:none;padding:6px 10px;' +
                       'border-radius:4px;cursor:pointer;font-size:12px;margin-left:4px';
    btn.onclick = async function (e) {
      e.stopPropagation();
      btn.textContent = '⏳';
      btn.disabled = true;
      var entry = await syncWord(word, true);
      if (entry) {
        renderFlashA(entry);
        btn.textContent = '✅';
      } else {
        btn.textContent = '❌';
      }
      setTimeout(function () {
        btn.textContent = '🔄 Gemini';
        btn.disabled = false;
      }, 2000);
    };
    btnBar.appendChild(btn);
  }

  // ⭐ 主處理：偵測 #flashQ 有值時
  var lastProcessedWord = '';

  function processFlashCard() {
    var flashQ = document.getElementById('flashQ');
    var flashA = document.getElementById('flashA');
    if (!flashQ || !flashA) return;

    var word = (flashQ.textContent || '').trim().toLowerCase();
    if (!word || !/^[a-z][a-z\-']*$/i.test(word)) return;
    if (word === lastProcessedWord) return;  // 避免重複處理

    lastProcessedWord = word;
    console.log(TAG, '偵測 Flash Card: ' + word);

    var db = getDB();
    var entry = db.learn && db.learn[word];

    if (hasGeminiData(entry)) {
      // 已有 Gemini 資料，直接渲染
      console.log(TAG, '使用已有 Gemini 資料');
      renderFlashA(entry);
      injectRefreshBtn(word);
    } else {
      // 沒有 → 查 Gemini
      console.log(TAG, '需要查詢 Gemini');
      syncWord(word, false).then(function (e) {
        if (e) {
          renderFlashA(e);
          injectRefreshBtn(word);
        }
      });
      // 先注入按鈕（就算還沒查完）
      injectRefreshBtn(word);
    }
  }

  // ⭐ MutationObserver 監聽 #flashQ 變化
  function boot() {
    // 首次執行
    processFlashCard();

    var flash = document.getElementById('flash');
    if (!flash) {
      // Flash 卡片還沒渲染，全域監聽
      var globalObs = new MutationObserver(function () {
        if (document.getElementById('flashQ')) {
          processFlashCard();
        }
      });
      globalObs.observe(document.body, { childList: true, subtree: true });
    }

    // 監聽 #flashQ 文字變化（換下一個字時）
    var localObs = new MutationObserver(function () {
      processFlashCard();
    });

    // 用計時器保險，每 800ms 檢查一次
    setInterval(function () {
      processFlashCard();
    }, 800);

    // 立刻掛載到 body（因為 #flash 可能被重建）
    localObs.observe(document.body, { 
      childList: true, 
      subtree: true, 
      characterData: true 
    });

    console.log(TAG, 'ready', VER);
    console.log(TAG, '手動 API:');
    console.log(TAG, '  __geminiSync.sync("word", true)  - 強制同步單字');
    console.log(TAG, '  __geminiSync.syncAll(20)         - 批次同步');
    console.log(TAG, '  __geminiSync.rerender()          - 手動重新渲染當前卡片');
  }

  // ---- 手動 API ----
  window.__geminiSync = {
    sync: syncWord,
    render: renderFlashA,
    rerender: function () {
      lastProcessedWord = '';  // 重置
      processFlashCard();
    },
    syncAll: async function (limit) {
      limit = limit || 10;
      var db = getDB();
      var words = Object.keys(db.learn || {}).filter(function (w) {
        return !hasGeminiData(db.learn[w]);
      }).slice(0, limit);
      console.log(TAG, '批次同步 ' + words.length + ' 字');
      for (var i = 0; i < words.length; i++) {
        console.log(TAG, (i+1) + '/' + words.length + ' ' + words[i]);
        await syncWord(words[i], false);
        await new Promise(function (r) { setTimeout(r, 1200); });
      }
      console.log(TAG, '✅ 批次完成');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
