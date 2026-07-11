/* fthl-force-patch.js v20260711-4
   Selects both .mark and .hl-target for highlight.
   Meta-precise with linear fallback.
*/

(function () {

  'use strict';

  var SELECTOR = '.card .en .mark[data-key], .card .en .hl-target[data-key]';

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
      + '.card .en .mark.hl-force, .card .en .hl-target.hl-force {'
      + '  background-color: #ffdb26 !important;'
      + '  color: #000 !important;'
      + '  box-shadow: 0 0 0 2px #ff8800 inset !important;'
      + '}';
    document.head.appendChild(s);
  }

  ensureCss();

  var lastIdx = -1;
  var cachedMeta = null;
  var cachedMetaFor = null;

  function tryFetchMeta() {
    var m = master();
    if (!m) return;
    var src = m.src || '';
    var match = src.match(/audio\/(a_[a-f0-9]{20})\.mp3/);
    if (!match) return;
    var id = match[1];
    if (cachedMetaFor === id && cachedMeta) return;
    if (!window.__articleAudioCache__ || !window.__articleAudioCache__.getMeta) return;
    var meta = window.__articleAudioCache__.getMeta(id);
    if (meta && meta.segments && meta.segments.length) {
      cachedMeta = meta;
      cachedMetaFor = id;
      log('meta cached for', id, '(' + meta.segments.length + ' segs)');
    }
  }

  function wordIndexByMeta(ms, meta, domCount) {

    var segs = meta.segments;
    if (!segs || !segs.length) return -1;

    var last = segs[segs.length - 1];
    var totalMs = meta.totalMs || (last.startMs + last.durMs);
    if (!totalMs || totalMs <= 0) return -1;

    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      var segEnd = seg.startMs + seg.durMs;

      if (ms < segEnd) {
        var localMs = ms - seg.startMs;
        if (localMs < 0) localMs = 0;

        var frac = seg.durMs > 0 ? (localMs / seg.durMs) : 0;
        if (frac >= 1) frac = 0.999;

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

    tryFetchMeta();

    var words = document.querySelectorAll(SELECTOR);
    if (!words.length) return;

    var idx = -1;
    if (cachedMeta) {
      idx = wordIndexByMeta(m.currentTime * 1000, cachedMeta, words.length);
    }
    if (idx < 0) {
      idx = wordIndexByLinear(m.currentTime, m.duration, words.length);
    }

    if (idx < 0 || idx >= words.length) return;
    if (idx === lastIdx) return;

    document.querySelectorAll('.card .en .mark.hl-force, .card .en .hl-target.hl-force, .card .en .mark.speaking, .card .en .mark.hl-refresh').forEach(function (el) {
      el.classList.remove('hl-force');
      el.classList.remove('speaking');
      el.classList.remove('hl-refresh');
    });

    var target = words[idx];
    if (!target) return;
    target.classList.add('hl-force');

    try {
      var rect = target.getBoundingClientRect();
      if (rect.bottom < 60 || rect.top > (window.innerHeight - 100)) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    } catch (e) {}

    lastIdx = idx;
  }

  setInterval(tick, 250);

  log('ready v20260711-4 (mark + hl-target, meta with linear fallback)');

})();
