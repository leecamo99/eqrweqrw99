/* audio-tts-metadata-recorder-patch.js v20260710-1
   Records segment metadata (text, words, durationMs) for each TTS synthesis.
   Reads from __TTS_GLOBAL_SYNTH__ so it works with the existing global queue.
   Exposes:
     window.__TTS_SEG_METADATA__ = Map(text -> { words, durMs, blobURL })
     window.__TTS_GET_SEG_META__(text) → { words, durMs }
*/

(function () {

  'use strict';

  const STORE = new Map();

  window.__TTS_SEG_METADATA__ = STORE;

  window.__TTS_GET_SEG_META__ = function (text) {
    return STORE.get(text) || null;
  };

  function tokenizeWords(text) {

    // 保留原文順序，抽出英文單字（去掉純標點）
    const arr = [];
    const re = /[A-Za-z][A-Za-z'’-]*/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      arr.push(m[0]);
    }
    return arr;
  }

  async function measureDurationMs(blob) {

    return new Promise((resolve) => {

      try {
        const url = URL.createObjectURL(blob);
        const a = new Audio();

        a.preload = 'metadata';

        a.onloadedmetadata = () => {
          const ms = Math.round((a.duration || 0) * 1000);
          URL.revokeObjectURL(url);
          resolve(ms);
        };

        a.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(0);
        };

        a.src = url;

      } catch (e) {
        resolve(0);
      }
    });
  }

  // ---- Wrap __TTS_GLOBAL_SYNTH__ ----

  const orig = window.__TTS_GLOBAL_SYNTH__;

  if (typeof orig !== 'function') {
    console.warn('[TTSMetaRec] __TTS_GLOBAL_SYNTH__ not found, patch idle');
    return;
  }

  window.__TTS_GLOBAL_SYNTH__ = async function (text, ...rest) {

    const blob = await orig.call(this, text, ...rest);

    // 只記英文段落，且長度合理
    if (
      typeof text === 'string' &&
      text.length > 1 &&
      /[A-Za-z]/.test(text) &&
      blob instanceof Blob
    ) {

      try {

        if (!STORE.has(text)) {

          const durMs = await measureDurationMs(blob);

          const words = tokenizeWords(text);

          STORE.set(text, {
            text,
            words,
            durMs,
            recordedAt: Date.now()
          });

          console.log('[TTSMetaRec] recorded seg', {
            len: text.length,
            words: words.length,
            durMs
          });
        }

      } catch (e) {
        console.warn('[TTSMetaRec] measure err', e);
      }
    }

    return blob;
  };

  console.log('[TTSMetaRec] ready');

})();
