/* progress-highlight-polling-patch.js v20260711-2
   Poll master.currentTime every 80ms.
   1. Directly update #gcttsProgress
   2. Directly dispatch 'timeupdate' event to force FTHL to run
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

  function updateProgressBar(m) {

    var p = document.getElementById('gcttsProgress');
    if (!p) return;

    var pmax = parseFloat(p.max);
    if (!isFinite(pmax) || pmax <= 0) pmax = 1;

    if (!isFinite(m.duration) || m.duration <= 0) {
      p.value = 0;
      return;
    }

    p.value = String(pmax * (m.currentTime / m.duration));
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
    if (m.paused) return;
    if (!isFinite(m.duration) || m.duration <= 0) return;

    updateProgressBar(m);
    forceDispatchTimeupdate(m);

  }, 80);

  log('ready v20260711-2');

})();
