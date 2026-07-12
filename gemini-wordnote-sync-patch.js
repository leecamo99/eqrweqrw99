/* gemini-wordnote-sync-patch.js  v20260713-4
   配色再優化：Gemini 按鈕改成跟其他按鈕一致的灰白色系
*/
(function () {
  'use strict';
  var TAG = '[GeminiSync]';
  var VER = 'v20260713-4';

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
    if (!force && hasGeminiData(entry)) return entry;
    console.log(TAG, '查詢 Gemini: ' + word);
    var gemini = await window.lookupWordWithGemini(word);
    if (!gemini) return null;
    return updateEntry(word, gemini);
  }

  // 🎨 暖色系
  var C = {
    primary: '#a68a56',
    bg: 'rgba(166,138,86,0.08)',
    bgLight: 'rgba(166,138,86,0.04)',
    text: '#555',
    textDim: '#888',
    textStrong: '#333'
  };

  function renderFlashA(entry) {
    var flashA = document.getElementById('flashA');
    if (!flashA || !entry) return false;

    var html = '';

    html += '<div style="font-size:16px;margin-bottom:10px;color:' + C.textStrong + '">';
    html +=   '<b style="color:' + C.primary + '">' + escapeHtml(entry.geminiPos || '') + '</b> ';
    html +=   escapeHtml(entry.geminiTw || '');
    if (entry.geminiPhonetic) {
      html += '<span style="color:' + C.textDim + ';font-size:12px;margin-left:8px">' + 
              escapeHtml(entry.geminiPhonetic) + '</span>';
    }
    html += '</div>';

    if (entry.geminiEx) {
      html += '<div style="color:' + C.text + ';font-size:13px;padding:8px 10px;' +
              'background:' + C.bg + ';border-left:3px solid ' + C.primary + ';' +
              'border-radius:3px;margin-bottom:4px">';
      html +=   '<b style="color:' + C.primary + '">例句</b> ' + escapeHtml(entry.geminiEx);
      if (entry.geminiTwEx) {
        html += '<div style="color:' + C.textStrong + ';margin-top:4px">' + escapeHtml(entry.geminiTwEx) + '</div>';
      }
      html += '</div>';
    }

    if (entry.geminiSynonyms && entry.geminiSynonyms.length) {
      html += '<div style="color:' + C.text + ';font-size:12px;margin-top:6px">';
      html +=   '<b style="color:' + C.primary + '">同義</b> ' + 
                entry.geminiSynonyms.map(escapeHtml).join(' · ');
      html += '</div>';
    }

    if (entry.geminiDerivatives && entry.geminiDerivatives.length) {
      html += '<div style="color:' + C.text + ';font-size:12px;margin-top:4px">';
      html +=   '<b style="color:' + C.primary + '">派生</b> ' + 
                entry.geminiDerivatives.map(escapeHtml).join(' · ');
      html += '</div>';
    }

    if (entry.geminiCollocations && entry.geminiCollocations.length) {
      html += '<div style="color:' + C.text + ';font-size:12px;margin-top:4px">';
      html +=   '<b style="color:' + C.primary + '">搭配</b> ' + 
                entry.geminiCollocations.map(escapeHtml).join(' · ');
      html += '</div>';
    }

    if (entry.geminiTip) {
      html += '<div style="color:' + C.text + ';font-size:12px;margin-top:6px;' +
              'padding:6px 10px;background:' + C.bgLight + ';border-radius:3px">';
      html +=   '💡 ' + escapeHtml(entry.geminiTip);
      html += '</div>';
    }

    html += '<div style="color:' + C.textDim + ';font-size:10px;margin-top:8px">';
    if (entry.geminiLevel) {
      html += '<span style="background:' + C.bg + ';color:' + C.primary + ';' +
              'padding:1px 8px;border-radius:3px;margin-right:6px;font-weight:bold">' + 
              escapeHtml(entry.geminiLevel) + '</span>';
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

  // 🎨 v20260713-4：Gemini 按鈕改成「複製其他按鈕的樣式」
  function injectRefreshBtn(word) {
    var flash = document.getElementById('flash');
    if (!flash) return;
    if (flash.querySelector('.gsync-btn')) return;

    var btns = flash.querySelectorAll('button');
    if (!btns.length) return;
    var btnBar = btns[0].parentElement;
    if (!btnBar) return;

    var btn = document.createElement('button');
    btn.className = 'gsync-btn';
    btn.textContent = '✨ Gemini';

    // 🎯 直接複製第一顆按鈕的所有 style / class → 完美融入
    // 先拷貝 class
    var refBtn = btns[0];
    btn.className = refBtn.className + ' gsync-btn';

    // 拷貝 computed style（挑重點）
    var refStyle = window.getComputedStyle(refBtn);
    btn.style.cssText = 
      'background:' + refStyle.background + ';' +
      'color:' + refStyle.color + ';' +
      'border:' + refStyle.border + ';' +
      'padding:' + refStyle.padding + ';' +
      'border-radius:' + refStyle.borderRadius + ';' +
      'font-size:' + refStyle.fontSize + ';' +
      'font-family:' + refStyle.fontFamily + ';' +
      'cursor:pointer;margin-left:4px';

    btn.onclick = async function (e) {
      e.stopPropagation();
      var origText = btn.textContent;
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
        btn.textContent = origText;
        btn.disabled = false;
      }, 2000);
    };
    btnBar.appendChild(btn);
  }

  var lastProcessedWord = '';

  function processFlashCard() {
    var flashQ = document.getElementById('flashQ');
    var flashA = document.getElementById('flashA');
    if (!flashQ || !flashA) return;

    var word = (flashQ.textContent || '').trim().toLowerCase();
    if (!word || !/^[a-z][a-z\-']*$/i.test(word)) return;
    if (word === lastProcessedWord) return;

    lastProcessedWord = word;
    console.log(TAG, '偵測 Flash Card: ' + word);

    var db = getDB();
    var entry = db.learn && db.learn[word];

    if (hasGeminiData(entry)) {
      renderFlashA(entry);
      injectRefreshBtn(word);
    } else {
      syncWord(word, false).then(function (e) {
        if (e) {
          renderFlashA(e);
          injectRefreshBtn(word);
        }
      });
      injectRefreshBtn(word);
    }
  }

  function boot() {
    processFlashCard();
    setInterval(function () { processFlashCard(); }, 800);

    var obs = new MutationObserver(function () { processFlashCard(); });
    obs.observe(document.body, { 
      childList: true, subtree: true, characterData: true 
    });

    console.log(TAG, 'ready', VER);
    console.log(TAG, '手動 API:');
    console.log(TAG, '  __geminiSync.sync("word", true)  - 強制同步');
    console.log(TAG, '  __geminiSync.syncAll(20)         - 批次同步');
    console.log(TAG, '  __geminiSync.rerender()          - 重新渲染');
  }

  window.__geminiSync = {
    sync: syncWord,
    render: renderFlashA,
    rerender: function () {
      lastProcessedWord = '';
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
