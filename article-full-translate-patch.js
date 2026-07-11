/* article-full-translate-patch.js v20260711-3
   Split view: EN top, ZH bottom.
   Sync highlight without jumping.
*/

(function () {

  'use strict';

  var API_KEY_STORAGE = 'google_translate_api_key';
  var CACHE_STORAGE = 'article_translation_cache_v1';

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
    } catch (e) { return {}; }
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
    if (enParas.length === 0) {
      alert('文章沒有段落');
      return null;
    }

    var hash = hashText(enText);
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

    var currentTime = audio.currentTime;
    var duration = audio.duration;

    if (!isFinite(currentTime) || !isFinite(duration) || duration <= 0) return -1;

    var ratio = currentTime / duration;
    var idx = Math.floor(ratio * currentTranslation.enParas.length);

    return Math.min(currentTranslation.enParas.length - 1, Math.max(0, idx));
  }

  // 智能滾動：只在視線範圍外才滾動
  function scrollIntoViewIfNeeded(el, container) {

    if (!el) return;

    var elRect = el.getBoundingClientRect();
    var containerRect = container ? container.getBoundingClientRect() : {
      top: 0,
      bottom: window.innerHeight
    };

    var buffer = 60;

    var isAbove = elRect.top < containerRect.top + buffer;
    var isBelow = elRect.bottom > containerRect.bottom - buffer;

    if (isAbove || isBelow) {
      el.scrollIntoView({
        block: 'center',
        behavior: 'smooth'
      });
    }
  }

  function highlightSyncPara() {

    if (!syncEnabled || !currentTranslation) return;

    var idx = findCurrentParaIndex();
    if (idx < 0) return;

    var zhSide = document.getElementById('translateZhSide');

    if (zhSide) {
      // 只更新中文側的高亮
      zhSide.querySelectorAll('.zh-para').forEach(function (el, i) {
        if (i === idx) {
          el.style.background = 'rgba(166, 138, 86, 0.15)';
          el.style.borderLeft = '3px solid #a68a56';
        } else {
          el.style.background = '';
          el.style.borderLeft = '3px solid transparent';
        }
      });

      // 智能滾動中文側到當前段
      var currentZh = zhSide.querySelector('.zh-para[data-idx="' + idx + '"]');
      scrollIntoViewIfNeeded(currentZh, zhSide);
    }
  }

  function renderTranslation() {

    var zhSide = document.getElementById('translateZhSide');
    if (!zhSide || !currentTranslation) return;

    var html = '';

    currentTranslation.enParas.forEach(function (en, i) {

      var zh = currentTranslation.zhParas[i] || '(翻譯中)';

      html += '<div class="zh-para" data-idx="' + i + '" style="' +
        'padding: 10px 12px;' +
        'margin-bottom: 6px;' +
        'border-left: 3px solid transparent;' +
        'transition: background 0.3s, border-left-color 0.3s;' +
        'border-radius: 3px;' +
        '">' +
        '<div style="color: #888; font-size: 11px; margin-bottom: 4px;">' + (i + 1) + '</div>' +
        '<div style="color: #333; font-size: 14px; line-height: 1.7;">' + zh + '</div>' +
        '</div>';
    });

    zhSide.innerHTML = html;
  }

  function createTranslateBox() {

    if (document.getElementById('fullTranslateBox')) return;

    var card = document.querySelector('.card');
    if (!card) return;

    var parent = card.parentElement;
    if (!parent) return;

    var box = document.createElement('div');
    box.id = 'fullTranslateBox';
    box.style.cssText = ''
      + 'margin-top: 20px;'
      + 'padding: 12px;'
      + 'background: #faf6ed;'
      + 'border: 1px solid #d9cfbc;'
      + 'border-radius: 6px;'
      + 'font-family: "Microsoft JhengHei", sans-serif;';

    box.innerHTML =
      // 標題列
      '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #d9cfbc;">' +
        '<div style="color: #a68a56; font-weight: bold; font-size: 14px;">' +
          '📖 中文翻譯' +
          '<span id="translateStatus" style="color: #888; font-size: 12px; margin-left: 8px;"></span>' +
        '</div>' +
        '<div style="display: flex; gap: 6px;">' +
          '<button id="translateBtn" style="' +
            'padding: 5px 10px;' +
            'background: #a68a56;' +
            'color: white;' +
            'border: none;' +
            'border-radius: 3px;' +
            'cursor: pointer;' +
            'font-size: 12px;' +
          '">翻譯全文</button>' +
          '<button id="syncToggleBtn" style="' +
            'padding: 5px 10px;' +
            'background: #666;' +
            'color: white;' +
            'border: none;' +
            'border-radius: 3px;' +
            'cursor: pointer;' +
            'font-size: 12px;' +
          '">🔗 同步: 關</button>' +
          '<button id="translateClearBtn" style="' +
            'padding: 5px 10px;' +
            'background: transparent;' +
            'color: #999;' +
            'border: 1px solid #ccc;' +
            'border-radius: 3px;' +
            'cursor: pointer;' +
            'font-size: 12px;' +
          '">清除</button>' +
        '</div>' +
      '</div>' +

      // 中文翻譯區
      '<div id="translateZhSide" style="' +
        'max-height: 400px;' +
        'overflow-y: auto;' +
        'padding-right: 8px;' +
      '">' +
        '<div style="color: #999; padding: 20px; text-align: center;">' +
          '點擊「翻譯全文」開始' +
        '</div>' +
      '</div>';

    if (card.nextSibling) {
      parent.insertBefore(box, card.nextSibling);
    } else {
      parent.appendChild(box);
    }

    // 綁定事件
    document.getElementById('translateBtn').onclick = async function () {

      var btn = this;
      btn.disabled = true;
      btn.textContent = '翻譯中...';

      currentTranslation = await translateFullArticle();

      btn.disabled = false;
      btn.textContent = '重新翻譯';

      if (currentTranslation) {
        renderTranslation();
      }
    };

    document.getElementById('syncToggleBtn').onclick = function () {
      syncEnabled = !syncEnabled;
      updateSyncState();
      if (syncEnabled) {
        highlightSyncPara();
      }
    };

    document.getElementById('translateClearBtn').onclick = function () {
      currentTranslation = null;
      var zhSide = document.getElementById('translateZhSide');
      if (zhSide) {
        zhSide.innerHTML =
          '<div style="color: #999; padding: 20px; text-align: center;">' +
            '點擊「翻譯全文」開始' +
          '</div>';
      }
      document.getElementById('translateBtn').textContent = '翻譯全文';
      syncEnabled = false;
      updateSyncState();
    };

    log('translate box created');

    if (currentTranslation) {
      renderTranslation();
      document.getElementById('translateBtn').textContent = '重新翻譯';
    }
  }

  function startSyncMonitor() {

    setInterval(function () {
      if (!syncEnabled) return;
      if (!currentTranslation) return;

      var audio = document.getElementById('__V5_MASTER_AUDIO__');
      if (!audio || audio.paused) return;

      highlightSyncPara();
    }, 500);
  }

  function startBoxWatchdog() {

    setInterval(function () {

      if (document.getElementById('fullTranslateBox')) return;

      var card = document.querySelector('.card');
      if (card) {
        log('box missing, recreating...');
        createTranslateBox();
      }
    }, 1000);
  }

  // 初始化
  var attempts = 0;
  var timer = setInterval(function () {
    attempts++;
    createTranslateBox();
    if (document.getElementById('fullTranslateBox') || attempts > 30) {
      clearInterval(timer);
    }
  }, 500);

  startSyncMonitor();
  startBoxWatchdog();

  log('ready v20260711-3');

})();
