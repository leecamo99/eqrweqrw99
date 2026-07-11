/* study-notes-clean-patch.js v20260711-1
   Hide STUDY NOTES entries with placeholder text like
   "未建字義" / "查詢中" / etc.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[StudyNotesClean]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  var PLACEHOLDERS = [
    '未建字義',
    '查詢中',
    '（未建',
    '未建',
    '請自行補充',
    '請自行',
    '請補充',
    '暫時失敗',
    'API'
  ];

  function isPlaceholder(text) {
    if (!text) return false;
    for (var i = 0; i < PLACEHOLDERS.length; i++) {
      if (text.indexOf(PLACEHOLDERS[i]) !== -1) return true;
    }
    return false;
  }

  function cleanup() {

    var items = document.querySelectorAll('.card .note .vocab li, .card .vocab li');

    var hidden = 0;

    items.forEach(function (li) {

      var small = li.querySelector('small');
      if (!small) return;

      if (isPlaceholder(small.textContent)) {
        li.style.display = 'none';
        hidden++;
      } else {
        li.style.display = '';
      }
    });

    if (hidden > 0) {
      // log('hidden', hidden, 'placeholder items');
    }
  }

  // 每 500ms 執行一次
  setInterval(cleanup, 500);

  // 監聽 vocab 變化
  var target = document.querySelector('#main');
  if (target) {
    var mo = new MutationObserver(cleanup);
    mo.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // 頁面載入後立刻執行
  setTimeout(cleanup, 500);
  setTimeout(cleanup, 2000);

  log('ready v20260711-1');

})();
