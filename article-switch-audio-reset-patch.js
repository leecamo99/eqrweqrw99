/* article-switch-audio-reset-patch.js v20260715-1
   Reset V5_MASTER_AUDIO when user switches to a different article.
   Prevents old audio from continuing to play after article change.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[SwitchAudioReset]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  var lastArticleId = null;

  function getCurrentArticleId() {

    // 用 card cid 判斷
    var card = document.querySelector('.card');
    if (card && card.dataset.cid) {
      return card.dataset.cid;
    }

    // fallback: 用文章文字前 100 字作為 hash
    var article = document.querySelector('.card .en');
    if (article) {
      var text = (article.innerText || article.textContent || '').trim().slice(0, 100);
      return 'text_' + text.replace(/\s+/g, '').slice(0, 50);
    }

    return null;
  }

  function resetAudio() {

    var audio = document.getElementById('V5_MASTER_AUDIO');

    if (!audio) {
      log('no audio to reset');
      return;
    }

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      audio.removeAttribute('src');
      audio.load();

      log('audio reset done');
    } catch (e) {
      log('reset err:', e.message);
    }
  }

  function clearAudioCache() {

    // 清除各種 TTS 相關快取
    if (window.articleAudioCache) {
      try {
        window.articleAudioCache = {};
        log('cleared articleAudioCache');
      } catch (e) {}
    }

    if (window.TTS_SEG_METADATA) {
      try {
        window.TTS_SEG_METADATA = {};
        log('cleared TTS_SEG_METADATA');
      } catch (e) {}
    }

    if (window.TTS_GLOBAL_CACHE) {
      try {
        window.TTS_GLOBAL_CACHE = {};
        log('cleared TTS_GLOBAL_CACHE');
      } catch (e) {}
    }
  }

  function stopV5CtrlBridge() {

    // v5-cache-controls-bridge 可能有 currentAudio 需要清
    if (typeof window.stopFullText === 'function') {
      try { window.stopFullText(); } catch (e) {}
    }

    if (typeof window.v5CtrlStop === 'function') {
      try { window.v5CtrlStop(); } catch (e) {}
    }

    // 停止所有 audio 元素
    document.querySelectorAll('audio').forEach(function (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch (e) {}
    });
  }

  function checkArticleSwitch() {

    var currentId = getCurrentArticleId();

    if (!currentId) return;

    if (lastArticleId === null) {
      // 第一次
      lastArticleId = currentId;
      return;
    }

    if (currentId !== lastArticleId) {

      log('article changed:', lastArticleId, '→', currentId);
      lastArticleId = currentId;

      stopV5CtrlBridge();
      resetAudio();
      clearAudioCache();

      log('all reset done');
    }
  }

  // 每 500ms 檢查文章是否切換
  setInterval(checkArticleSwitch, 500);

  // 也監聽 nb 列表點擊
  document.addEventListener('click', function (e) {

    var target = e.target;
    if (!target) return;

    var nb = target.closest('.nb');
    if (!nb) return;

    // 有點擊 notebook，300ms 後檢查是否切換
    setTimeout(checkArticleSwitch, 300);
    setTimeout(checkArticleSwitch, 600);
    setTimeout(checkArticleSwitch, 1000);
  });

  log('ready v20260715-1');

})();
