/* fthl-force-patch.js v20260711-2
   Precise highlight using meta segment timeline.
   Falls back to linear if no meta.
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

  function getMeta() {
    try {
      if (!window.__articleAudioCache__) return null;
      var text = (document.querySelector('.card .en') || {}).innerText || '';
      // 這裡不能等 async，用 sync 快取 id 就好
      var el = document.querySelector('.card .en');
      if (!el) return null;
      // metadata 是先前 patch 快取，我們直接讀 cache 內部
      // 因為 __articleAudioCache__.id 是 async，我們用另一個 hack：
      // 從最近一次 __V5_MASTER_AUDIO__ 的 src 判斷 id
      var m = master();
      if (!m) return null;
      var src = m.src || '';
      var match = src.match(/audio\/(a_[a-f0-9]{20})\.mp3/);
      if (!match) return null;
      var id = match[1];
      return window.__articleAudioCache__.getMeta(id);
    } catch (e) {
      return null;
    }
  }

  function wordIndexByMeta(ms, meta, domCount) {

    var segs = meta.segments;
    if (!segs || !segs.length) return -1;

    var last = segs[segs.length - 1];
    var totalMs = meta.totalMs || (last.startMs + last.durMs);
    if (!totalMs || totalMs <= 0) return -1;

    // 找目前段
    for (var i = 0; i < segs.length; i++) {

      var seg = segs[i];
      var segEnd = seg.startMs + seg.durMs;

      if (ms < segEnd) {

        var localMs = ms - seg.startMs;
        if (localMs < 0) localMs = 0;

        var frac = seg.durMs > 0 ? (localMs / seg.durMs) : 0;
        if (frac >= 1) frac = 0.999;

        // 段對應 DOM word 範圍（用 meta 段的比例映射）
        var segStartFrac = seg.startMs / totalMs;
        var segEndFrac   = segEnd     / totalMs;

        var domStart = Math.floor(segStartFrac * domCount);
        var domEnd   = Math.floor(segEndFrac   * domCount);

        if (domEnd <= domStart) domEnd = domStart + 1;
        if (domEnd > domCount) domEnd = domCount;

        var segWordCount = domEnd - domStart;
        var offset = Math.floor(frac * segWordCount);

        return Math.min(domCount - 1, domStart + offset);
      }
    }

    return domCount - 1;
  }

  function wordIndexByLinear(currentTime, duration, domCount) {
    if (!domCount) return -1;
    if (!isFinite(duration) || duration <= 0) return -1;
    var frac = currentTime / duration;
    if (frac < 0) frac = 0;
    if (frac >= 1) frac = 0.999;
    return Math.floor(frac * domCount);
  }

  function tick() {

    var m = master();
    if (!m) return;
    if (m.paused) return;
    if (!isFinite(m.duration) || m.duration <= 0) return;

    var words = document.querySelectorAll('.card .en .mark[data-key]');
    if (!words.length) return;

    var meta = getMeta();

    var idx;
    if (meta && meta.segments && meta.segments.length) {
      idx = wordIndexByMeta(m.currentTime * 1000, meta, words.length);
    } else {
      idx = wordIndexByLinear(m.currentTime, m.duration, words.length);
    }

    if (idx < 0 || idx >= words.length) return;

    if (idx === lastIdx) return;

    // 清舊
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

  setInterval(tick, 80);

  log('ready v20260711-2 (meta-precise)');

})();
