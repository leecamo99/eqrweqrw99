/* lemma-ves-fix-patch.js v20260711-1
   Fixes -ves plural lemmatize bug.
   perspectives → perspective (not perspectif)
   initiatives → initiative
   etc.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[LemmaVesFix]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  if (typeof window.lemmatizeWord !== 'function') {
    log('lemmatizeWord not available');
    return;
  }

  // 真的用 -ves 變化的字（f → ves）
  var TRUE_VES = new Set([
    'wolves', 'knives', 'leaves', 'lives', 'wives', 'shelves',
    'thieves', 'halves', 'calves', 'elves', 'loaves', 'scarves',
    'hooves', 'selves'
  ]);

  var origLemmatize = window.lemmatizeWord;

  window.lemmatizeWord = function (surface) {

    var result = origLemmatize(surface);

    if (!result || !result.lemma) return result;

    var lower = surface.toLowerCase();

    // 只處理 -ves 結尾但不是真的 -ves 特殊字
    if (lower.endsWith('ves') && !TRUE_VES.has(lower)) {

      // 判斷是否為 -tive / -sive / -ative 等：+e 還原
      if (lower.endsWith('tives') || lower.endsWith('sives') || 
          lower.endsWith('atives') || lower.endsWith('itives')) {
        // 應該切掉 s 得到 -tive
        var correctLemma = lower.slice(0, -1);   // perspectives → perspective
        log('correct', result.lemma, '→', correctLemma);
        result.lemma = correctLemma;
        result.form = 'plural -s';
      }
      // 其他一般 -ves 字（例如 caves, saves, gives 等）：切 s
      else if (lower.length > 4 && !lower.endsWith('rves') && !lower.endsWith('lves') && !lower.endsWith('elves')) {
        // gives / caves / saves 等
        var correctLemma2 = lower.slice(0, -1);
        log('correct', result.lemma, '→', correctLemma2);
        result.lemma = correctLemma2;
        result.form = 'plural -s';
      }
    }

    return result;
  };

  log('ready v20260711-1');

})();
