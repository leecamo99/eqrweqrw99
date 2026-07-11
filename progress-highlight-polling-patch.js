/* progress-highlight-polling-patch.js v20260711-3
   Fixes:
     1. #gcttsProgress.max = 0 → auto set to audio.duration
     2. Poll master.currentTime every 80ms
     3. Force dispatch timeupdate event (so FTHL always runs)
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[PollHL]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function master() {
    return document.getElementById('__V5_MASTER_AUDIO__');
  }

  function ensureProgressMax(m) {
    var p = document.getElementById('gcttsProgress');
    if (!p) return;
    if (!isFinite(m.duration) || m.duration <= 0) return;

    // 統一 max 用 audio.duration（秒）
    var pmax = parseFloat(p.max);
    if (!isFinite(pmax) || pmax <= 0 || pmax === 1) {
      p.max  = String(m.duration);
      p.step = '0.01';
      log('progress.max set to duration:', m.duration);
    }
  }

  function updateProgressBar(m) {
    var p = document.getElementById('gcttsProgress');
    if (!p) return;
    if (!isFinite(m.duration) || m.duration <= 0) return;
    p.value = String(m.currentTime);
  }

  function forceDispatchTimeupdate(m) {
    try {
      var evt = new Event('timeupdate');
      m.dispatchEvent(evt);
    } catch (e) {}
  }

  setInterval(function () {
    var m = master();
    if (!m) return;
    if (!isFinite(m.duration) || m.duration <= 0) return;

    ensureProgressMax(m);

    if (m.paused) return;

    updateProgressBar(m);
    forceDispatchTimeupdate(m);

  }, 80);

  log('ready v20260711-3');

})();
