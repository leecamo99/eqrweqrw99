/* word-click-lemma-force-patch.js v20260711-1
   Force clickWord to receive the correct lemma before patch scope processes it.
   Prevents wrong entries like perspectif in db.learn.
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

  window.clickWord = function (surface) {

    // 用 window.lemmatizeWord (有 patch chain) 拿正確 lemma
    var info = window.lemmatizeWord(surface);
    var correctLemma = info && info.lemma ? info.lemma : surface;

    log('surface:', surface, '→ lemma:', correctLemma);

    // 用 lemma 而不是 surface 呼叫 clickWord
    // 這樣 ensureLemma 內部 lemmatize 不會再錯誤還原
    return origClickWord.call(this, correctLemma);
  };

  log('ready v20260711-1');

})();
