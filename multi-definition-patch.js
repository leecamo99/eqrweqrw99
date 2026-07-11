/* multi-definition-patch.js v20260711-1
   Fetches multiple definitions from Free Dictionary API
   and updates x.tip with structured definitions.
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

      // 收集所有義項
      var meanings = data[0].meanings || [];
      var definitions = [];

      meanings.forEach(function (m) {

        var pos = m.partOfSpeech;
        var defs = m.definitions || [];

        // 每個詞性取前 2 個定義
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

      // 存到 db.learn[lemma].definitions
      var db = getDB();
      if (db.learn && db.learn[lemma]) {
        db.learn[lemma].definitions = definitions;
        db.learn[lemma].definitionSource = 'dictionaryapi.dev';
        setDB(db);

        log('fetched', definitions.length, 'defs for', lemma);
      }

      fetchQueue.delete(lemma);
      fetchedLemmas.add(lemma);

      // 更新 Word Note 顯示
      updateWordNote(lemma);

    } catch (e) {
      log('err:', lemma, e.message);
      fetchQueue.delete(lemma);
    }
  }

  function updateWordNote(lemma) {

    // 找到 Word Note 內的當前字
    var wordbig = document.querySelector('#dockBody .wordbig');
    if (!wordbig) return;

    var currentSurface = wordbig.textContent;

    // 用 window.lemmatizeWord 確認是這個 lemma
    if (typeof window.lemmatizeWord === 'function') {
      var info = window.lemmatizeWord(currentSurface);
      if (info.lemma !== lemma) return;
    }

    var db = getDB();
    var x = db.learn && db.learn[lemma];
    if (!x || !x.definitions) return;

    // 找到 Word Note 中 meaning div 之後的位置
    var body = document.getElementById('dockBody');
    var meaning = body.querySelector('.meaning');
    if (!meaning) return;

    // 移除舊的 multi-def
    var oldDef = body.querySelector('.multi-def');
    if (oldDef) oldDef.remove();

    // 建立新的
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
  }

  // 監聽 Word Note 打開
  var target = document.getElementById('dockBody');
  if (target) {

    var mo = new MutationObserver(function () {

      var wordbig = document.querySelector('#dockBody .wordbig');
      if (!wordbig) return;

      var surface = wordbig.textContent;

      if (typeof window.lemmatizeWord === 'function') {
        var info = window.lemmatizeWord(surface);
        var lemma = info.lemma;

        var db = getDB();
        var x = db.learn && db.learn[lemma];

        if (x) {
          if (x.definitions) {
            // 已有 definitions，直接顯示
            updateWordNote(lemma);
          } else {
            // 沒有 → fetch
            fetchDefinitions(lemma);
          }
        }
      }
    });

    mo.observe(target, {
      childList: true,
      subtree: true
    });
  }

  log('ready v20260711-1');

})();
