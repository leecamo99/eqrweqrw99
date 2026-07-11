/* word-click-lemma-force-patch.js v20260711-2
   Forces correct lemma to be used in clickWord.
   Preserves original surface in x.lastSurface.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[ClickLemmaForce]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  if (typeof window.clickWord !== 'function') {
    log('clickWord not available');
    return;
  }

  if (typeof window.lemmatizeWord !== 'function') {
    log('lemmatizeWord not available');
    return;
  }

  var origClickWord = window.clickWord;

  window.clickWord = function (originalSurface) {

    // 用 window.lemmatizeWord (經過 patch chain) 拿正確 lemma
    var info = window.lemmatizeWord(originalSurface);
    var correctLemma = info && info.lemma ? info.lemma : originalSurface;

    log('surface:', originalSurface, '→ lemma:', correctLemma);

    // 用 lemma 呼叫 clickWord
    // patch scope 內部的 lemmatize 對 lemma 已經是 lemma，不會再錯
    var result = origClickWord.call(this, correctLemma);

    // 修正 db.learn 內的 lastSurface
    // 因為 clickWord 傳入 lemma，所以 lastSurface 會變 lemma
    // 我們要把它改回原始 surface
    setTimeout(function () {

      try {
        var db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
        if (db.learn && db.learn[correctLemma]) {
          db.learn[correctLemma].lastSurface = originalSurface;

          // 記錄變形
          db.learn[correctLemma].variants = db.learn[correctLemma].variants || {};
          db.learn[correctLemma].variants[originalSurface] = 
            (db.learn[correctLemma].variants[originalSurface] || 0) + 1;

          localStorage.setItem('notebook_platform_v3', JSON.stringify(db));

          log('preserved lastSurface:', originalSurface);
        }
      } catch (e) {
        log('preserve err:', e);
      }
    }, 50);

    return result;
  };

  log('ready v20260711-2');

})();
