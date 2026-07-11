/* v5-cache-controls-bridge-patch.js v20260710-1
   Bridge #gcttsPause / #gcttsStop / #gcttsProgress to __V5_MASTER_AUDIO__.
*/

(function () {

  'use strict';

  function master() {
    return document.getElementById('__V5_MASTER_AUDIO__');
  }

  function log() {
    try {
      console.log.apply(console, ['[V5CtrlBridge]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function replaceBtn(sel, handler) {

    var btn = document.querySelector(sel);
    if (!btn) return null;

    if (btn.dataset.ctrlBridged === '1') return btn;

    var clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.dataset.ctrlBridged = '1';

    clone.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      handler();
    }, true);

    return clone;
  }

  function bridgePause() {

    return replaceBtn('#gcttsPause', function () {

      var m = master();
      if (!m) return;

      if (m.paused) {

        // Toggle: 若被暫停 → 繼續播（許多人期待暫停鍵也能繼續）
        m.play().catch(function (err) {
          console.warn('[V5CtrlBridge] resume err', err);
        });
        log('resumed');

      } else {

        m.pause();
        log('paused at', m.currentTime.toFixed(2));
      }
    });
  }

  function bridgeStop() {

    return replaceBtn('#gcttsStop', function () {

      var m = master();
      if (!m) return;

      try {
        m.pause();
        m.currentTime = 0;
      } catch (e) {}

      updateProgress(0, 1);
      log('stopped');
    });
  }

  function bridgeProgress() {

    var p = document.getElementById('gcttsProgress');
    if (!p) return null;

    if (p.dataset.ctrlBridged === '1') return p;
    p.dataset.ctrlBridged = '1';

    // 讓拖曳 range 更新 currentTime
    p.addEventListener('input', function () {

      var m = master();
      if (!m || !isFinite(m.duration) || m.duration <= 0) return;

      var v = parseFloat(p.value);
      if (isNaN(v)) return;

      var ratio;

      // 支援 max=1 或 max=100 或 max=duration
      var pmax = parseFloat(p.max);
      if (!isFinite(pmax) || pmax <= 0) pmax = 1;

      ratio = v / pmax;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;

      m.currentTime = m.duration * ratio;
    });

    // 拖完直接跳（部分瀏覽器不觸發 input 觸發 change）
    p.addEventListener('change', function () {

      var m = master();
      if (!m || !isFinite(m.duration) || m.duration <= 0) return;

      var v = parseFloat(p.value);
      if (isNaN(v)) return;

      var pmax = parseFloat(p.max);
      if (!isFinite(pmax) || pmax <= 0) pmax = 1;

      var ratio = v / pmax;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;

      m.currentTime = m.duration * ratio;
    });

    return p;
  }

  function updateProgress(current, duration) {

    var p = document.getElementById('gcttsProgress');
    if (!p) return;

    var pmax = parseFloat(p.max);
    if (!isFinite(pmax) || pmax <= 0) pmax = 1;

    if (duration <= 0) {
      p.value = 0;
      return;
    }

    p.value = String(pmax * (current / duration));
  }

  function bindTimeupdate() {

    var m = master();
    if (!m) return false;

    if (m.dataset.ctrlBound === '1') return true;
    m.dataset.ctrlBound = '1';

    m.addEventListener('timeupdate', function () {

      if (!isFinite(m.duration) || m.duration <= 0) return;
      updateProgress(m.currentTime, m.duration);
    });

    m.addEventListener('ended', function () {
      updateProgress(0, 1);
      log('ended');
    });

    log('audio events bound');
    return true;
  }

  // 定期嘗試綁定（因為 v5 有時候會在你進不同頁時重新 render）
  var tries = 0;
  var timer = setInterval(function () {

    tries++;

    bridgePause();
    bridgeStop();
    bridgeProgress();
    bindTimeupdate();

    if (tries > 40) clearInterval(timer);

  }, 500);

  log('ready');

})();
