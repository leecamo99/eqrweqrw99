/* wordlist-cleanup-patch.js v20260712-1
   One-time cleanup of misidentified lemmas.
   Merges wrong lemmas into correct forms.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[WordlistCleanup]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  // 錯誤 lemma → 正確 lemma 對照表
  var LEMMA_FIXES = {
    // -tives -> -tive
    'perspectif': 'perspective',
    'initiatif': 'initiative',
    'alternatif': 'alternative',
    'natif': 'native',
    'motif': 'motive',
    'attractif': 'attractive',
    'competitif': 'competitive',
    'productif': 'productive',
    'positif': 'positive',
    'negatif': 'negative',
    'creatif': 'creative',
    'effectif': 'effective',
    'objectif': 'objective',
    'subjectif': 'subjective',
    'reactif': 'reactive',
    'activif': 'active',

    // -tife 之類的（自加 e 錯的）
    'perspectife': 'perspective',
    'initiatife': 'initiative',
    'alternatife': 'alternative',

    // -ing 切錯
    'immers': 'immerse',
    'immer': 'immerse',
    'improv': 'improve',
    'chang': 'change',
    'creat': 'create',
    'includ': 'include',
    'excit': 'excite',
    'complet': 'complete',
    'expos': 'expose',
    'suppos': 'suppose',
    'oppos': 'oppose',
    'compos': 'compose',
    'decid': 'decide',
    'provid': 'provide',
    'reserv': 'reserve',
    'observ': 'observe',
    'serv': 'serve',
    'preserv': 'preserve',
    'move': 'move',
    'mov': 'move',
    'love': 'love',
    'lov': 'love',
    'liv': 'live',

    // -s 切錯
    'prestigiou': 'prestigious',
    'previou': 'previous',
    'seriou': 'serious',
    'variou': 'various',
    'obviou': 'obvious',
    'delicion': 'delicious',
    'religiou': 'religious',
    'gloriou': 'glorious',
    'famou': 'famous',
    'furiou': 'furious',
    'jealou': 'jealous',
    'anxiou': 'anxious'
  };

  function cleanup() {

    var db;
    try {
      db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
    } catch (e) {
      return;
    }

    if (!db.learn) return;

    var merged = 0;
    var kept = 0;

    Object.keys(LEMMA_FIXES).forEach(function (wrong) {

      var correct = LEMMA_FIXES[wrong];
      var wrongEntry = db.learn[wrong];

      if (!wrongEntry) return;

      var correctEntry = db.learn[correct];

      if (correctEntry) {
        // 兩個都有，合併到正確的
        correctEntry.clicks = (correctEntry.clicks || 0) + (wrongEntry.clicks || 0);
        correctEntry.strength = Math.max(correctEntry.strength || 0, wrongEntry.strength || 0);
        correctEntry.variants = correctEntry.variants || {};

        // 合併 variants
        if (wrongEntry.variants) {
          Object.keys(wrongEntry.variants).forEach(function (v) {
            correctEntry.variants[v] = (correctEntry.variants[v] || 0) + wrongEntry.variants[v];
          });
        }

        delete db.learn[wrong];
        merged++;
        log('merged', wrong, '→', correct);
      } else {
        // 只有錯的，改 key
        wrongEntry.word = correct;
        wrongEntry.lemma = correct;
        wrongEntry.tw = '';   // 清空翻譯讓下次重查
        wrongEntry.tip = '';
        wrongEntry.example = '';
        wrongEntry.synonyms = '';
        db.learn[correct] = wrongEntry;
        delete db.learn[wrong];
        kept++;
        log('renamed', wrong, '→', correct);
      }
    });

    // 清除 tw 是「未建字義」的 tip
    Object.values(db.learn).forEach(function (word) {
      if (word.tw && word.tw.includes('未建字義')) {
        word.tw = '';
      }
    });

    localStorage.setItem('notebook_platform_v3', JSON.stringify(db));

    log('cleanup done. merged:', merged, 'renamed:', kept);

    // 重新渲染
    if (typeof window.render === 'function') {
      try { window.render(); } catch (e) {}
    }
    if (typeof window.renderCapture === 'function') {
      try { window.renderCapture(); } catch (e) {}
    }
  }

  // 執行 3 秒後（等其他 patch 準備好）
  setTimeout(cleanup, 3000);

  log('ready v20260712-1');

})();
