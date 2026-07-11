/* fulltext-highlight-runtime-patch.js v20260710-2
   Highlight based on segment ratio mapped onto DOM words.
   Works even when meta.words count != DOM .mark count.
*/

(function () {

  'use strict';

  var HL_CLASS = 'speaking';

  var currentMeta   = null;   // meta object
  var currentWords  = [];     // DOM .mark[data-key]
  var currentAudio  = null;
  var lastHighlight = -1;

  function log() {
    try {
      console.log.apply(console, ['[FTHL]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function master() {
    return document.getElementById('__V5_MASTER_AUDIO__');
  }

  function ensureCss() {

    if (document.getElementById('fthl-style')) return;

    var s = document.createElement('style');
    s.id = 'fthl-style';
    s.textContent = ''
      + '.card .en .mark.' + HL_CLASS + '{'
      + '  background-color: rgba(255, 224, 100, 0.8);'
      + '  color: #000;'
      + '  transition: background-color 0.15s ease;'
      + '}';
    document.head.appendChild(s);
  }

  function collectArticleWords() {
    var root = document.querySelector('.card .en');
    if (!root) return [];
    return [].slice.call(root.querySelectorAll('.mark[data-key]'));
  }

  function clearHighlight() {
    if (lastHighlight < 0) return;
    if (!currentWords.length) { lastHighlight = -1; return; }
    var el = currentWords[lastHighlight];
    if (el) el.classList.remove(HL_CLASS);
    lastHighlight = -1;
  }

  function setHighlight(idx) {

    if (idx < 0 || idx >= currentWords.length) return;
    if (idx === lastHighlight) return;

    if (lastHighlight >= 0 && currentWords[lastHighlight]) {
      currentWords[lastHighlight].classList.remove(HL_CLASS);
    }

    var el = currentWords[idx];
    if (!el) return;

    el.classList.add(HL_CLASS);

    try {
      var rect = el.getBoundingClientRect();
      if (rect.bottom < 60 || rect.top > (window.innerHeight - 100)) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    } catch (e) {}

    lastHighlight = idx;
  }

  // 用 segment 全域比例 → DOM 詞 index
  function wordIndexByMeta(ms) {

    if (!currentMeta || !currentMeta.segments || !currentMeta.segments.length) return -1;
    if (!currentWords.length) return -1;

    var segs = currentMeta.segments;
    var totalMs = currentMeta.totalMs || segs[segs.length - 1].startMs + segs[segs.length - 1].durMs;
    if (!totalMs || totalMs <= 0) return -1;

    var domCount = currentWords.length;

    // 找目前 segment
    for (var i = 0; i < segs.length; i++) {

      var seg = segs[i];
      var segEnd = seg.startMs + seg.durMs;

      if (ms < segEnd) {

        var localMs = ms - seg.startMs;
        if (localMs < 0) localMs = 0;
        var frac = seg.durMs > 0 ? (localMs / seg.durMs) : 0;
        if (frac >= 1) frac = 0.999;

        // 段內 DOM 詞範圍
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

  function wordIndexByLinear(ms, durMs) {
    if (!currentWords.length) return -1;
    if (!isFinite(durMs) || durMs <= 0) return -1;
    var frac = ms / durMs;
    if (frac < 0) frac = 0;
    if (frac > 1) frac = 1;
    return Math.min(currentWords.length - 1, Math.floor(frac * currentWords.length));
  }

  function onTimeupdate() {

    var m = currentAudio;
    if (!m) return;
    if (!currentWords.length) return;

    var ms = m.currentTime * 1000;

    var idx = -1;

    if (currentMeta && currentMeta.segments && currentMeta.segments.length) {
      idx = wordIndexByMeta(ms);
    } else {
      var dur = m.duration * 1000;
      idx = wordIndexByLinear(ms, dur);
    }

    if (idx >= 0) setHighlight(idx);
  }

  function bindAudioEvents(m) {

    if (!m || m.dataset.fthlBound === '1') return;
    m.dataset.fthlBound = '1';

    m.addEventListener('timeupdate', onTimeupdate);
    m.addEventListener('seeked', onTimeupdate);
    m.addEventListener('ended', clearHighlight);
  }

  function reset() {
    clearHighlight();
    currentMeta = null;
    currentWords = collectArticleWords();
  }

  function watchMaster() {
    var m = master();
    if (!m) return;
    currentAudio = m;
    bindAudioEvents(m);
    if (m.dataset.fthlWatch === '1') return;
    m.dataset.fthlWatch = '1';
    m.addEventListener('loadstart', onSrcChanged);
  }

  async function onSrcChanged() {

    reset();

    try {

      var text = getArticleText();
      if (!window.__articleAudioCache__ || !text) {
        log('no article cache api or no text');
        return;
      }

      var id = await window.__articleAudioCache__.id(text);
      var meta = window.__articleAudioCache__.getMeta(id);

      if (meta && meta.segments && meta.segments.length) {

        currentMeta = meta;

        log('meta ready', {
          segments: meta.segments.length,
          totalMs: meta.totalMs,
          domWords: currentWords.length,
          metaWords: meta.segments[meta.segments.length - 1].wordIndexEnd
        });

      } else {
        log('no meta, fallback linear');
      }

    } catch (e) {
      log('onSrcChanged err', e);
    }
  }

  function getArticleText() {
    var el =
      document.querySelector('.card .en') ||
      document.querySelector('#cardContent .en') ||
      document.querySelector('.article-body') ||
      document.querySelector('.card');
    return (el && el.innerText || '').trim();
  }

  ensureCss();

  var tries = 0;
  var t = setInterval(function () {
    tries++;
    watchMaster();
    if (currentAudio || tries > 60) clearInterval(t);
  }, 500);

  var target = document.querySelector('.card .en') || document.body;

  var mo = new MutationObserver(function () {
    var newWords = collectArticleWords();
    if (newWords.length && newWords.length !== currentWords.length) {
      currentWords = newWords;
      clearHighlight();
    }
  });

  mo.observe(target, { childList: true, subtree: true });

  log('ready v2');

})();
