/* lemma-migration-patch.js v20260711-1
   Auto-migrates old lemma entries when LemmaBoost corrects the lemma.
   E.g. db.learn['immers'] gets moved to db.learn['immerse'].
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[LemmaMigrate]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  if (typeof window.lemmatizeWord !== 'function') {
    log('lemmatizeWord not available');
    return;
  }

  function getDB() {
    try {
      return JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
    } catch (e) { return {}; }
  }

  function setDB(d) {
    localStorage.setItem('notebook_platform_v3', JSON.stringify(d));
  }

  // 攔截 clickWord，在執行前先做遷移
  var origClickWord = window.clickWord;

  window.clickWord = function (surface) {

    var info = window.lemmatizeWord(surface);
    if (!info || !info.lemma) return origClickWord ? origClickWord(surface) : null;

    var correctLemma = info.lemma;

    // 檢查是否有舊的錯誤 lemma
    var db = getDB();
    if (!db.learn) db.learn = {};

    // 嘗試常見的錯誤形式
    var wrongCandidates = [];
    if (correctLemma.endsWith('e')) {
      wrongCandidates.push(correctLemma.slice(0, -1));  // immerse → immers
    }

    wrongCandidates.forEach(function (wrong) {
      if (db.learn[wrong] && !db.learn[correctLemma]) {
        log('migrate:', wrong, '→', correctLemma);
        var oldData = db.learn[wrong];
        oldData.word = correctLemma;
        oldData.lemma = correctLemma;
        db.learn[correctLemma] = oldData;
        delete db.learn[wrong];
        setDB(db);
      }
    });

    return origClickWord ? origClickWord(surface) : null;
  };

  log('ready v20260711-1');

})();
