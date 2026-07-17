/* article-full-translate-patch.js v20260718-3
   - 精簡文字：📖 中文翻譯 → 中譯 / 重新翻譯 → 重翻 / 🔗 同步 → 同步
   - 字級 (− / +) 10~24px
   - 高度單鍵循環 (− = ≡) → 20 / 35 / 45vh
   - 完全事件驅動，無 MutationObserver
*/

(function () {

  'use strict';

  var API_KEY_STORAGE   = 'google_translate_api_key';
  var CACHE_STORAGE     = 'article_translation_cache_v1';
  var COLLAPSED_STORAGE = 'article_translate_collapsed';
  var FONT_STORAGE      = 'article_translate_font_px';
  var HEIGHT_STORAGE    = 'article_translate_height_vh';

  var HEIGHT_CYCLE = [
    { vh: 20, icon: '−', title: '小 (下一段：中)' },
    { vh: 35, icon: '=', title: '中 (下一段：大)' },
    { vh: 45, icon: '≡', title: '大 (下一段：小)' }
  ];

  var currentTranslation = null;
  var syncEnabled = false;
  var isCollapsed = localStorage.getItem(COLLAPSED_STORAGE) === '1';

  var fontPx   = clamp(parseInt(localStorage.getItem(FONT_STORAGE)   || '14', 10), 10, 24);
  var heightVh = clamp(parseInt(localStorage.getItem(HEIGHT_STORAGE) || '35', 10), 20, 80);

  function clamp(v, min, max) {
    if (isNaN(v)) v = min;
    return Math.max(min, Math.min(max, v));
  }

  function currentHeightIdx() {
    if (heightVh <= 25) return 0;
    if (heightVh <= 40) return 1;
    return 2;
  }

  function log() {
    try { console.log.apply(console, ['[FullTranslate]'].concat([].slice.call(arguments))); } catch (e) {}
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

  function getArticleText() {
    var article = document.querySelector('.card .en');
    if (!article) return null;
    var clone = article.cloneNode(true);
    clone.querySelectorAll('button, script').forEach(function (el) { el.remove(); });
    var text = clone.innerText || clone.textContent || '';
    return text.trim();
  }

  function splitEnglishParagraphs(fullText) {
    if (!fullText) return [];
    var text = String(fullText || '');
    text = text.replace(/[\u00a0\u2028\u2029\r]/g, ' ');

    var re = /(\d+)\.\s/g;
    var positions = [];
    var m;
    while ((m = re.exec(text)) !== null) positions.push(m.index);

    if (positions.length < 2) {
      var lines = text.split('\n').map(function (l) { return String(l || '').trim(); }).filter(Boolean);
      if (lines.length > 1) return lines;
      var sentences = text.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 1) {
        return sentences.map(function (s) { return s.trim(); }).filter(Boolean);
      }
      return [text.trim()];
    }

    var paras = [];
    var before = text.slice(0, positions[0]).trim();
    if (before) paras.push(before);
    for (var i = 0; i < positions.length; i++) {
      var start = positions[i];
      var end = i + 1 < positions.length ? positions[i + 1] : text.length;
      var seg = text.slice(start, end).trim();
      if (seg) paras.push(seg);
    }
    return paras;
  }

  async function googleTranslateBatch(texts) {
    var key = getApiKey();
    if (!key) { alert('請先在設定選單設定 Google Translate API Key'); return null; }

    texts = (texts || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    var BATCH_SIZE = 40;
    var allResults = [];

    try {
      for (var i = 0; i < texts.length; i += BATCH_SIZE) {
        var chunk = texts.slice(i, i + BATCH_SIZE);
        var res = await fetch(
          'https://translation.googleapis.com/language/translate/v2?key=' + key,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: chunk, source: 'en', target: 'zh-TW', format: 'text' })
          }
        );
        if (!res.ok) { var errText = await res.text(); log('translate err', res.status, errText); return null; }
        var data = await res.json();
        if (!data || !data.data || !data.data.translations) return null;
        data.data.translations.forEach(function (t) { allResults.push(t.translatedText); });
      }
      return allResults;
    } catch (e) {
      log('translate exception', e.message);
      return null;
    }
  }

  async function translateFullArticle() {
    var enText = getArticleText();
    if (!enText) { alert('沒有找到文章'); return null; }

    var enParas = splitEnglishParagraphs(enText);
    if (!enParas.length) { alert('文章沒有段落'); return null; }

    var hash = hashText(enText);
    var cache = getCache();
    if (cache[hash] && cache[hash].length === enParas.length) {
      log('using cache:', enParas.length);
      return { enParas: enParas, zhParas: cache[hash] };
    }
    if (cache[hash]) { delete cache[hash]; setCache(cache); }

    log('translating', enParas.length, 'paragraphs...');
    var status = document.getElementById('translateStatus');
    if (status) status.textContent = '翻譯中...';

    var zhParas = await googleTranslateBatch(enParas);
    if (!zhParas) { if (status) status.textContent = '失敗'; return null; }

    log('translated', zhParas.length);
    cache[hash] = zhParas;
    setCache(cache);
    if (status) status.textContent = '';

    return { enParas: enParas, zhParas: zhParas };
  }

  function updateSyncState() {
    var btn = document.getElementById('syncToggleBtn');
    if (btn) {
      btn.textContent = syncEnabled ? '同步: 開' : '同步: 關';
      btn.style.background = syncEnabled ? '#a68a56' : '#666';
    }
  }

  function findCurrentParaIndex() {
    var audio = document.getElementById('V5_MASTER_AUDIO');
    if (!audio || !currentTranslation) return -1;
    var t = audio.currentTime, d = audio.duration;
    if (!isFinite(t) || !isFinite(d) || d <= 0) return -1;
    var ratio = t / d;
    var idx = Math.floor(ratio * currentTranslation.enParas.length);
    return Math.min(currentTranslation.enParas.length - 1, Math.max(0, idx));
  }

  function highlightSyncPara() {
    if (!syncEnabled || !currentTranslation) return;
    var idx = findCurrentParaIndex();
    if (idx < 0) return;
    var zhSide = document.getElementById('translateZhSide');
    if (!zhSide) return;

    zhSide.querySelectorAll('.zh-para').forEach(function (el, i) {
      if (i === idx) {
        el.style.background = 'rgba(166,138,86,0.20)';
        el.style.borderLeft = '4px solid #a68a56';
      } else {
        el.style.background = '';
        el.style.borderLeft = '3px solid transparent';
      }
    });

    var current = zhSide.querySelector('.zh-para[data-idx="' + idx + '"]');
    if (current) current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function applyFontSize() {
    var zhSide = document.getElementById('translateZhSide');
    if (!zhSide) return;
    zhSide.querySelectorAll('.zh-para').forEach(function (el) {
      el.style.fontSize = fontPx + 'px';
    });
    var label = document.getElementById('ftFontLabel');
    if (label) label.textContent = fontPx + 'px';
  }

  function applyHeight() {
    var box = document.getElementById('fullTranslateBox');
    if (!box) return;
    if (!isCollapsed) box.style.maxHeight = heightVh + 'vh';
    var hBtn = document.getElementById('ftHeightBtn');
    if (hBtn) {
      var cfg = HEIGHT_CYCLE[currentHeightIdx()];
      hBtn.textContent = cfg.icon;
      hBtn.title = cfg.title + ' ' + heightVh + 'vh';
    }
  }

  function renderTranslation() {
    var zhSide = document.getElementById('translateZhSide');
    if (!zhSide || !currentTranslation) return;

    var html = '';
    currentTranslation.enParas.forEach(function (en, i) {
      var zh = currentTranslation.zhParas[i] || '(翻譯中)';
      html +=
        '<div class="zh-para" data-idx="' + i +
        '" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid transparent;transition:.3s;border-radius:3px;color:#333;font-size:' +
        fontPx + 'px;line-height:1.7">' + zh + '</div>';
    });
    zhSide.innerHTML = html;
    applyFontSize();
  }

  function toggleCollapsed() {
    isCollapsed = !isCollapsed;
    localStorage.setItem(COLLAPSED_STORAGE, isCollapsed ? '1' : '0');
    updateCollapsedState();
  }

  function updateCollapsedState() {
    var box = document.getElementById('fullTranslateBox');
    var toggleBtn = document.getElementById('translateCollapseBtn');
    var body = document.getElementById('translateBody');
    if (!box) return;

    if (isCollapsed) {
      box.style.maxHeight = '48px';
      if (body) body.style.display = 'none';
      if (toggleBtn) toggleBtn.textContent = '▲';
    } else {
      box.style.maxHeight = heightVh + 'vh';
      if (body) body.style.display = 'flex';
      if (toggleBtn) toggleBtn.textContent = '▼';
    }
  }

  function mkBtn(text, title, onClick) {
    var b = document.createElement('button');
    b.textContent = text;
    b.title = title;
    b.style.cssText =
      'width:22px;height:22px;border:0;border-radius:4px;background:#a68a56;color:#fff;' +
      'font-size:13px;line-height:1;cursor:pointer;padding:0;' +
      'display:flex;align-items:center;justify-content:center;';
    b.onclick = function (e) { e.stopPropagation(); onClick(); };
    return b;
  }

  function cycleHeight() {
    var next = (currentHeightIdx() + 1) % HEIGHT_CYCLE.length;
    heightVh = HEIGHT_CYCLE[next].vh;
    localStorage.setItem(HEIGHT_STORAGE, heightVh);
    if (isCollapsed) {
      isCollapsed = false;
      localStorage.setItem(COLLAPSED_STORAGE, '0');
      updateCollapsedState();
    }
    applyHeight();
  }

  function buildTuneControls() {
    var wrap = document.createElement('div');
    wrap.id = 'translateTuneControls';
    wrap.style.cssText =
      'display:flex;align-items:center;gap:4px;margin-left:auto;margin-right:8px;' +
      'font-size:11px;color:#7c6845;white-space:nowrap;';

    // 字級
    wrap.appendChild(document.createTextNode('字'));
    wrap.appendChild(mkBtn('−', '縮小字級', function () {
      fontPx = clamp(fontPx - 1, 10, 24);
      localStorage.setItem(FONT_STORAGE, fontPx);
      applyFontSize();
    }));
    var fLabel = document.createElement('span');
    fLabel.id = 'ftFontLabel';
    fLabel.textContent = fontPx + 'px';
    fLabel.style.cssText = 'min-width:32px;text-align:center;';
    wrap.appendChild(fLabel);
    wrap.appendChild(mkBtn('+', '放大字級', function () {
      fontPx = clamp(fontPx + 1, 10, 24);
      localStorage.setItem(FONT_STORAGE, fontPx);
      applyFontSize();
    }));

    var sep = document.createElement('span');
    sep.textContent = '|';
    sep.style.color = '#c8b68e';
    wrap.appendChild(sep);

    // 高度：單鍵循環
    wrap.appendChild(document.createTextNode('高'));
    var hBtn = mkBtn('=', '切換高度', cycleHeight);
    hBtn.id = 'ftHeightBtn';
    wrap.appendChild(hBtn);

    return wrap;
  }

  function createTranslateBox() {
    if (document.getElementById('fullTranslateBox')) return;

    var box = document.createElement('div');
    box.id = 'fullTranslateBox';
    box.style.position = 'fixed';
    box.style.bottom = '0px';
    box.style.left = '0';
    box.style.right = '0';
    box.style.zIndex = '9999999';
    box.style.background = '#faf6ed';
    box.style.borderTop = '2px solid #a68a56';
    box.style.boxShadow = '0 -4px 12px rgba(0,0,0,.15)';
    box.style.fontFamily = '"Microsoft JhengHei",sans-serif';
    box.style.maxHeight = heightVh + 'vh';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.transition = 'max-height .3s, bottom .3s';
    box.style.overflow = 'hidden';

    box.innerHTML =
      '<div id="translateHeaderBar" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #d9cfbc;gap:8px">' +
        '<div style="color:#a68a56;font-weight:bold;font-size:13px;display:flex;align-items:center;gap:6px">' +
          '<span id="translateCollapseBtn" style="cursor:pointer;padding:2px 6px">' + (isCollapsed ? '▲' : '▼') + '</span>' +
          '中譯 <span id="translateStatus" style="color:#888;font-size:11px"></span>' +
        '</div>' +
        '<div id="translateTuneSlot" style="display:flex;align-items:center;margin-left:auto;margin-right:4px"></div>' +
        '<div style="display:flex;gap:4px">' +
          '<button id="translateBtn" style="padding:4px 8px;background:#a68a56;color:#fff;border:0;border-radius:3px;font-size:11px;cursor:pointer">翻譯</button>' +
          '<button id="syncToggleBtn" style="padding:4px 8px;background:#666;color:#fff;border:0;border-radius:3px;font-size:11px;cursor:pointer">同步: 關</button>' +
          '<button id="translateClearBtn" style="padding:4px 8px;background:transparent;color:#999;border:1px solid #ccc;border-radius:3px;font-size:11px;cursor:pointer">清除</button>' +
        '</div>' +
      '</div>' +
      '<div id="translateBody" style="flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0">' +
        '<div id="translateZhSide" style="flex:1;overflow-y:auto;padding:8px 12px;min-height:0">' +
          '<div style="color:#999;padding:20px;text-align:center;font-size:12px">點擊「翻譯」開始</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(box);

    document.getElementById('translateTuneSlot').appendChild(buildTuneControls());

    document.getElementById('translateBtn').onclick = async function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = '翻譯中';
      currentTranslation = await translateFullArticle();
      btn.disabled = false;
      btn.textContent = '重翻';
      if (currentTranslation) renderTranslation();
    };

    document.getElementById('syncToggleBtn').onclick = function () {
      syncEnabled = !syncEnabled;
      updateSyncState();
      if (syncEnabled) highlightSyncPara();
    };

    document.getElementById('translateClearBtn').onclick = function () {
      currentTranslation = null;
      var zhSide = document.getElementById('translateZhSide');
      if (zhSide) zhSide.innerHTML =
        '<div style="color:#999;padding:20px;text-align:center;font-size:12px">點擊「翻譯」開始</div>';
      document.getElementById('translateBtn').textContent = '翻譯';
      syncEnabled = false;
      updateSyncState();
    };

    document.getElementById('translateCollapseBtn').onclick = toggleCollapsed;

    updateCollapsedState();
    applyHeight();
  }

  function findGcttsBar() {
    var candidates = [
      document.querySelector('#gcttsBar'),
      document.querySelector('#gcttsPanel'),
      document.querySelector('#gcttsControls'),
      document.querySelector('[data-gctts-panel]'),
      document.querySelector('.gctts-panel'),
      document.querySelector('.gctts-bar')
    ];
    for (var i = 0; i < candidates.length; i++) if (candidates[i]) return candidates[i];

    var fixedEls = Array.prototype.slice.call(document.querySelectorAll('div, section, aside'));
    var best = null, bestBottom = Infinity;
    fixedEls.forEach(function (el) {
      if (el.id === 'fullTranslateBox') return;
      var s = window.getComputedStyle(el);
      if (s.position !== 'fixed') return;
      var r = el.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 5) return;
      if (r.height < 30) return;
      var distance = Math.abs(r.bottom - window.innerHeight);
      if (distance < bestBottom) { bestBottom = distance; best = el; }
    });
    return best;
  }

  function alignToPlayer() {
    var box = document.getElementById('fullTranslateBox');
    if (!box) return;
    var bar = findGcttsBar();
    if (!bar || bar === box) { box.style.bottom = '0px'; return; }
    var barRect = bar.getBoundingClientRect();
    var offsetFromBottom = window.innerHeight - barRect.top;
    if (offsetFromBottom < 0) offsetFromBottom = 0;
    box.style.bottom = offsetFromBottom + 'px';
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
      if (!document.getElementById('fullTranslateBox')) createTranslateBox();
      alignToPlayer();
    }, 400);
  }

  createTranslateBox();
  startSyncMonitor();
  startWatchdog();
  window.addEventListener('resize', alignToPlayer);

  log('ready v20260718-3');

  window.translateFullArticle    = translateFullArticle;
  window.splitEnglishParagraphs  = splitEnglishParagraphs;
  window.getArticleText          = getArticleText;

})();
