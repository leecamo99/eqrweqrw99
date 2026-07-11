/* google-translate-multidef-patch.js v20260711-1
   Uses Google Translate API for high-quality translation.
   Falls back to Free Dictionary API for word definitions.
*/

(function () {

  'use strict';

  var API_KEY_STORAGE = 'google_translate_api_key';

  function log() {
    try {
      console.log.apply(console, ['[GoogleTranslate]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getDB() {
    try {
      return JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
    } catch (e) { return {}; }
  }

  function setDB(d) {
    localStorage.setItem('notebook_platform_v3', JSON.stringify(d));
  }

  function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  }

  function setApiKey(k) {
    localStorage.setItem(API_KEY_STORAGE, k);
  }

  // 提供給 Console 用的設定 API
  window.setGoogleTranslateKey = function (k) {
    setApiKey(k);
    log('API key set');
  };

  var fetchQueue = new Set();

  async function fetchGoogleTranslate(lemma) {

    var key = getApiKey();
    if (!key) {
      log('no API key, skip Google Translate for', lemma);
      return null;
    }

    try {

      var res = await fetch(
        'https://translation.googleapis.com/language/translate/v2?key=' + key,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: lemma,
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
      var text = data && data.data && data.data.translations && 
                 data.data.translations[0] && data.data.translations[0].translatedText;

      return text || null;

    } catch (e) {
      log('Google translate err:', e.message);
      return null;
    }
  }

  async function fetchFreeDictionary(lemma) {

    try {

      var res = await fetch(
        'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(lemma)
      );

      if (!res.ok) return null;

      var data = await res.json();
      if (!data || !data[0]) return null;

      var meanings = data[0].meanings || [];
      var definitions = [];

      meanings.forEach(function (m) {
        var pos = m.partOfSpeech;
        var defs = m.definitions || [];
        defs.slice(0, 3).forEach(function (d) {
          if (d.definition) {
            definitions.push({
              pos: pos,
              def: d.definition,
              example: d.example || null
            });
          }
        });
      });

      return definitions.length > 0 ? definitions : null;

    } catch (e) {
      return null;
    }
  }

  async function fetchAllDefinitions(lemma) {

    if (fetchQueue.has(lemma)) return;
    fetchQueue.add(lemma);

    try {

      var db = getDB();

      // 檢查是否已有品質好的翻譯
      var x = db.learn && db.learn[lemma];
      if (!x) {
        fetchQueue.delete(lemma);
        return;
      }

      var needsUpdate = false;

      // 1. 嘗試 Google Translate
      var googleResult = await fetchGoogleTranslate(lemma);
      if (googleResult) {
        db.learn[lemma].tw = googleResult;
        db.learn[lemma].translationSource = 'Google Translate';
        db.learn[lemma].tip = '';  // 清掉 MyMemory 訊息
        needsUpdate = true;
        log('Google translated:', lemma, '→', googleResult);
      }

      // 2. 抓字典定義
      var dictResult = await fetchFreeDictionary(lemma);
      if (dictResult) {
        db.learn[lemma].definitions = dictResult;
        db.learn[lemma].definitionSource = 'dictionaryapi.dev';
        needsUpdate = true;
        log('fetched', dictResult.length, 'definitions for', lemma);
      }

      if (needsUpdate) {
        setDB(db);
        updateWordNote(lemma);
      }

    } catch (e) {
      log('err:', lemma, e.message);
    } finally {
      fetchQueue.delete(lemma);
    }
  }

  function updateWordNote(lemma) {

    if (mo) mo.disconnect();

    try {

      var wordbig = document.querySelector('#dockBody .wordbig');
      if (!wordbig) return;

      var currentSurface = wordbig.textContent;

      if (typeof window.lemmatizeWord === 'function') {
        var info = window.lemmatizeWord(currentSurface);
        if (info.lemma !== lemma) return;
      }

      var db = getDB();
      var x = db.learn && db.learn[lemma];
      if (!x) return;

      var body = document.getElementById('dockBody');

      // 更新翻譯
      var meaning = body.querySelector('.meaning');
      if (meaning && x.tw) {
        meaning.textContent = x.tw;
      }

      // 更新字典
      if (x.definitions) {
        var oldDef = body.querySelector('.multi-def');
        if (oldDef) oldDef.remove();

        var defDiv = document.createElement('div');
        defDiv.className = 'multi-def';
        defDiv.style.cssText = ''
          + 'margin: 8px 0;'
          + 'padding: 10px;'
          + 'background: rgba(0,0,0,0.03);'
          + 'border-left: 3px solid #a68a56;'
          + 'font-size: 13px;'
          + 'line-height: 1.6;'
          + 'color: #444;'
          + 'border-radius: 3px;';

        var defs = x.definitions.slice(0, 5);
        defDiv.innerHTML = '<strong style="color:#a68a56">字典釋義：</strong>' +
          '<div style="margin-top:6px">' +
          defs.map(function (d) {
            var s = '<div style="margin-bottom:6px">' +
              '<span style="color:#a68a56;font-size:11px">[' + d.pos + ']</span> ' +
              d.def;
            if (d.example) {
              s += '<div style="color:#888;font-size:11px;font-style:italic;margin-top:2px;padding-left:12px">' +
                '「' + d.example + '」</div>';
            }
            s += '</div>';
            return s;
          }).join('') +
          '</div>';

        if (meaning) {
          meaning.parentNode.insertBefore(defDiv, meaning.nextSibling);
        } else {
          body.appendChild(defDiv);
        }
      }

    } finally {

      setTimeout(function () {
        if (mo && target) {
          mo.observe(target, {
            childList: true,
            subtree: false
          });
        }
      }, 500);
    }
  }

  var mo = null;
  var target = null;
  var lastLemma = null;
  var debounceTimer = null;

  function debouncedCheck() {

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(function () {

      var wordbig = document.querySelector('#dockBody .wordbig');
      if (!wordbig) {
        lastLemma = null;
        return;
      }

      var surface = wordbig.textContent;

      if (typeof window.lemmatizeWord !== 'function') return;

      var info = window.lemmatizeWord(surface);
      var lemma = info.lemma;

      if (lemma === lastLemma) return;
      lastLemma = lemma;

      var db = getDB();
      var x = db.learn && db.learn[lemma];

      if (!x) return;

      if (x.definitions || x.translationSource === 'Google Translate') {
        updateWordNote(lemma);
      } else {
        fetchAllDefinitions(lemma);
      }
    }, 200);
  }

  target = document.getElementById('dockBody');
  if (target) {
    mo = new MutationObserver(debouncedCheck);
    mo.observe(target, {
      childList: true,
      subtree: false
    });
  }

  log('ready v20260711-1');
  log('current API key:', getApiKey() ? '(set)' : '(not set)');

})();
