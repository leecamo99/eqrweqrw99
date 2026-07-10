/* tts-global-queue-patch.js v20260710-1
   Serialize all Google Cloud TTS requests globally.
   - Only 1 API call at a time
   - Shared cache across all patches
   - Auto retry with backoff on 429/5xx
*/

(function () {

  'use strict';

  const KEY_LS = 'notebook_google_cloud_tts_key_v1';
  const SET_LS = 'notebook_google_cloud_tts_settings_v1';

  const GLOBAL_CACHE = new Map();
  const queue = [];
  let isProcessing = false;

  window.__TTS_GLOBAL_CACHE__ = GLOBAL_CACHE;

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SET_LS) || '{}');
    } catch (e) {
      return {};
    }
  }

  async function realSynthesize(word) {

    const key = localStorage.getItem(KEY_LS) || '';
    if (!key) throw new Error('No API Key');

    const s = loadSettings();
    const voiceName = s.voice || 'en-US-Chirp3-HD-Aoede';
    const languageCode =
      voiceName.split('-').slice(0, 2).join('-') || 'en-US';

    const body = {
      input: { text: word },
      voice: { languageCode, name: voiceName },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: Number(s.rate || 0.92)
      }
    };

    const res = await fetch(
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=' +
        encodeURIComponent(key),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    const raw = await res.text();
    if (!res.ok) {

      const err = new Error(
        'Google TTS ' + res.status + ': ' + raw.slice(0, 160)
      );
      err.status = res.status;
      throw err;
    }

    const data = JSON.parse(raw);
    if (!data.audioContent) throw new Error('No audioContent');

    const bin = atob(data.audioContent);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'audio/mpeg' });
  }

  async function withRetry(word) {

    const maxRetry = 4;
    let attempt = 0;
    let waitMs = 400;

    while (attempt <= maxRetry) {

      try {
        return await realSynthesize(word);
      } catch (e) {

        const s = e?.status || 0;

        // 需要 retry 的錯誤
        if (s === 429 || (s >= 500 && s < 600)) {

          console.warn(
            '[TTSQueue] retry',
            word,
            'attempt',
            attempt + 1,
            'wait',
            waitMs,
            'ms'
          );

          await new Promise(r => setTimeout(r, waitMs));

          waitMs = Math.min(waitMs * 2, 5000);

          attempt++;
          continue;
        }

        // 不需要 retry 的錯誤（例如 401 API key 錯）
        throw e;
      }
    }

    throw new Error('[TTSQueue] exceeded retries: ' + word);
  }

  async function processQueue() {

    if (isProcessing) return;
    isProcessing = true;

    while (queue.length) {

      const task = queue.shift();

      try {

        // 走全域 cache
        if (GLOBAL_CACHE.has(task.word)) {
          task.resolve(GLOBAL_CACHE.get(task.word));
          continue;
        }

        const blob = await withRetry(task.word);
        GLOBAL_CACHE.set(task.word, blob);
        task.resolve(blob);

      } catch (e) {
        task.reject(e);
      }
    }

    isProcessing = false;
  }

  // 對外 API：所有 patch 都要走這個
  window.__TTS_GLOBAL_SYNTH__ = function (word) {

    word = String(word || '').trim();

    if (!word) return Promise.reject(new Error('empty'));

    if (GLOBAL_CACHE.has(word)) {
      return Promise.resolve(GLOBAL_CACHE.get(word));
    }

    return new Promise((resolve, reject) => {

      queue.push({ word, resolve, reject });
      processQueue();
    });
  };

  console.log('[TTSGlobalQueue] ready');

})();
