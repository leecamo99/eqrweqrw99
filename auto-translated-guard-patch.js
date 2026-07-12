/* auto-translated-guard-patch.js v20260712-1
   Prevents any localStorage write from persisting "Auto translated by X | " prefix.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[AutoTransGuard]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  var origSetItem = Storage.prototype.setItem;

  Storage.prototype.setItem = function (key, value) {

    if (key === 'notebook_platform_v3' && 
        typeof value === 'string' && 
        value.indexOf('Auto translated by') !== -1) {

      try {
        var db = JSON.parse(value);
        var count = 0;

        Object.values(db.learn || {}).forEach(function (word) {
          if (word.tip && word.tip.indexOf('Auto translated by') !== -1) {
            word.tip = word.tip.replace(/^Auto translated by [^｜|]+[\|｜]\s*/, '');
            if (!word.tip.trim()) word.tip = '';
            count++;
          }
        });

        if (count > 0) {
          value = JSON.stringify(db);
        }
      } catch (e) {}
    }

    return origSetItem.call(this, key, value);
  };

  // 立即清一次現有資料
  try {
    var db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
    var count = 0;
    Object.values(db.learn || {}).forEach(function (word) {
      if (word.tip && word.tip.indexOf('Auto translated by') !== -1) {
        word.tip = word.tip.replace(/^Auto translated by [^｜|]+[\|｜]\s*/, '');
        if (!word.tip.trim()) word.tip = '';
        count++;
      }
    });
    if (count > 0) {
      origSetItem.call(localStorage, 'notebook_platform_v3', JSON.stringify(db));
      log('cleaned', count, 'existing entries');
    }
  } catch (e) {}

  log('ready v20260712-1');

})();
