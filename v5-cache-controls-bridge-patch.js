/* v5-cache-controls-bridge-patch.js v20260710-3
   - #gcttsPause = single toggle (暫停 <-> 繼續)
   - #gcttsResume = permanently hidden
   - #gcttsStop  = stop + reset progress
   - #gcttsProgress = seek __V5_MASTER_AUDIO__
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
      handler(clone);
    }, true);

    return clone;
  }

  function refreshPauseLabel(btn) {

    if (!btn) return;

    var m = master();

    if (!m || !m.src) {
      btn.textContent = '\u23EF 播/暫';
      return;
    }

    if (m.paused) {
      if (m.currentTime > 0) {
        btn.textContent = '\u25B6 繼續';
      } else {
        btn.textContent = '\u23EF 播/暫';
      }
    } else {
      btn.textContent = '\u23F8 暫停';
    }
  }

  function bridgePause() {

    var btn = replaceBtn('#gcttsPause', function (btn) {

      var m = master();
      if (!m) return;

      if (m.paused) {

        m.play().then(function () {
          log('resumed');
          refreshPauseLabel(btn);
        }).catch(function (err) {
          console.warn('[V5CtrlBridge] resume err', err);
        });

      } else {

        m.pause();
        log('paused at', m.currentTime.toFixed(2));
        refreshPauseLabel(btn);
      }
    });

    if (btn) refreshPauseLabel(btn);
    return btn;
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
      refreshPauseLabel(document.querySelector('#gcttsPause'));
      log('stopped');
    });
  }

  function hideResume() {

    var r = document.getElementById('gcttsResume');
    if (!r) return;

    if (r.dataset.ctrlHidden === '1') return;
    r.dataset.ctrlHidden = '1';

    // 完全隱藏（保留在 DOM，避免 v5 內部有 code 找不到會出錯）
    r.style.setProperty('display', 'none', 'important');
    r.style.setProperty('visibility', 'hidden', 'important');
    r.setAttribute('aria-hidden', 'true');
    r.disabled = true;
  }

  function bridgeProgress() {

    var p = document.getElementById('gcttsProgress');
    if (!p) return null;

    if (p.dataset.ctrlBridged === '1') return p;
    p.dataset.ctrlBridged = '1';

    function seekFrom(v) {

      var m = master();
      if (!m || !isFinite(m.duration) || m.duration <= 0) return;

      var num = parseFloat(v);
      if (isNaN(num)) return;

      var pmax = parseFloat(p.max);
      if (!isFinite(pmax) || pmax <= 0) pmax = 1;

      var ratio = num / pmax;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;

      m.currentTime = m.duration * ratio;
    }

    p.addEventListener('input',  function () { seekFrom(p.value); });
    p.addEventListener('change', function () { seekFrom(p.value); });

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

  function bindAudioEvents() {

    var m = master();
    if (!m) return false;

    if (m.dataset.ctrlBound === '1') return true;
    m.dataset.ctrlBound = '1';

    m.addEventListener('timeupdate', function () {
      if (!isFinite(m.duration) || m.duration <= 0) return;
      updateProgress(m.currentTime, m.duration);
    });

    m.addEventListener('play',  function () {
      refreshPauseLabel(document.querySelector('#gcttsPause'));
    });

    m.addEventListener('pause', function () {
      refreshPauseLabel(document.querySelector('#gcttsPause'));
    });

    m.addEventListener('ended', function () {
      updateProgress(0, 1);
      refreshPauseLabel(document.querySelector('#gcttsPause'));
      log('ended');
    });

    log('audio events bound');
    return true;
  }

  var tries = 0;

  var timer = setInterval(function () {

    tries++;

    bridgePause();
    bridgeStop();
    hideResume();
    bridgeProgress();
    bindAudioEvents();

    // v5 有時會更新按鈕文字，我們每 loop 幫忙同步
    refreshPauseLabel(document.querySelector('#gcttsPause'));

    if (tries > 60) clearInterval(timer);

  }, 500);

  log('ready v3 (single pause/resume toggle)');

})();
