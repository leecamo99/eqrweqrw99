/* speak-learn-word-google-cloud-patch.js v20260710-1
   Override speakLearnWord() to use Google Cloud TTS Chirp3 HD.
   - Reuses API key from google-cloud-tts-reader-patch-v5.js
   - Uses same voice / rate settings
   - Caches audio blobs per word to save API cost
   - Falls back to Web Speech if API fails
   Install after google-cloud-tts-reader-patch-v5.js
*/

(function () {

  'use strict';

  const KEY_LS = 'notebook_google_cloud_tts_key_v1';
  const SET_LS = 'notebook_google_cloud_tts_settings_v1';

  const cache = new Map();

  let currentAudio = null;

  function loadSettings() {

    try {
      return JSON.parse(
        localStorage.getItem(SET_LS) || '{}'
      );
    } catch (e) {
      return {};
    }
  }

  function stopAll() {

    try {
      window.speechSynthesis?.cancel();
    } catch (e) {}

    if (currentAudio) {

      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (e) {}

      currentAudio = null;
    }
  }

  async function synthesizeGoogle(word) {

    const key = localStorage.getItem(KEY_LS) || '';

    if (!key) throw new Error('No Google Cloud TTS API Key');

    const s = loadSettings();

    const voiceName =
      s.voice || 'en-US-Chirp3-HD-Aoede';

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
      'https://texttospeech.googleapis.com/v1/text:synthesize?key='
      + encodeURIComponent(key),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    const raw = await res.text();

    if (!res.ok) {
      throw new Error(
        'Google Cloud TTS ' + res.status + ': ' + raw.slice(0, 200)
      );
    }

    const data = JSON.parse(raw);

    if (!data.audioContent) {
      throw new Error('No audioContent');
    }

    const bin = atob(data.audioContent);

    const bytes = new Uint8Array(bin.length);

    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'audio/mpeg' });
  }

  function playBlob(blob) {

    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);

    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    };

    return audio.play();
  }

  function fallbackWebSpeech(word) {

    try {

      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.9;

      speechSynthesis.speak(u);

    } catch (e) {
      console.warn('[SpeakLearnWordGC] fallback failed', e);
    }
  }

  async function newSpeakLearnWord(word) {

    word = String(word || '').trim();

    if (!word) return;

    console.log('[SpeakLearnWordGC] speak:', word);

    stopAll();

    // 有快取直接用
    if (cache.has(word)) {

      try {
        await playBlob(cache.get(word));
        return;
      } catch (e) {
        console.warn('[SpeakLearnWordGC] cached play error', e);
      }
    }

    try {

      const blob = await synthesizeGoogle(word);

      cache.set(word, blob);

      await playBlob(blob);

    } catch (e) {

      console.warn(
        '[SpeakLearnWordGC] Google Cloud TTS failed, fallback to Web Speech',
        e
      );

      fallbackWebSpeech(word);
    }
  }

  window.speakLearnWord = newSpeakLearnWord;

  console.log('[SpeakLearnWordGC] ready');

})();
