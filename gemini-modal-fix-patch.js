/* gemini-modal-fix-patch.js v20260712-1
   Fix: Gemini modal being covered by translation box / TTS panel at the bottom.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[GeminiModalFix]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function ensureCss() {

    if (document.getElementById('geminiModalFixStyle')) return;

    var style = document.createElement('style');
    style.id = 'geminiModalFixStyle';

    style.textContent = ''

      // 讓 Gemini modal 底部保留空間給翻譯區塊 + TTS panel
      + '#geminiWeakArticleModal {'
      + '  padding-bottom: 200px !important;'
      + '}'

      // Modal 內部 box 也要有底部空間
      + '#geminiWeakArticleBox {'
      + '  margin-bottom: 20px !important;'
      + '}'

      // 手機更嚴格：底部保留更多空間
      + '@media (max-width: 760px) {'
      + '  #geminiWeakArticleModal {'
      + '    padding-bottom: 250px !important;'
      + '  }'
      + '}';

    document.head.appendChild(style);
    log('CSS applied');
  }

  ensureCss();

  log('ready v20260712-1');

})();
