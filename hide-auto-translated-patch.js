/* hide-auto-translated-patch.js v20260711-2 */

(function () {

  var s = document.createElement('style');
  s.textContent = ''
    // 直接用 :has 或 attribute selector 隱藏
    // 由於 Auto translated 是動態文字，用 JS 加 class 更好
    + '#dockBody .auto-translated-info { display: none !important; }';

  document.head.appendChild(s);

  // 用簡單的 setInterval 標記需要隱藏的
  setInterval(function () {

    var body = document.getElementById('dockBody');
    if (!body) return;

    var divs = body.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      var div = divs[i];
      if (div.children.length > 0) continue;
      if (!div.dataset.hideChecked && /Auto translated by/i.test(div.textContent || '')) {
        div.classList.add('auto-translated-info');
        div.dataset.hideChecked = '1';
      }
    }

  }, 1000);   // 1 秒一次，不會卡

  console.log('[HideAutoTranslated] ready v2');
})();
