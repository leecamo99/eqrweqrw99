/* progress-scrub-highlight-patch.js v20260711-1
   Highlight the corresponding word immediately while dragging progress.
   Reads meta cache or falls back to linear.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[ScrubHL]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function master() {
    return document.getElementById('__V5_MASTER_AUDIO__');
  }

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

  function wordIndexByLinear(sec, duration, domCount) {
    if (!domCount) return -1;
    if (!isFinite(duration) || duration <= 0) return -1;
    var frac = sec / duration;
    if (frac < 0) frac = 0;
    if (frac >= 1) frac = 0.999;
    return Math.floor(frac * domCount);
  }

  function highlightAt(sec) {

    var m = master();
    if (!m) return;
    if (!isFinite(m.duration) || m.duration <= 0) return;

    tryFetchMeta();

    var words = document.querySelectorAll('.card .en .mark[data-key], .card .en .hl-target[data-key]');
    if (!words.length) return;

    var idx = -1;
    if (cachedMeta) {
      idx = wordIndexByMeta(sec * 1000, cachedMeta, words.length);
    }
    if (idx < 0) {
      idx = wordIndexByLinear(sec, m.duration, words.length);
    }

    if (idx < 0 || idx >= words.length) return;

    // 清舊
    document.querySelectorAll('.hl-force').forEach(function (el) {
      el.classList.remove('hl-force');
    });

    var target = words[idx];
    if (!target) return;

    target.classList.add('hl-force');

    // 滾動到視圖
    try {
      var rect = target.getBoundingClientRect();
      if (rect.bottom < 60 || rect.top > (window.innerHeight - 100)) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    } catch (e) {}
  }

  function bindScrub() {

    var p = document.getElementById('gcttsProgress');
    if (!p) return false;

    if (p.dataset.scrubBound === '1') return true;
    p.dataset.scrubBound = '1';

    p.addEventListener('input', function () {
      var v = parseFloat(p.value);
      if (!isFinite(v)) return;
      highlightAt(v);
    });

    log('scrub highlight bound');
    return true;
  }

  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (bindScrub() || tries > 60) clearInterval(t);
  }, 500);

  log('ready v20260711-1');

})();
