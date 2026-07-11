/* v5-progress-onchange-blocker-patch.js v20260711-1
   Prevents v5's built-in seekWord from firing on progress change.
   That handler triggers new TTS synthesis.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[V5ProgBlock]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function tryBlock() {

    var p = document.getElementById('gcttsProgress');
    if (!p) return false;

    if (p.dataset.v5ProgBlocked === '1') return true;
    p.dataset.v5ProgBlocked = '1';

    // 用 capture phase 攔截 change, input, pointerup 事件
    // 這樣 v5 內部的 handler 收不到

    function blocker(e) {
      // 檢查是否是我們自己觸發的（progress-lock-patch）
      if (e.__fromProgressLock === true) return;

      // 阻止傳給 v5 的 handler
      e.stopImmediatePropagation();
    }

    // v5 用 onchange 賦值，也就是 element.onchange = fn
    // 這個是 property，不是 addEventListener 註冊的
    // 我們要直接把 onchange 換掉
    var originalOnChange = p.onchange;
    if (originalOnChange) {
      log('v5 onchange handler detected, removing');
      p.onchange = null;
    }

    // 也清掉 oninput 如果 v5 有裝
    var originalOnInput = p.oninput;
    if (originalOnInput) {
      log('v5 oninput handler detected, removing');
      p.oninput = null;
    }

    log('progress onchange blocked');
    return true;
  }

  // 每 500ms 檢查一次，因為 v5 可能重新設定 onchange
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    tryBlock();

    // 持續清除 v5 對 onchange 的賦值
    var p = document.getElementById('gcttsProgress');
    if (p && p.onchange) {
      log('v5 re-assigned onchange, removing');
      p.onchange = null;
    }
    if (p && p.oninput) {
      log('v5 re-assigned oninput, removing');
      p.oninput = null;
    }

    if (tries > 200) clearInterval(t);
  }, 500);

  log('ready v20260711-1');

})();
