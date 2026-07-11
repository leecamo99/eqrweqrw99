/* study-notes-layout-patch.js v20260711-1
   Moves STUDY NOTES from right column to below the article.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[StudyNotesLayout]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  var CSS_ID = 'study-notes-layout-style';

  function ensureCss() {

    if (document.getElementById(CSS_ID)) return;

    var s = document.createElement('style');
    s.id = CSS_ID;

    s.textContent = ''

      // 覆蓋 grid，改成單欄
      + '.card {'
      + '  display: block !important;'
      + '  grid-template-columns: 1fr !important;'
      + '}'

      // 文章區塊全寬
      + '.card .en {'
      + '  width: 100%;'
      + '  display: block;'
      + '  margin-bottom: 16px;'
      + '}'

      // STUDY NOTES 也全寬，加上分隔線
      + '.card .note {'
      + '  width: 100%;'
      + '  display: block;'
      + '  margin-top: 16px;'
      + '  padding-top: 16px;'
      + '  border-top: 2px solid var(--line, #d9cfbc);'
      + '}';

    document.head.appendChild(s);

    log('layout CSS applied');
  }

  ensureCss();

  log('ready v20260711-1');

})();
