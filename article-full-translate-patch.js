/* article-full-translate-patch.js v20260714-1
   Clean rewrite.
   - splitEnglishParagraphs: safe (no dangerous regex)
   - googleTranslateBatch: batched (avoid 400)
   - handles "10." style numbering correctly
*/

(function () {

  'use strict';

  var API_KEY_STORAGE = 'google_translate_api_key';
  var CACHE_STORAGE = 'article_translation_cache_v1';
  var COLLAPSED_STORAGE = 'article_translate_collapsed';

  var currentTranslation = null;
  var syncEnabled = false;
  var isCollapsed = localStorage.getItem(COLLAPSED_STORAGE) === '1';

  function log() {
    try {
      console.log.apply(console, ['[FullTranslate]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  }

  function getCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_STORAGE) || '{}');
    } catch (e) {
      return {};
    }
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

function splitEnglishParagraphs(fullText) {

    if (!fullText) return [];

    var text = String(fullText || '')
      .replace(/\r/g, '\n');

    // 先試著用行切
    var lines = text
      .split('\n')
      .map(function (l) {
        return String(l || '').trim();
      })
      .filter(Boolean);

    if (lines.length > 1) {
      return lines;
    }

    // 用「數字+點+空白」當分段點
    var paras = [];
    var start = 0;
    var i = 0;

    while (i < text.length) {

      var ch = text.charAt(i);

      var isDigit = ch >= '0' && ch <= '9';

      // 判斷是否為段首：例如 " 3. " 或開頭 "3. "
      if (isDigit) {

        var j = i;

        while (
          j < text.length &&
          text.charAt(j) >= '0' &&
          text.charAt(j) <= '9'
        ) {
          j++;
        }

        var afterNum = text.charAt(j);
        var afterAfter = text.charAt(j + 1);

        var prev = i > 0 ? text.charAt(i - 1) : '\n';

        var isBoundary =
          prev === ' ' ||
          prev === '\n' ||
          prev === '\t' ||
          i === 0;

        if (
          isBoundary &&
          afterNum === '.' &&
          (afterAfter === ' ' || afterAfter === '\t')
        ) {

          if (i > start) {
            var before = String(text.slice(start, i) || '').trim();
            if (before) paras.push(before);
          }

          start = i;
        }
      }

      i++;
    }

    var lastPart = String(text.slice(start) || '').trim();
    if (lastPart) paras.push(lastPart);

    paras = paras.filter(function (p) {
      return p;
    });

    if (paras.length > 1) {
      return paras;
    }

    return [text.trim()];
}

    function getArticleText() {

    var article = document.querySelector('.card .en');
    if (!article) return null;

    var clone = article.cloneNode(true);

    clone.querySelectorAll('button, script').forEach(function (el) {
      el.remove();
    });

    var text = clone.innerText || clone.textContent || '';

    return text.trim();
}


  async function translateFullArticle() {

    var enText = getArticleText();
    if (!enText) {
      alert('沒有找到文章');
      return null;
    }

    var enParas = splitEnglishParagraphs(enText);
    if (!enParas.length) {
      alert('文章沒有段落');
      return null;
    }

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

    var t = audio.currentTime;
    var d = audio.duration;

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
    if (current) {
      current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function renderTranslation() {

    var zhSide = document.getElementById('translateZhSide');
    if (!zhSide || !currentTranslation) return;

    var html = '';

    currentTranslation.enParas.forEach(function (en, i) {

      var zh = currentTranslation.zhParas[i] || '(翻譯中)';

      html += '<div class="zh-para" data-idx="' + i + '" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid transparent;transition:.3s;border-radius:3px;color:#333;font-size:14px;line-height:1.7">' + zh + '</div>';
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
    var toggleBtn = document.getElementById('translateCollapseBtn');
    var body = document.getElementById('translateBody');

    if (!box) return;

    if (isCollapsed) {
      box.style.maxHeight = '150px';
      if (body) body.style.display = 'none';
      if (toggleBtn) toggleBtn.textContent = '▲';
    } else {
      box.style.maxHeight = '80vh';
      if (body) body.style.display = 'flex';
      if (toggleBtn) toggleBtn.textContent = '▼';
    }
  }

  function createTranslateBox() {

    if (document.getElementById('fullTranslateBox')) return;

    var box = document.createElement('div');
    box.id = 'fullTranslateBox';

    box.style.position = 'fixed';
    box.style.bottom = '0';
    box.style.left = '0';
    box.style.right = '0';
     box.style.pointerEvents = 'auto';
    box.style.zIndex = '9999999';
    box.style.background = '#faf6ed';
    box.style.borderTop = '2px solid #a68a56';
    box.style.boxShadow = '0 -4px 12px rgba(0,0,0,.15)';
    box.style.fontFamily = '"Microsoft JhengHei",sans-serif';
    box.style.maxHeight = '80vh';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.transition = 'max-height .3s';
    box.style.overflow = 'hidden';
     
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #d9cfbc">' +
        '<div style="color:#a68a56;font-weight:bold;font-size:13px;display:flex;align-items:center;gap:8px">' +
          '<span id="translateCollapseBtn" style="cursor:pointer;padding:2px 6px">' + (isCollapsed ? '▲' : '▼') + '</span>' +
          '📖 中文翻譯 <span id="translateStatus" style="color:#888;font-size:11px"></span>' +
        '</div>' +
        '<div style="display:flex;gap:4px">' +
          '<button id="translateBtn" style="padding:4px 8px;background:#a68a56;color:#fff;border:0;border-radius:3px;font-size:11px;cursor:pointer">翻譯全文</button>' +
          '<button id="syncToggleBtn" style="padding:4px 8px;background:#666;color:#fff;border:0;border-radius:3px;font-size:11px;cursor:pointer">🔗 同步: 關</button>' +
          '<button id="translateClearBtn" style="padding:4px 8px;background:transparent;color:#999;border:1px solid #ccc;border-radius:3px;font-size:11px;cursor:pointer">清除</button>' +
        '</div>' +
      '</div>' +
      '<div id="translateBody" style="flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0">' +
        '<div id="translateZhSide" style="flex:1;overflow-y:auto;padding:8px 12px;min-height:0">' +
          '<div style="color:#999;padding:20px;text-align:center;font-size:12px">點擊「翻譯全文」開始</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(box);

    document.getElementById('translateBtn').onclick = async function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = '翻譯中...';

      currentTranslation = await translateFullArticle();

      btn.disabled = false;
      btn.textContent = '重新翻譯';

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
      if (zhSide) {
        zhSide.innerHTML =
          '<div style="color:#999;padding:20px;text-align:center;font-size:12px">點擊「翻譯全文」開始</div>';
      }
      document.getElementById('translateBtn').textContent = '翻譯全文';
      syncEnabled = false;
      updateSyncState();
    };

    document.getElementById('translateCollapseBtn').onclick = toggleCollapsed;

    updateCollapsedState();
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
        createTranslateBox();
      }
    }, 1000);
  }

  createTranslateBox();
  startSyncMonitor();
  startWatchdog();

  log('ready v20260714-1');

  window.translateFullArticle = translateFullArticle;
  window.splitEnglishParagraphs = splitEnglishParagraphs;
function findGcttsBar() {
    var candidates = [
      document.querySelector('#gcttsBar'),
      document.querySelector('#gcttsPanel'),
      document.querySelector('#gcttsControls'),
      document.querySelector('[data-gctts-panel]'),
      document.querySelector('.gctts-panel'),
      document.querySelector('.gctts-bar')
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i]) return candidates[i];
    }
    // fallback：找 fixed 且在最底部的元素
    var fixedEls = Array.prototype.slice.call(
      document.querySelectorAll('div, section, aside')
    );
    var best = null;
    var bestBottom = Infinity;
    fixedEls.forEach(function (el) {
      if (el.id === 'fullTranslateBox') return;
      var s = window.getComputedStyle(el);
      if (s.position !== 'fixed') return;
      var r = el.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 5) return;
      if (r.height < 30) return;
      var distance = Math.abs(r.bottom - window.innerHeight);
      if (distance < bestBottom) {
        bestBottom = distance;
        best = el;
      }
    });
    return best;
}

function alignToPlayer() {
    var box = document.getElementById('fullTranslateBox');
    if (!box) return;
    var bar = findGcttsBar();
    if (!bar) {
      box.style.bottom = '0px';
      return;
    }
    if (bar === box) {
      return;
    }
    var barRect = bar.getBoundingClientRect();
    var offsetFromBottom = window.innerHeight - barRect.top;
    if (offsetFromBottom < 0) offsetFromBottom = 0;
    box.style.bottom = offsetFromBottom + 'px';
}
setInterval(alignToPlayer, 400);
window.addEventListener('resize', alignToPlayer);



   
})();
