/* hide-auto-translated-patch.js v20260711-1
   Hides "Auto translated by MyMemory" info line from Word Note.
*/

(function () {

  'use strict';

  var CSS_ID = 'hide-auto-translated-style';

  function ensureCss() {

    if (document.getElementById(CSS_ID)) return;

    var s = document.createElement('style');
    s.id = CSS_ID;

    s.textContent = ''
      + '/* 隱藏 Word Note 內含 Auto translated 的 div */'
      + '#dockBody div:has-text("Auto translated"),'
      + '#dockBody div[data-hide-translate="1"] {'
      + '  display: none !important;'
      + '}';

    document.head.appendChild(s);
  }

  ensureCss();

  // JS 版：因為 CSS :has-text 不是所有瀏覽器支援，用 JS 直接處理
  function cleanup() {

    var body = document.getElementById('dockBody');
    if (!body) return;

    var divs = body.querySelectorAll('div');
    divs.forEach(function (div) {

      if (div.children.length > 0) return;   // 只處理純文字 div

      var text = div.textContent || '';
      if (/Auto translated by/i.test(text)) {
        div.style.display = 'none';
      }
    });
  }

  // 監聽 dockBody 變化
  var target = document.getElementById('dockBody');
  if (target) {
    var mo = new MutationObserver(cleanup);
    mo.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  setInterval(cleanup, 500);
  setTimeout(cleanup, 200);

  console.log('[HideAutoTranslated] ready');

})();
