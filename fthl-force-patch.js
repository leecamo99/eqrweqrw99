/* fthl-force-patch.js v20260711-1
   Force reset + single highlight based on currentTime.
   Bypasses any stale state in FTHL.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[FTHLForce]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function master() {
    return document.getElementById('__V5_MASTER_AUDIO__');
  }

  function ensureCss() {
    if (document.getElementById('fthl-force-style')) return;
    var s = document.createElement('style');
    s.id = 'fthl-force-style';
    s.textContent = ''
      + '.card .en .mark.hl-force {'
      + '  background-color: #ffdb26 !important;'
      + '  color: #000 !important;'
      + '  box-shadow: 0 0 0 2px #ff8800 inset !important;'
      + '  transition: background-color 0.15s ease !important;'
      + '}';
    document.head.appendChild(s);
  }

  ensureCss();

  var lastIdx = -1;

  function tick() {

    var m = master();
    if (!m) return;
    if (m.paused) return;
    if (!isFinite(m.duration) || m.duration <= 0) return;

    var words = document.querySelectorAll('.card .en .mark[data-key]');
    if (!words.length) return;

    var frac = m.currentTime / m.duration;
    if (frac < 0) frac = 0;
    if (frac > 1) frac = 0.999;

    var idx = Math.floor(frac * words.length);
    if (idx >= words.length) idx = words.length - 1;

    if (idx === lastIdx) return;

    // 強制清除所有舊高亮，無論誰加的
    document.querySelectorAll('.card .en .mark.hl-force, .card .en .mark.speaking, .card .en .mark.hl-refresh').forEach(function (el) {
      el.classList.remove('hl-force');
      el.classList.remove('speaking');
      el.classList.remove('hl-refresh');
    });

    // 標記新的
    var target = words[idx];
    if (!target) return;
    target.classList.add('hl-force');

    // 滾動
    try {
      var rect = target.getBoundingClientRect();
      if (rect.bottom < 60 || rect.top > (window.innerHeight - 100)) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    } catch (e) {}

    lastIdx = idx;
  }

  setInterval(tick, 100);

  log('ready v20260711-1');

})();
