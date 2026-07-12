/* article-full-translate-patch.js v20260712-3
   保守版：不自動偵測音訊列
   若翻譯列被音訊列蓋住，改最上面 AUDIO_BAR_HEIGHT 的數字即可
/

(function () {

  'use strict';

  / ====== 你可以調整這裡 ====== /
  var AUDIO_BAR_HEIGHT = 60;   // 音訊列高度（px）。被蓋住就調大，例如 70、80
  / =========================== /

  var API_KEY_STORAGE   = 'google_translate_api_key';
  var CACHE_STORAGE     = 'article_translation_cache_v1';
  var COLLAPSED_STORAGE = 'article_translate_collapsed';

  function log() {
    try {
      console.log.apply(console, ['[FullTranslate]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getApiKey() { return localStorage.getItem(API_KEY_STORAGE) || ''; }

  function getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_STORAGE) || '{}'); }
    catch (e) { return {}; }
  }

  function setCache(c) {
    localStorage.setItem(CACHE_STORAGE, JSON.stringify(c));
  }

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
    if (!key) {
      alert('請先在設定選單設定 Google Translate API Key');
      return null;
    }

    try {

      var res = await fetch(
        'https://translation.googleapis.com/language/translate/v2?key=' + key,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: texts,
            source: 'en',
            target: 'zh-TW',
            format: 'text'
          })
        }
      );

      if (!res.ok) {
        log('Google translate err:', res.status);
        return null;
      }

      var data = await res.json();
      if (!data || !data.data || !data.data.translations) return null;

      return data.data.translations.map(function (t) { return t.translatedText; });

    } catch (e) {
      log('err:', e.message);
      return null;
    }
  }

  function splitEnglishParagraphs(fullText) {

    var paras = fullText.split(/\n\s\n/).filter(function (p) { return p.trim(); });

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

    var text = clone.innerText || clone.textContent || '';
    return text.trim();
  }

  async function translateFullArticle() {

    var enText = getArticleText();
    if (!enText) { alert('沒有找到文章'); return null; }

    var enParas = splitEnglishParagraphs(enText);
    if (enParas.length === 0) { alert('文章沒有段落'); return null; }

    var hash  = hashText(enText);
    var cache = getCache();

    if (cache[hash]) {
      log('using cache:', enParas.length, 'paragraphs');
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

    log('translated', zhParas.length, 'paragraphs');

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

    var audio = document.getElementById('V5_MASTER_AUDIO');
    if (!audio || !currentTranslation) return -1;

    var currentTime = audio.currentTime;
    var duration    = audio.duration;

    if (!isFinite(currentTime) || !isFinite(duration) || duration <= 0) return -1;

    var ratio = currentTime / duration;
    var idx   = Math.floor(ratio * currentTranslation.enParas.length);

    return Math.min(currentTranslation.enParas.length - 1, Math.max(0, idx));
  }

  function scrollInContainer(el, container) {

    if (!el || !container) return;

    var containerRect = container.getBoundingClientRect();
    var elRect        = el.getBoundingClientRect();

    var buffer    = 30;
    var relTop    = elRect.top    - containerRect.top;
    var relBottom = elRect.bottom - containerRect.top;

    if (relTop < buffer || relBottom > containerRect.height - buffer) {
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
        el.style.background   = 'rgba(166, 138, 86, 0.20)';
        el.style.borderLeft   = '4px solid #a68a56';
        el.style.paddingLeft  = '10px';
      } else {
        el.style.background   = '';
        el.style.borderLeft   = '3px solid transparent';
        el.style.paddingLeft  = '11px';
      }
    });

    var currentZh = zhSide.querySelector('.zh-para[data-idx="' + idx + '"]');
    scrollInContainer(currentZh, zhSide);
  }

  function renderTranslation() {

    var zhSide = document.getElementById('translateZhSide');
    if (!zhSide || !currentTranslation) return;

    var html = '';

    currentTranslation.enParas.forEach(function (en, i) {

      var zh     = currentTranslation.zhParas[i] || '(翻譯中)';
      var isLast = i === currentTranslation.enParas.length - 1;

      html += '<div class="zh-para" data-idx="' + i + '" style="' +
        'padding: 10px 14px;' +
        'margin-bottom: 12px;' +
        'border-left: 3px solid transparent;' +
        'transition: background 0.3s, border-left-color 0.3s, padding-left 0.3s;' +
        'border-radius: 3px;' +
        'color: #333;' +
        'font-size: 14px;' +
        'line-height: 1.7;' +
        (isLast ? '' : 'border-bottom: 1px dashed #d9cfbc; padding-bottom: 14px;') +
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

    var box       = document.getElementById('fullTranslateBox');
    var toggleBtn = document.getElementById('translateCollapseBtn');
    var body      = document.getElementById('translateBody');

    if (!box) return;

    if (isCollapsed) {
      box.style.maxHeight = '48px';
      if (body)      body.style.display    = 'none';
      if (toggleBtn) toggleBtn.textContent = '▲ 展開';
    } else {
      box.style.maxHeight = '60vh';
      if (body)      body.style.display    = 'flex';
      if (toggleBtn) toggleBtn.textContent = '▼ 收合';
    }

    updateBodyPadding();
  }

  function updateBodyPadding() {

    var box = document.getElementById('fullTranslateBox');
    if (!box) {
      document.body.style.paddingBottom = '0';
      return;
    }

    var rect = box.getBoundingClientRect();
    document.body.style.paddingBottom = (rect.height + AUDIO_BAR_HEIGHT + 10) + 'px';
  }

  function createTranslateBox() {

    if (document.getElementById('fullTranslateBox')) return;

    var box = document.createElement('div');
    box.id = 'fullTranslateBox';

    box.style.position      = 'fixed';
    box.style.bottom        = AUDIO_BAR_HEIGHT + 'px';   // ← 疊在音訊列上方
    box.style.left          = '0';
    box.style.right         = '0';
    box.style.zIndex        = '2147483000';              // ← 蓋過所有東西
    box.style.background    = '#faf6ed';
    box.style.borderTop     = '2px solid #a68a56';
    box.style.boxShadow     = '0 -4px 12px rgba(0,0,0,0.08)';
    box.style.fontFamily    = '"Microsoft JhengHei", sans-serif';
    box.style.maxHeight     = '60vh';
    box.style.display       = 'flex';
    box.style.flexDirection = 'column';
    box.style.transition    = 'max-height 0.3s';
    box.style.overflow      = 'hidden';

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
          '<div style="color:#999;padding:20px;text-align:center;font-size:12px;">' +
            '點擊「翻譯全文」開始' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(box);

    var header = document.getElementById('translateHeader');
    header.onclick = function (e) {
      var btn = e.target.closest('button');
      if (btn) return;
      toggleCollapsed();
    };

    document.getElementById('translateBtn').onclick = async function (e) {
      e.stopPropagation();
      var btn = this;
      btn.disabled = true;
      btn.textContent = '翻譯中...';
      currentTranslation = await translateFullArticle();
      btn.disabled = false;
      btn.textContent = '重新翻譯';
      if (currentTranslation) renderTranslation();
    };

    document.getElementById('syncToggleBtn').onclick = function (e) {
      e.stopPropagation();
      syncEnabled = !syncEnabled;
      updateSyncState();
      if (syncEnabled) highlightSyncPara();
    };

    document.getElementById('translateClearBtn').onclick = function (e) {
      e.stopPropagation();
      currentTranslation = null;
      var zhSide = document.getElementById('translateZhSide');
      if (zhSide) {
        zhSide.innerHTML =
          '<div style="color:#999;padding:20px;text-align:center;font-size:12px;">' +
            '點擊「翻譯全文」開始' +
          '</div>';
      }
      document.getElementById('translateBtn').textContent = '翻譯全文';
      syncEnabled = false;
      updateSyncState();
    };

    log('translate box created');

    updateCollapsedState();

    if (currentTranslation) {
      renderTranslation();
      document.getElementById('translateBtn').textContent = '重新翻譯';
    }
  }

  function startSyncMonitor() {
    setInterval(function () {
      if (!syncEnabled) return;
      if (!currentTranslation) return;
      var audio = document.getElementById('V5_MASTER_AUDIO');
      if (!audio || audio.paused) return;
      highlightSyncPara();
    }, 500);
  }

  function startWatchdog() {
    setInterval(function () {
      if (!document.getElementById('fullTranslateBox')) {
        log('box missing, recreating...');
        createTranslateBox();
      }
      updateBodyPadding();
    }, 1000);
  }

  createTranslateBox();
  startSyncMonitor();
  startWatchdog();

  window.addEventListener('resize', updateBodyPadding);

  log('ready v20260712-3');

})();
