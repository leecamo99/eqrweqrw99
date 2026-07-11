/* wordnote-reopen-fix-patch.js v20260711-1
   Clear inline display style on dock before reopen.
   This fixes the "second click doesn't reopen" bug.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[WNFix]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  document.addEventListener('click', function (e) {

    var target = e.target;
    if (!target) return;

    // 檢查是否點在單字上
    var mark = target.closest('.card .en .mark[data-key], .card .en .hl-target[data-key]');
    if (!mark) return;

    var dock = document.getElementById('dock');
    if (!dock) return;

    // 關鍵：清除 inline display style，讓 CSS class 生效
    if (dock.style.display === 'none' || dock.style.display === '') {
      dock.style.display = '';
      dock.style.visibility = '';
      dock.style.opacity = '';
      log('cleared inline display for reopen');
    }

  }, true);  // capture phase，比其他 handler 早執行

  log('ready v20260711-1');

})();
