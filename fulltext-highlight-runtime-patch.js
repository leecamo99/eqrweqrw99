/* fulltext-highlight-runtime-patch.js v20260710-1
   Highlight words in .card .en while audio plays.
   Uses meta from __articleAudioCache__.getMeta(id) if available.
   Otherwise, falls back to linear split by article word count.
*/

(function () {

  'use strict';

  var HL_CLASS = 'speaking';

  var currentMeta   = null;   // meta object
  var currentWords  = [];     // flat list of DOM word elements in article
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

    // 我們把 .mark[data-key] 當作 word 錨點
    var nodes = root.querySelectorAll('.mark[data-key]');
    return [].slice.call(nodes);
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

    // 讓被高亮的字盡量在視窗內
    try {
      var rect = el.getBoundingClientRect();
      if (rect.bottom < 60 || rect.top > (window.innerHeight - 100)) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    } catch (e) {}

    lastHighlight = idx;
  }

  // 段落 timeline 對齊：ms -> word index
  function wordIndexByMeta(ms) {

    if (!currentMeta || !currentMeta.segments || !currentMeta.segments.length) return -1;

    var segs = currentMeta.segments;

    // 找對應的 segment
    for (var i = 0; i < segs.length; i++) {

      var seg = segs[i];
      var segEnd = seg.startMs + seg.durMs;

      if (ms < segEnd) {

        var localMs = ms - seg.startMs;
        if (localMs < 0) localMs = 0;

        var wordCount = seg.wordIndexEnd - seg.wordIndexStart;
        if (wordCount <= 0) return seg.wordIndexStart;

        var frac = seg.durMs > 0 ? (localMs / seg.durMs) : 0;
        if (frac >= 1) frac = 0.999;

        var offset = Math.floor(frac * wordCount);
        return seg.wordIndexStart + offset;
      }
    }

    // 超過總長，指最後一字
    var last = segs[segs.length - 1];
    return last.wordIndexEnd - 1;
  }

  // fallback：整段線性分配
  function wordIndexByLinear(ms, totalMs) {

    if (!currentWords.length) return -1;
    if (!isFinite(totalMs) || totalMs <= 0) return -1;

    var frac = ms / totalMs;
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
    m.addEventListener('pause', function () {
      // 保留高亮，方便看目前位置
    });
  }

  function reset() {
    clearHighlight();
    currentMeta = null;
    currentWords = collectArticleWords();
  }

  // hook 到 hook patch 播放的入口：偵測 __V5_MASTER_AUDIO__ 每次換 src
  function watchMaster() {

    var m = master();
    if (!m) return;

    currentAudio = m;

    bindAudioEvents(m);

    // 每次 src 變 → 重新載入 meta / words
    if (m.dataset.fthlWatch === '1') return;
    m.dataset.fthlWatch = '1';

    var origDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');

    // 用 loadstart 較穩：src 換了會觸發
    m.addEventListener('loadstart', function () {
      onSrcChanged();
    });
  }

  async function onSrcChanged() {

    reset();

    // 從 cache patch 拿到目前文章的 id / meta
    try {

      var text = getArticleText();

      if (window.__articleAudioCache__ && text) {

        var id = await window.__articleAudioCache__.id(text);
        var meta = window.__articleAudioCache__.getMeta(id);

        if (meta && meta.segments && meta.segments.length) {

          currentMeta = meta;

          // 對齊 word 數：若 meta 總 word 數與 DOM word 數差不多，直接用
          // 若差異太大，就當作 fallback 線性
          var metaTotal = meta.segments[meta.segments.length - 1].wordIndexEnd;

          if (Math.abs(metaTotal - currentWords.length) > Math.max(10, currentWords.length * 0.4)) {
            log('meta word count差異太大，回退線性', {
              metaTotal: metaTotal,
              domWords: currentWords.length
            });
            currentMeta = null;
          } else {
            log('meta ready', {
              segments: meta.segments.length,
              totalMs: meta.totalMs,
              domWords: currentWords.length,
              metaWords: metaTotal
            });
          }

        } else {
          log('no meta, fallback linear');
        }
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

  // 文章切換也重置一次
  var mo = new MutationObserver(function () {
    // 若 .card .en 內元素變（新文章 / patch 重繪 mark），重新收集 words
    var newWords = collectArticleWords();
    if (newWords.length && newWords.length !== currentWords.length) {
      currentWords = newWords;
      clearHighlight();
    }
  });

  var target = document.querySelector('.card .en') || document.body;
  mo.observe(target, { childList: true, subtree: true });

  log('ready');

})();
