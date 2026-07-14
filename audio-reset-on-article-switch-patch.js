/* audio-reset-on-article-switch-patch.js v20260715-1
   Stops and resets audio when article content changes.
/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[AudioReset]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getArticleHash() {

    var article = document.querySelector('.card .en');
    if (!article) return '';

    var text = (article.innerText || article.textContent || '').trim();

    // 用文章前 100 字 + 長度當作 hash
    return text.slice(0, 100).replace(/\s+/g, '') + '_' + text.length;
  }

  function stopAllAudio() {

    // 停止所有 audio 元素
    var audios = document.querySelectorAll('audio');
    audios.forEach(function (a) {

      try {
        a.pause();
        a.currentTime = 0;
        a.src = '';   // 清除來源
        a.load();     // 強制重載
      } catch (e) {
        log('stop err:', e.message);
      }
    });

    // 停止 SpeechSynthesis（如果有用）
    if (window.speechSynthesis) {
      try {
        speechSynthesis.cancel();
      } catch (e) {}
    }

    log('all audio stopped');
  }

  function clearTTSCache() {

    // 清除 TTS 相關全域狀態
    if (window.TTS_LAST_ORDER) {
      window.TTS_LAST_ORDER = 0;
    }

    // 重置播放進度條
    var progress = document.getElementById('gcttsProgress');
    if (progress) {
      progress.value = 0;
    }

    var currentTimeEl = document.getElementById('gcttsCurrentTime');
    if (currentTimeEl) {
      currentTimeEl.textContent = '0:00';
    }

    var totalTimeEl = document.getElementById('gcttsTotalTime');
    if (totalTimeEl) {
      totalTimeEl.textContent = '0:00';
    }

    // 重置播放按鈕狀態
    var playBtn = document.getElementById('gcttsPlay');
    if (playBtn && playBtn.textContent.indexOf('暫停') !== -1) {
      // 如果顯示「暫停」，改回「TTS」
      try {
        playBtn.click();   // 觸發暫停
      } catch (e) {}
    }
  }

  var currentHash = '';

  function checkArticleChange() {

    var hash = getArticleHash();
    if (!hash) return;

    if (currentHash === '') {
      currentHash = hash;
      return;
    }

    if (currentHash !== hash) {
      log('article changed:', 
        currentHash.slice(0, 30), 
        '→', 
        hash.slice(0, 30));

      currentHash = hash;

      stopAllAudio();
      clearTTSCache();
    }
  }

  // 每 500ms 檢查一次
  setInterval(checkArticleChange, 500);

  // 立即檢查一次
  setTimeout(checkArticleChange, 500);

  // 也監聽側邊欄筆記本切換（點擊事件）
  document.addEventListener('click', function (e) {

    // 找點擊的是否是筆記本項目
    var nb = e.target.closest('[data-nb-id], .notebook-item, [class="notebook"]');
    if (nb) {
      log('notebook clicked, will check article change');
      setTimeout(function () {
        checkArticleChange();
      }, 300);
    }

    // 也監聽 chapter 切換
    var chapter = e.target.closest('[data-chapter-id], .chapter-item, [class*="chapter"]');
    if (chapter) {
      log('chapter clicked, will check article change');
      setTimeout(function () {
        checkArticleChange();
      }, 300);
    }
  }, true);

  log('ready v20260715-1');

})();
