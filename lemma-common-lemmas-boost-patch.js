/* lemma-common-lemmas-boost-patch.js v20260711-1
   Adds more verbs to COMMON_LEMMAS so lemmatize works correctly.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[LemmaBoost]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  // 攔截 lemmatizeWord 補丁
  if (typeof window.lemmatizeWord !== 'function') {
    log('lemmatizeWord not available');
    return;
  }

  var origLemmatize = window.lemmatizeWord;

  // 常見動詞需要「加 e」的字根
  var VERBS_WITH_E = new Set([
    'immerse', 'expose', 'compose', 'suppose', 'oppose',
    'improve', 'move', 'love', 'live', 'give', 'have', 'make',
    'come', 'become', 'welcome', 'introduce', 'produce', 'reduce',
    'induce', 'deduce', 'seduce', 'excuse', 'accuse', 'refuse',
    'confuse', 'diffuse', 'infuse', 'peruse', 'abuse', 'amuse',
    'choose', 'lose', 'compose', 'expose', 'propose', 'purpose',
    'operate', 'create', 'debate', 'donate', 'estimate', 'illustrate',
    'communicate', 'demonstrate', 'concentrate', 'celebrate',
    'exercise', 'analyse', 'analyze', 'organize', 'realize', 'utilize',
    'recognize', 'summarize', 'memorize', 'exercise', 'promise',
    'compromise', 'surprise', 'raise', 'praise', 'phrase',
    'increase', 'decrease', 'release', 'phase', 'chase',
    'purchase', 'suppose', 'compose', 'dispose', 'impose',
    'store', 'restore', 'explore', 'ignore', 'adore',
    'require', 'inquire', 'acquire', 'admire', 'desire',
    'inspire', 'expire', 'retire', 'hire', 'fire',
    'change', 'exchange', 'arrange', 'range', 'strange',
    'engage', 'manage', 'damage', 'imagine', 'examine',
    'determine', 'combine', 'define', 'refine', 'confine',
    'decline', 'define', 'outline', 'headline', 'deadline',
    'observe', 'reserve', 'preserve', 'deserve', 'nerve',
    'serve', 'curve', 'starve', 'carve', 'nerve',
    'replace', 'displace', 'trace', 'space', 'grace',
    'face', 'pace', 'place', 'race', 'brace',
    'style', 'smile', 'tile', 'while', 'pile',
    'trouble', 'double', 'couple', 'bubble', 'sample'
  ]);

  window.lemmatizeWord = function (surface) {

    var result = origLemmatize(surface);

    if (!result || !result.lemma) return result;

    // 若原本 lemma 沒有 'e' 結尾，且 lemma+'e' 在動詞字典裡
    // 就修正
    if (!result.lemma.endsWith('e')) {
      var withE = result.lemma + 'e';
      if (VERBS_WITH_E.has(withE)) {
        log('correct', result.lemma, '→', withE);
        result.lemma = withE;
      }
    }

    return result;
  };

  log('ready v20260711-1');

})();
