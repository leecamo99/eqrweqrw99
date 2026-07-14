/* article-full-translate-patch.js v20260712-4
   鎖定 #gcttsPanel，動態跟隨它的實際高度
*/

(function () {

  'use strict';

  /* ====== 微調（通常不用改） ====== */
  var AUDIO_BAR_SELECTOR = '#gcttsPanel';  // 全文語音列
  var FALLBACK_HEIGHT    = 60;             // 抓不到時的預設值
  var GAP                = 0;              // 兩列之間留白 px
  /* ============================== */

  var API_KEY_STORAGE   = 'google_translate_api_key';
  var CACHE_STORAGE     = 'article_translation_cache_v1';
  var COLLAPSED_STORAGE = 'article_translate_collapsed';

  function log() {
    try {
      console.log.apply(console, ['[FullTranslate]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getAudioBarHeight() {
    var el = document.querySelector(AUDIO_BAR_SELECTOR);
    if (!el) return FALLBACK_HEIGHT;
    var h = el.getBoundingClientRect().height;
    if (!h || h < 10) return FALLBACK_HEIGHT;
    return h;
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

    texts = (texts || [])
      .map(function (x) {
        return String(x || '').trim();
      })
      .filter(Boolean);

    log('clean paragraphs:', texts.length);

    const BATCH_SIZE = 40;

    var allResults = [];

    try {

      for (var i = 0; i < texts.length; i += BATCH_SIZE) {

        var chunk =
          texts.slice(
            i,
            i + BATCH_SIZE
          );

        log(
          'translate batch',
          (i / BATCH_SIZE) + 1,
          '/',
          Math.ceil(texts.length / BATCH_SIZE),
          'items:',
          chunk.length
        );

        var res = await fetch(
          'https://translation.googleapis.com/language/translate/v2?key=' + key,
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

          console.error(
            '[FullTranslate] http err',
            res.status,
            await res.text()
          );

          return null;
        }

        var data = await res.json();

        if (
          !data ||
          !data.data ||
          !data.data.translations
        ) {
          return null;
        }

        allResults.push(
          ...data.data.translations.map(function (t) {
            return t.translatedText;
          })
        );
      }

      return allResults;

    } catch (e) {

      console.error(
        '[FullTranslate]',
        e
      );

      return null;
    }
}


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

    if (!fullText) return [];

    var paras =
      fullText
        .split(/\n+/)
        .map(function (p) {
          return String(p || '').trim();
        })
        .filter(Boolean)

        // 移除 1. 2. 3.
        .filter(function (p) {
          return !/^\d+.$/.test(p);
        })

        // 移除 1) 2)
        .filter(function (p) {
          return !/^\d+)$/.test(p);
        })

        // 移除前面段號
        .map(function (p) {
          return p.replace(/^\d+[.)]\s+/, '');
        });

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

    var audio = document.getElementById('__V5_MASTER_AUDIO__');
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

    var containerRect = container.getBoundingClientRect(
