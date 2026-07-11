/* multi-definition-patch.js v20260711-2
   Fixes infinite loop bug in v1.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[MultiDef]'].concat([].slice.call(arguments)));
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

  var fetchQueue = new Set();
  var fetchedLemmas = new Set();
  var mo = null;
  var lastLemma = null;

  async function fetchDefinitions(lemma) {

    if (fetchedLemmas.has(lemma)) return;
    if (fetchQueue.has(lemma)) return;

    fetchQueue.add(lemma);

    try {

      var res = await fetch(
        'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(lemma)
      );

      if (!res.ok) {
        fetchQueue.delete(lemma);
        fetchedLemmas.add(lemma);
        return;
      }

      var data = await res.json();
      if (!data || !data[0]) {
        fetchQueue.delete(lemma);
        fetchedLemmas.add(lemma);
        return;
      }

      var meanings = data[0].meanings || [];
      var definitions = [];

      meanings.forEach(function (m) {
        var pos = m.partOfSpeech;
        var defs = m.definitions || [];
        defs.slice(0, 2).forEach(function (d) {
          if (d.definition) {
            definitions.push('[' + pos + '] ' + d.definition);
          }
        });
      });

      if (definitions.length === 0) {
        fetchQueue.delete(lemma);
        fetchedLemmas.add(lemma);
        return;
      }

      var db = getDB();
      if (db.learn && db.learn[lemma]) {
        db.learn[lemma].definitions = definitions;
        db.learn[lemma].definitionSource = 'dictionaryapi.dev';
        setDB(db);

        log('fetched', definitions.length, 'defs for', lemma);
      }

      fetchQueue.delete(lemma);
      fetchedLemmas.add(lemma);

      updateWordNote(lemma);

    } catch (e) {
      log('err:', lemma, e.message);
      fetchQueue.delete(lemma);
    }
  }

  function updateWordNote(lemma) {

    // 暫停 observer
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
      if (!x || !x.definitions) return;

      var body = document.getElementById('dockBody');
      var meaning = body.querySelector('.meaning');
      if (!meaning) return;

      // 移除舊的
      var oldDef = body.querySelector('.multi-def');
      if (oldDef) oldDef.remove();

      var defDiv = document.createElement('div');
      defDiv.className = 'multi-def';
      defDiv.style.cssText = ''
        + 'margin: 8px 0;'
        + 'padding: 8px;'
        + 'background: rgba(0,0,0,0.03);'
        + 'border-left: 3px solid #a68a56;'
        + 'font-size: 13px;'
        + 'line-height: 1.6;'
        + 'color: #444;';

      var defs = x.definitions.slice(0, 5);
      defDiv.innerHTML = '<strong>字典釋義：</strong>' +
        '<div style="margin-top:4px">' +
        defs.map(function (d) {
          return '• ' + d;
        }).join('<br>') +
        '</div>';

      meaning.parentNode.insertBefore(defDiv, meaning.nextSibling);

    } finally {

      // 重新開啟 observer（500ms 後，避免馬上觸發）
      setTimeout(function () {
        if (mo && target) {
          mo.observe(target, {
            childList: true,
            subtree: false   // ★ 只監聽直接子元素，不深入
          });
        }
      }, 500);
    }
  }

  // Debounce
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

      // 如果 lemma 沒變，不動作
      if (lemma === lastLemma) return;
      lastLemma = lemma;

      var db = getDB();
      var x = db.learn && db.learn[lemma];

      if (!x) return;

      if (x.definitions) {
        updateWordNote(lemma);
      } else {
        fetchDefinitions(lemma);
      }
    }, 200);
  }

  var target = document.getElementById('dockBody');
  if (target) {
    mo = new MutationObserver(debouncedCheck);
    mo.observe(target, {
      childList: true,
      subtree: false   // ★ 只監聽直接子元素，不深入
    });
  }

  log('ready v20260711-2');

})();
