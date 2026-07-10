/* tts-mobile-audio-chain-patch.js v20260710-3
   iOS Safari long-article TTS fix.
   - Reuse single <audio> element
   - Auto revoke old blob URLs
   - Warmup unlock on first click with a valid silent MP3
*/

(function () {

  'use strict';

  const isMobile =
    /iPhone|iPad|Android|Mobi/i.test(navigator.userAgent);

  if (!isMobile) {
    console.log('[TTSChain] desktop → skip');
    return;
  }

  console.log('[TTSChain] mobile → enabling');

  // ---- 1. 全域單一 audio ----
  let master = document.getElementById('__TTS_MASTER_AUDIO__');

  if (!master) {
    master = document.createElement('audio');
    master.id = '__TTS_MASTER_AUDIO__';
    master.style.display = 'none';
    document.body.appendChild(master);
  }

  window.__TTS_MASTER_AUDIO__ = master;

  // ---- 2. 覆寫 new Audio(...) → 回傳同一顆 ----
  const _Audio = window.Audio;

  window.Audio = function (src) {

    if (src) {
      try {
        master.src = src;
      } catch (e) {}
    }

    return master;
  };

  // ---- 3. 覆寫 URL.createObjectURL → 舊的先 revoke ----
  const _create = URL.createObjectURL;

  let lastObjectURL = '';

  URL.createObjectURL = function (obj) {

    if (lastObjectURL) {
      try {
        URL.revokeObjectURL(lastObjectURL);
      } catch (e) {}
      lastObjectURL = '';
    }

    const url = _create.call(URL, obj);
    lastObjectURL = url;
    return url;
  };

  // ---- 4. Warmup unlock ----
  // 用一個真的能被解碼的極短靜音 MP3 base64
  // 這是 42 bytes 的最小合法 MP3
  const SILENT_MP3 =
    'data:audio/mpeg;base64,' +
    '//uSwAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA' +
    'gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA' +
    'gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA' +
    'gICAgICAgICAgICAgP/7kmQAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

  let unlocked = false;

  function unlock() {

    if (unlocked) return;

    unlocked = true;

    try {

      const a = new _Audio(SILENT_MP3);

      a.volume = 0;

      a.play().then(() => {
        try { a.pause(); } catch (e) {}
        console.log('[TTSChain] unlocked ✓');
      }).catch(err => {
        console.warn('[TTSChain] unlock play err:', err);
      });

    } catch (e) {
      console.warn('[TTSChain] unlock err:', e);
    }
  }

  document.addEventListener('click', unlock, true);
  document.addEventListener('touchstart', unlock, true);

  console.log('[TTSChain] ready');

})();
