/* article-full-translate-patch.js v20260712-5
   Fixes:
   1. Google Translate 400 caused by too many q items.
   2. Filters numeric-only paragraphs such as "1.", "2.", "3.".
   3. Sanitizes undefined/null/empty strings before sending.
   4. Translates in batches to avoid request size limits.
   5. Keeps full-article Chinese translation panel, cache, collapse, sync toggle.
＊/

(function () {

  'use strict';

  var CACHE_STORAGE = 'article_full_translate_cache_v1';
  var COLLAPSED_STORAGE = 'article_full_translate_collapsed_v1';

  var currentTranslation = null;
  var syncEnabled = false;
  var isCollapsed = localStorage.getItem(COLLAPSED_STORAGE) === '1';
  var syncTimer = null;

  function log() {
    try {
      console.log.apply(console, ['[FullTranslate]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function esc(s) {
    return String(s || '').replace(/[<>&"']/g, function (c) {
      return {
        '<': '<',
        '>': '>',
        '&': '&',
        '"': '"',
        "'": '''
      }[c];
    });
  }

  function getApiKey() {
    return (
      localStorage.getItem('notebook_google_translate_key_v1') ||
      localStorage.getItem('google_translate_api_key') ||
      localStorage.getItem('notebook_google_translate_key') ||
      ''
    ).trim();
  }

  function getCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_STORAGE) || '{}');
      return c && typeof c === 'object' ? c : {};
    } catch (e) {
      return {};
    }
  }

  function setCache(c) {
    try {
      localStorage.setItem(CACHE_STORAGE, JSON.stringify(c || {}));
    } catch (e) {
      log('cache save failed:', e.message);
    }
  }

  function hashText(text) {
    text = String(text || '');
    var h = 0;
    for (var i = 0; i < text.length; i++) {
      h = ((h << 5) - h) + text.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  function cleanTextForTranslate(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function isNumberOnlyLine(s) {
    s = String(s || '').trim();
    return /^\d+[.)]?$/.test(s);
  }

  function isBadTranslateUnit(s) {
    s = String(s || '').trim();

    if (!s) return true;

    // 排除 1. 2. 3. 或 1) 這種獨立段號
    if (/^\d+[.)]?$/.test(s)) return true;

    // 排除單一符號
    if (/^[^\w\u4e00-\u9fff]+$/.test(s)) return true;

    return false;
  }

  function splitEnglishParagraphs(fullText) {

    fullText = cleanTextForTranslate(fullText);

    if (!fullText) return [];

    // 先用行處理，因為你的文章目前明顯變成：
    // 1.
    // Sentence
    // 2.
    // Sentence
    var rawLines = fullText
      .split(/\n+/)
      .map(function (x) { return cleanTextForTranslate(x); })
      .filter(Boolean);

    var lines = [];

    rawLines.forEach(function (line) {
      if (isNumberOnlyLine(line)) return;

      // 有些行會是 "1. The sentence..."，移掉前面的段號
      line = line.replace(/^\d+[.)]\s+/, '').trim();

      if (!isBadTranslateUnit(line)) {
        lines.push(line);
      }
    });

    // 如果行數很多，直接用行當 paragraph，比正則拆句安全
    if (lines.length >= 2) {
      return lines;
    }

    // fallback：用空白段落切
    var paras = fullText
      .split(/\n\s\n/)
      .map(function (p) { return cleanTextForTranslate(p); })
      .filter(Boolean)
      .filter(function (p) { return !isBadTranslateUnit(p); });

    if (paras.length > 1) return paras;

    // 最後 fallback：用句號、問號、驚嘆號切句
    paras = (fullText.match(/[^.!?]+[.!?]+/g) || [fullText])
      .map(function (p) { return cleanTextForTranslate(p); })
      .filter(Boolean)
      .map(function (p) { return p.replace(/^\d+[.)]\s*/, '').trim(); })
      .filter(function (p) { return !isBadTranslateUnit(p); });

    return paras;
  }

  function getArticleText() {
    var article = document.querySelector('.card .en');

    if (!article) {
      article = document.querySelector('.en');
    }

    if (!article) return null;

    var clone = article.cloneNode(true);

    clone.querySelectorAll('button, script, style').forEach(function (el) {
      el.remove();
    });

    // 避免抓到隱藏控制元素
    clone.querySelectorAll('[aria-hidden="true"], .hidden, .btn').forEach(function (el) {
      el.remove();
    });

    return cleanTextForTranslate(clone.innerText || clone.textContent || '');
  }

  async function googleTranslateOneBatch(chunk, key, offset) {

    var res = await fetch(
      'https://translation.googleapis.com/language/translate/v2?key=' + encodeURIComponent(key),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: chunk,
          source: 'en',
          target: 'zh-TW',
          format: 'text'
        })
      }
    );

    if (!res.ok) {
      var errText = await res.text();

      console.error(
        '[FullTranslate] batch fail offset=' + offset,
        'status=' + res.status,
        errText
      );

      throw new Error('Google Translate HTTP ' + res.status);
    }

    var data = await res.json();

    if (!data || !data.data || !data.data.translations) {
      throw new Error('Google Translate empty response');
    }

    return data.data.translations.map(function (t) {
      return t.translatedText || '';
    });
  }

  async function googleTranslateBatch(texts) {

    var key = getApiKey();

    if (!key) {
      alert('請先在設定選單設定 Google Translate API Key');
      return null;
    }

    texts = (texts || [])
      .map(function (x) { return cleanTextForTranslate(x); })
      .filter(function (x) { return !isBadTranslateUnit(x); });

    log('clean texts:', texts.length);
    console.log('[FullTranslate] first 5 clean texts =', texts.slice(0, 5));

    if (!texts.length) return [];

    /*
      Google Translate v2 支援 q 陣列，但一次送太多容易 400。
      這裡用 45 筆一批，比 50 更保守。
    */
    var BATCH_SIZE = 45;
    var allResults = [];

    for (var i = 0; i < texts.length; i += BATCH_SIZE) {

      var chunk = texts.slice(i, i + BATCH_SIZE);

      log('translate batch', (i / BATCH_SIZE) + 1, 'items:', chunk.length);

      try {
        var translated = await googleTranslateOneBatch(chunk, key, i);
        allResults = allResults.concat(translated);
      } catch (e) {
        log('translate batch err:', e.message);
        return null;
      }
    }

    return allResults;
  }

  async function translateFullArticle() {

    var enText = getArticleText();

    if (!enText) {
      alert('沒有找到文章');
      return null;
    }

    var enParas = splitEnglishParagraphs(enText);

    if (enParas.length === 0) {
      alert('文章沒有可翻譯段落');
      return null;
    }

    var hash = hashText(enText + '::v5');
    var cache = getCache();

    if (cache[hash] && Array.isArray(cache[hash]) && cache[hash].length === enParas.length) {
      log('using cache:', enParas.length);
      return {
        enParas: enParas,
        zhParas: cache[hash]
      };
    }

    if (cache[hash] && cache[hash].length !== enParas.length) {
      log('cache length mismatch, ignore cache');
      delete cache[hash];
      setCache(cache);
    }

    log('translating', enParas.length, 'paragraphs...');

    var status = document.getElementById('translateStatus');

    if (status) {
      status.textContent = '翻譯中...';
    }

    var zhParas = await googleTranslateBatch(enParas);

    if (!zhParas) {
      if (status) status.textContent = '翻譯失敗';
      return null;
    }

    if (zhParas.length !== enParas.length) {
      console.error('[FullTranslate] length mismatch', enParas.length, zhParas.length);
      if (status) status.textContent = '翻譯段落數不一致';
      return null;
    }

    log('translated', zhParas.length);

    cache[hash] = zhParas;
    setCache(cache);

    if (status) {
      status.textContent = '';
    }

    return {
      enParas: enParas,
      zhParas: zhParas
    };
  }

  function ensurePanel() {

    var box = document.getElementById('fullTranslateBox');

    if (box) return box;

    box = document.createElement('div');
    box.id = 'fullTranslateBox';

    box.style.cssText = [
      'position:fixed',
      'left:0',
      'right:0',
      'bottom:30px',
      'z-index:2147483000',
      'background:#faf6ed',
      'border-top:1px solid #c9bfae',
      'box-shadow:0 -6px 18px rgba(0,0,0,.18)',
      'font-family:Segoe UI, Microsoft JhengHei, sans-serif',
      'color:#2b2b2b',
      'display:none',
      'max-height:40vh',
      'overflow:hidden'
    ].join(';');

    box.innerHTML =
      '<div id="fullTranslateHeader" style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#e8dfc7;border-bottom:1px solid #c9bfae;font-size:12px">' +
        '<b style="color:#34495e">中文翻譯</b>' +
        '<span id="translateStatus" style="color:#7a7367"></span>' +
        '<button id="syncToggleBtn" style="margin-left:auto;padding:3px 8px;border:0;background:#666;color:white;border-radius:3px;cursor:pointer;font-size:12px">🔗 同步: 關</button>' +
        '<button id="collapseTranslateBtn" style="padding:3px 8px;border:1px solid #aaa;background:transparent;border-radius:3px;cursor:pointer;font-size:12px">收合</button>' +
        '<button id="closeTranslateBtn" style="padding:3px 8px;border:1px solid #aaa;background:transparent;border-radius:3px;cursor:pointer;font-size:12px">×</button>' +
      '</div>' +
      '<div id="fullTranslateContent" style="overflow:auto;max-height:calc(40vh - 40px);padding:10px 14px;font-size:14px;line-height:1.7"></div>';

    document.body.appendChild(box);

    document.getElementById('closeTranslateBtn').onclick = function () {
      box.style.display = 'none';
      stopSyncTimer();
    };

    document.getElementById('collapseTranslateBtn').onclick = function () {
      isCollapsed = !isCollapsed;
      localStorage.setItem(COLLAPSED_STORAGE, isCollapsed ? '1' : '0');
      applyCollapsedState();
    };

    document.getElementById('syncToggleBtn').onclick = function () {
      syncEnabled = !syncEnabled;
      updateSyncState();
      if (syncEnabled) startSyncTimer();
      else stopSyncTimer();
    };

    applyCollapsedState();
    updateSyncState();

    return box;
  }

  function applyCollapsedState() {

    var content = document.getElementById('fullTranslateContent');
    var btn = document.getElementById('collapseTranslateBtn');
    var box = document.getElementById('fullTranslateBox');

    if (!content || !btn || !box) return;

    if (isCollapsed) {
      content.style.display = 'none';
      box.style.maxHeight = '48px';
      btn.textContent = '展開';
    } else {
      content.style.display = 'block';
      box.style.maxHeight = '40vh';
      btn.textContent = '收合';
    }
  }

  function updateSyncState() {

    var btn = document.getElementById('syncToggleBtn');

    if (!btn) return;

    btn.textContent = syncEnabled ? '🔗 同步: 開' : '🔗 同步: 關';
    btn.style.background = syncEnabled ? '#a68a56' : '#666';
  }

  function renderTranslation(result) {

    if (!result) return;

    currentTranslation = result;

    var box = ensurePanel();
    var content = document.getElementById('fullTranslateContent');

    if (!content) return;

    content.innerHTML = result.zhParas.map(function (zh, i) {
      return '<div class="zhPara" data-idx="' + i + '" style="padding:7px 8px;margin-bottom:6px;border-left:3px solid transparent;background:rgba(255,255,255,.45);border-radius:4px">' +
        '<div style="font-size:11px;color:#999;margin-bottom:2px">#' + (i + 1) + '</div>' +
        '<div>' + esc(zh) + '</div>' +
      '</div>';
    }).join('');

    box.style.display = 'block';

    applyCollapsedState();
  }

  function findCurrentParaIndex() {

    if (!currentTranslation || !currentTranslation.enParas) return -1;

    var article = document.querySelector('.card .en');
    if (!article) return -1;

    var rects = [];
    var ps = article.querySelectorAll('p');

    ps.forEach(function (p, i) {
      var r = p.getBoundingClientRect();
      rects.push({
        i: i,
        top: r.top,
        bottom: r.bottom
      });
    });

    if (!rects.length) return -1;

    var center = window.innerHeight * 0.45;
    var best = rects[0];
    var bestDist = Math.abs(((best.top + best.bottom) / 2) - center);

    rects.forEach(function (r) {
      var mid = (r.top + r.bottom) / 2;
      var d = Math.abs(mid - center);
      if (d < bestDist) {
        best = r;
        bestDist = d;
      }
    });

    return Math.min(best.i, currentTranslation.zhParas.length - 1);
  }

  function highlightTranslation(index) {

    var content = document.getElementById('fullTranslateContent');
    if (!content) return;

    content.querySelectorAll('.zhPara').forEach(function (el) {
      el.style.borderLeftColor = 'transparent';
      el.style.background = 'rgba(255,255,255,.45)';
    });

    var target = content.querySelector('.zhPara[data-idx="' + index + '"]');

    if (target) {
      target.style.borderLeftColor = '#a68a56';
      target.style.background = '#fff6df';
      target.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }

  function startSyncTimer() {

    stopSyncTimer();

    syncTimer = setInterval(function () {
      if (!syncEnabled || !currentTranslation) return;
      var idx = findCurrentParaIndex();
      if (idx >= 0) highlightTranslation(idx);
    }, 500);
  }

  function stopSyncTimer() {

    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  function addButton() {

    if (document.getElementById('fullTranslateBtn')) return;

    var editBtn = document.getElementById('articleEditBtn');
    var anchor = editBtn || document.querySelector('#head') || document.querySelector('#view');

    if (!anchor) return;

    var btn = document.createElement('button');
    btn.id = 'fullTranslateBtn';
    btn.className = 'btn';
    btn.textContent = '🌏 中文翻譯';
    btn.style.marginLeft = '6px';

    btn.onclick = async function () {
      var result = await translateFullArticle();
      if (result) renderTranslation(result);
    };

    if (editBtn && editBtn.parentNode) {
      editBtn.parentNode.insertBefore(btn, editBtn.nextSibling);
    } else {
      anchor.appendChild(btn);
    }

    log('button added');
  }

  function clearTranslateCache() {
    localStorage.removeItem(CACHE_STORAGE);
    log('cache cleared');
  }

  window.translateFullArticle = translateFullArticle;
  window.clearFullTranslateCache = clearTranslateCache;

  setInterval(addButton, 1000);
  setTimeout(addButton, 500);

  log('ready v20260712-5');

})();
