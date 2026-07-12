/* article-full-translate-patch.js v20260712-5
   - 等 DOM ready 才建立
   - 建立失敗會重試
   - 被外部移除會 3 秒內自動重建
   - 大量 log 方便除錯
*/

(function () {

  'use strict';

  var AUDIO_BAR_SELECTOR = '#gcttsPanel';
  var FALLBACK_HEIGHT    = 60;
  var GAP                = 0;

  var API_KEY_STORAGE    = 'google_translate_api_key';
  var CACHE_STORAGE      = 'article_translation_cache_v1';
  var COLLAPSED_STORAGE  = 'article_translate_collapsed';

  function log() {
    try {
      console.log.apply(console, ['[FullTranslate]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getAudioBarHeight() {
    try {
      var el = document.querySelector(AUDIO_BAR_SELECTOR);
      if (!el) return FALLBACK_HEIGHT;
      var h = el.getBoundingClientRect().height;
      if (!h || h < 10) return FALLBACK_HEIGHT;
      return h;
    } catch (e) { return FALLBACK_HEIGHT; }
  }

  function getApiKey() { return localStorage.getItem(API_KEY_STORAGE) || ''; }

  function getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_STORAGE) || '{}'); }
    catch (e) { return {}; }
  }
  function setCache(c) { localStorage.setItem(CACHE_STORAGE, JSON.stringify(c)); }

  function hashText(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) {
      h = ((h << 5) - h) + text.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  async function googleTranslateBatch(texts) {
    var key = getApiKey();
    if (!key) { alert('請先在設定選單設定 Google Translate API Key'); return null; }

    try {
      var res = await fetch(
        'https://translation.googleapis.com/language/translate/v2?key=' + key,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: texts, source: 'en', target: 'zh-TW', format: 'text'
          })
        }
      );
      if (!res.ok) { log('translate http err:', res.status); return null; }
      var data = await res.json();
      if (!data || !data.data || !data.data.translations) return null;
      return data.data.translations.map(function (t) { return t.translatedText; });
    } catch (e) { log('translate err:', e.message); return null; }
  }

  function splitEnglishParagraphs(fullText) {
    var paras = fullText.split(/\n\s*\n/).filter(function (p) { return p.trim(); });
    if (paras.length === 1) {
      paras = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
      paras = paras.map(function (p) { return p.trim(); }).filter(function (p) { return p; });
    }
    return paras;
  }

  function getArticleText() {
    var article = document.querySelector('.card .en');
    if (!article) return null;
    var clone = article.cloneNode(true);
    clone.querySelectorAll('button, script').forEach(function (el) { el.remove(); });
    return (clone.innerText || clone.textContent || '').trim();
  }

  async function translateFullArticle() {
    var enText = getArticleText();
    if (!enText) { alert('沒有找到文章'); return null; }

    var enParas = splitEnglishParagraphs(enText);
    if (enParas.length === 0) { alert('文章沒有段落'); return null; }

    var hash = hashText(enText);
    var cache = getCache();
    if (cache[hash]) {
      log('using cache:', enParas.length);
      return { enParas: enParas, zhParas: cache[hash] };
    }

    log('translating', enParas.length, 'paragraphs...');
    var status = document.getElementById('translateStatus');
    if (status) status.textContent = '翻譯中...';

    var zhParas = await googleTranslateBatch(enParas);
    if (!zhParas) {
      if (status) status.textContent = '翻譯失敗';
      return null;
    }
    log('translated', zhParas.length);
    cache[hash] = zhParas;
    setCache(cache);
    if (status) status.textContent = '';
    return { enParas: enParas, zhParas: zhParas };
  }

  var currentTranslation = null;
  var syncEnabled = false;
  var isCollapsed = localStorage.getItem(COLLAPSED_STORAGE) === '1';

  function updateSyncState() {
    var btn = document.getElementById('syncToggleBtn');
    if (btn) {
      btn.textContent = syncEnabled ? '🔗 同步: 開' : '🔗 同步: 關';
      btn.style.background = syncEnabled ? '#a68a56' : '#666';
    }
  }

  function findCurrentParaIndex() {
    var audio = document.getElementById('__V5_MASTER_AUDIO__');
    if (!audio || !currentTranslation) return -1;
    var ct = audio.currentTime, du = audio.duration;
    if (!isFinite(ct) || !isFinite(du) || du <= 0) return -1;
    var idx = Math.floor((ct / du) * currentTranslation.enParas.length);
    return Math.min(currentTranslation.enParas.length - 1, Math.max(0, idx));
  }

  function scrollInContainer(el, container) {
    if (!el || !container) return;
    var cr = container.getBoundingClientRect();
    var er = el.getBoundingClientRect();
    var buf = 30;
    var rt = er.top - cr.top, rb = er.bottom - cr.top;
    if (rt < buf || rb > cr.height - buf) {
      var offset = el.offsetTop - (container.clientHeight / 2) + (el.clientHeight / 2);
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }

  function highlightSyncPara() {
    if (!syncEnabled || !currentTranslation) return;
    var idx = findCurrentParaIndex();
    if (idx < 0) return;
    var zhSide = document.getElementById('translateZhSide');
    if (!zhSide) return;
    zhSide.querySelectorAll('.zh-para').forEach(function (el, i) {
      if (i === idx) {
        el.style.background  = 'rgba(166, 138, 86, 0.20)';
        el.style.borderLeft  = '4px solid #a68a56';
        el.style.paddingLeft = '10px';
      } else {
        el.style.background  = '';
        el.style.borderLeft  = '3px solid transparent';
        el.style.paddingLeft = '11px';
      }
    });
    var cur = zhSide.querySelector('.zh-para[data-idx="' + idx + '"]');
    scrollInContainer(cur, zhSide);
  }

  function renderTranslation() {
    var zhSide = document.getElementById('translateZhSide');
    if (!zhSide || !currentTranslation) return;
    var html = '';
    currentTranslation.enParas.forEach(function (en, i) {
      var zh = currentTranslation.zhParas[i] || '(翻譯中)';
      var isLast = i === currentTranslation.enParas.length - 1;
      html += '<div class="zh-para" data-idx="' + i + '" style="' +
        'padding:10px 14px;margin-bottom:12px;border-left:3px solid transparent;' +
        'transition:background 0.3s,border-left-color 0.3s,padding-left 0.3s;' +
        'border-radius:3px;color:#333;font-size:14px;line-height:1.7;' +
        (isLast ? '' : 'border-bottom:1px dashed #d9cfbc;padding-bottom:14px;') +
        '">' + zh + '</div>';
    });
    zhSide.innerHTML = html;
  }

  function toggleCollapsed() {
    isCollapsed = !isCollapsed;
    localStorage.setItem(COLLAPSED_STORAGE, isCollapsed ? '1' : '0');
    updateCollapsedState();
  }

  function updateCollapsedState() {
    var box = document.getElementById('fullTranslateBox');
    var tb  = document.getElementById('translateCollapseBtn');
    var bd  = document.getElementById('translateBody');
    if (!box) return;
    if (isCollapsed) {
      box.style.maxHeight = '48px';
      if (bd) bd.style.display = 'none';
      if (tb) tb.textContent = '▲ 展開';
    } else {
      box.style.maxHeight = '60vh';
      if (bd) bd.style.display = 'flex';
      if (tb) tb.textContent = '▼ 收合';
    }
    updateBodyPadding();
  }

  function updateBodyPadding() {
    var box = document.getElementById('fullTranslateBox');
    if (!box) { document.body.style.paddingBottom = '0'; return; }
    var audioH = getAudioBarHeight();
    box.style.bottom = (audioH + GAP) + 'px';
    var rect = box.getBoundingClientRect();
    document.body.style.paddingBottom = (rect.height + audioH + GAP + 10) + 'px';
  }

  function createTranslateBox() {

    if (!document.body) { log('body not ready, skip'); return false; }
    if (document.getElementById('fullTranslateBox')) return true;

    log('creating box...');

    var audioH = getAudioBarHeight();

    var box = document.createElement('div');
    box.id = 'fullTranslateBox';
    box.style.cssText =
      'position:fixed;' +
      'bottom:' + (audioH + GAP) + 'px;' +
      'left:0;right:0;' +
      'z-index:2147483000;' +
      'background:#faf6ed;' +
      'border-top:2px solid #a68a56;' +
      'box-shadow:0 -4px 12px rgba(0,0,0,0.08);' +
      'font-family:"Microsoft JhengHei",sans-serif;' +
      'max-height:60vh;' +
      'display:flex;' +
      'flex-direction:column;' +
      'transition:max-height 0.3s,bottom 0.2s;' +
      'overflow:hidden;';

    box.innerHTML =
      '<div id="translateHeader" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #d9cfbc;flex-shrink:0;cursor:pointer;">' +
        '<div style="color:#a68a56;font-weight:bold;font-size:13px;display:flex;align-items:center;gap:8px;">' +
          '<span id="translateCollapseBtn" style="cursor:pointer;padding:4px 10px;user-select:none;font-size:14px;font-weight:bold;border-radius:6px;background:#eee7d8;">' +
          (isCollapsed ? '▲ 展開' : '▼ 收合') +
          '</span>' +
          '📖 中文翻譯' +
          '<span id="translateStatus" style="color:#888;font-size:11px;font-weight:normal;"></span>' +
        '</div>' +
        '<div style="display:flex;gap:4px;">' +
          '<button id="translateBtn" style="padding:4px 8px;background:#a68a56;color:white;border:none;border-radius:3px;cursor:pointer;font-size:11px;">翻譯全文</button>' +
          '<button id="syncToggleBtn" style="padding:4px 8px;background:#666;color:white;border:none;border-radius:3px;cursor:pointer;font-size:11px;">🔗 同步: 關</button>' +
          '<button id="translateClearBtn" style="padding:4px 8px;background:transparent;color:#999;border:1px solid #ccc;border-radius:3px;cursor:pointer;font-size:11px;">清除</button>' +
        '</div>' +
      '</div>' +
      '<div id="translateBody" style="flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;">' +
        '<div id="translateZhSide" style="flex:1;overflow-y:auto;padding:8px 12px;min-height:0;">' +
          '<div style="color:#999;padding:20px;text-align:center;font-size:12px;">點擊「翻譯全文」開始</div>' +
        '</div>' +
      '</div>';

    try {
      document.body.appendChild(box);
    } catch (e) {
      log('appendChild err:', e.message);
      return false;
    }

    var header = document.getElementById('translateHeader');
    if (header) {
      header.onclick = function (e) {
        if (e.target.closest('button')) return;
        toggleCollapsed();
      };
    }

    var tBtn = document.getElementById('translateBtn');
    if (tBtn) tBtn.onclick = async function (e) {
      e.stopPropagation();
      this.disabled = true;
      this.textContent = '翻譯中...';
      currentTranslation = await translateFullArticle();
      this.disabled = false;
      this.textContent = '重新翻譯';
      if (currentTranslation) renderTranslation();
    };

    var sBtn = document.getElementById('syncToggleBtn');
    if (sBtn) sBtn.onclick = function (e) {
      e.stopPropagation();
      syncEnabled = !syncEnabled;
      updateSyncState();
      if (syncEnabled) highlightSyncPara();
    };

    var cBtn = document.getElementById('translateClearBtn');
    if (cBtn) cBtn.onclick = function (e) {
      e.stopPropagation();
      currentTranslation = null;
      var zs = document.getElementById('translateZhSide');
      if (zs) zs.innerHTML =
        '<div style="color:#999;padding:20px;text-align:center;font-size:12px;">點擊「翻譯全文」開始</div>';
      document.getElementById('translateBtn').textContent = '翻譯全文';
      syncEnabled = false;
      updateSyncState();
    };

    log('box created OK, audioH =', audioH);

    updateCollapsedState();
    watchAudioPanel();

    if (currentTranslation) {
      renderTranslation();
      var b = document.getElementById('translateBtn');
      if (b) b.textContent = '重新翻譯';
    }
    return true;
  }

  function watchAudioPanel() {
    var panel = document.querySelector(AUDIO_BAR_SELECTOR);
    if (!panel || typeof ResizeObserver === 'undefined') return;
    try {
      var ro = new ResizeObserver(function () { updateBodyPadding(); });
      ro.observe(panel);
      log('watching', AUDIO_BAR_SELECTOR);
    } catch (e) { log('RO err:', e.message); }
  }

  function startSyncMonitor() {
    setInterval(function () {
      if (!syncEnabled || !currentTranslation) return;
      var a = document.getElementById('__V5_MASTER_AUDIO__');
      if (!a || a.paused) return;
      highlightSyncPara();
    }, 500);
  }

  function startWatchdog() {
    setInterval(function () {
      var box = document.getElementById('fullTranslateBox');
      if (!box) {
        log('box missing, recreating');
        createTranslateBox();
        return;
      }
      updateBodyPadding();
    }, 1500);
  }

  function boot() {
    log('boot v20260712-5');
    createTranslateBox();
    startSyncMonitor();
    startWatchdog();
    window.addEventListener('resize', updateBodyPadding);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
