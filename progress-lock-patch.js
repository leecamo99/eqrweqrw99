/* progress-lock-patch.js v20260711-1
   Lock #gcttsProgress to use "seconds" as unit.
   Prevents v5 or other patches from setting max=wordCount.
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
      log('re-enforced max = duration', m.duration.toFixed(2));
    }
  }

  function updateValue() {

    var p = document.getElementById('gcttsProgress');
    if (!p) return;

    var m = master();
    if (!m) return;

    if (!isFinite(m.duration) || m.duration <= 0) return;

    // 拖動中就別更新
    if (p.dataset.userSeeking === '1') return;

    p.value = String(m.currentTime);
  }

  function bindSeek() {

    var p = document.getElementById('gcttsProgress');
    if (!p) return false;

    if (p.dataset.progLockBound === '1') return true;
    p.dataset.progLockBound = '1';

    // 使用者拖動時鎖住 value
    p.addEventListener('pointerdown', function () {
      p.dataset.userSeeking = '1';
    });

    p.addEventListener('touchstart', function () {
      p.dataset.userSeeking = '1';
    });

    // 拖動中即時預覽
    p.addEventListener('input', function () {

      var m = master();
      if (!m || !isFinite(m.duration)) return;

      var v = parseFloat(p.value);
      if (!isFinite(v)) return;

      // 因為我們強制 max = duration，v 就是秒數
      log('seek preview:', m.currentTime.toFixed(2), '→', v.toFixed(2));
      m.currentTime = v;
    });

    // 拖動結束
    function endSeek() {

      var m = master();
      if (!m || !isFinite(m.duration)) return;

      var v = parseFloat(p.value);
      if (!isFinite(v)) return;

      m.currentTime = v;
      log('seek final:', v.toFixed(2));

      // 200 ms 後允許 polling patch 覆蓋 value
      setTimeout(function () {
        p.dataset.userSeeking = '0';
      }, 200);
    }

    p.addEventListener('change', endSeek);
    p.addEventListener('pointerup', endSeek);
    p.addEventListener('touchend', endSeek);

    log('progress seek bound');
    return true;
  }

  // 每 100ms 檢查 + 強制修正 max
  setInterval(function () {
    enforceMax();
    updateValue();
  }, 100);

  // 綁定 seek
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (bindSeek() || tries > 60) clearInterval(t);
  }, 500);

  log('ready v20260711-1');

})();
