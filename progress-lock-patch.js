/* progress-lock-patch.js v20260711-3.1
   Clean version, no CT guard.
   User seek is respected. Trust that no other patch resets currentTime.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[ProgLock]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function master() {
    return document.getElementById('__V5_MASTER_AUDIO__');
  }

  function enforceMax() {
    var p = document.getElementById('gcttsProgress');
    if (!p) return;
    var m = master();
    if (!m) return;
    if (!isFinite(m.duration) || m.duration <= 0) return;

    var currentMax = parseFloat(p.max);
    if (Math.abs(currentMax - m.duration) > 0.5) {
      p.max = String(m.duration);
      p.step = '0.01';
    }
  }

  function updateValue() {
    var p = document.getElementById('gcttsProgress');
    if (!p) return;
    var m = master();
    if (!m) return;
    if (!isFinite(m.duration) || m.duration <= 0) return;
    if (p.dataset.userSeeking === '1') return;
    p.value = String(m.currentTime);
  }

  function bindSeek() {

    var p = document.getElementById('gcttsProgress');
    if (!p) return false;

    if (p.dataset.progLockBound === '1') return true;
    p.dataset.progLockBound = '1';

    function seekStart() {
      p.dataset.userSeeking = '1';
    }

    p.addEventListener('pointerdown', seekStart);
    p.addEventListener('touchstart', seekStart);
    p.addEventListener('mousedown', seekStart);

    // 拖動中：即時 seek
    p.addEventListener('input', function () {
      var v = parseFloat(p.value);
      if (!isFinite(v) || v < 0) return;
      var m = master();
      if (!m) return;
      try { m.currentTime = v; } catch (e) {}
    });

    // 拖動結束
    function seekEnd() {

      var v = parseFloat(p.value);
      if (!isFinite(v) || v < 0.5) {
        // 忽略異常低值（可能是誤觸）
        p.dataset.userSeeking = '0';
        return;
      }

      var m = master();
      if (!m) return;

      try { m.currentTime = v; } catch (e) {}
      log('seek to', v.toFixed(2));

      setTimeout(function () {
        p.dataset.userSeeking = '0';
      }, 200);
    }

    p.addEventListener('change', seekEnd);
    p.addEventListener('pointerup', seekEnd);
    p.addEventListener('touchend', seekEnd);

    log('progress seek bound');
    return true;
  }

  setInterval(function () {
    enforceMax();
    updateValue();
  }, 100);

  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (bindSeek() || tries > 60) clearInterval(t);
  }, 500);

  log('ready v20260711-3.1');

})();
