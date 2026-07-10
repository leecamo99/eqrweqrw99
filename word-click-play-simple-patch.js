/* word-click-play-simple-patch.js v20260710-1
   Click a word in article → speak ONLY that word.
   No family, no lemma. Uses Google Cloud TTS.
*/

(function () {

  'use strict';

  const KEY_LS = 'notebook_google_cloud_tts_key_v1';
  const SET_LS = 'notebook_google_cloud_tts_settings_v1';

  const cache = new Map();

  let currentAudio = null;

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SET_LS) || '{}');
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
    if (!res.ok) throw new Error(raw.slice(0, 200));

    const data = JSON.parse(raw);
    if (!data.audioContent) throw new Error('No audioContent');

    const bin = atob(data.audioContent);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'audio/mpeg' });
  }

  function playBlob(blob) {

    return new Promise((resolve, reject) => {

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };

      audio.onerror = (e) => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        reject(e);
      };

      audio.play().catch(reject);
    });
  }

 async function speakOne(word) {
  stopAll();

  if (typeof window.__TTS_GLOBAL_SYNTH__ !== 'function') {
    console.warn('[WordClick] global TTS not ready');
    return;
  }

  try {
    const blob = await window.__TTS_GLOBAL_SYNTH__(word);
    await playBlob(blob);
  } catch (e) {
    console.warn('[WordClick] fail:', word, e);
  }
}


  // 對外供其他 patch 呼叫（例如三態區）
  window.__speakOneWord__ = speakOne;

  // ---- 綁定文章單字點擊 ----
  document.addEventListener('click', (e) => {

    const target = e.target;
    if (!target) return;

    if (target.closest('button, input, textarea, select, a')) return;
    if (target.closest('#dockBody, #sidebar, #dock, .word-note, #wordNoteVerbBox'))
      return;

    let word = '';

    const span = target.closest('span.word, span.token, em, b');
    if (span) word = span.textContent;

    if (!word && window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) word = sel.toString().trim();
    }

    if (!word) {

      let range = null;

      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if (document.caretPositionFromPoint) {
        const p = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (p) {
          range = document.createRange();
          range.setStart(p.offsetNode, p.offset);
          range.setEnd(p.offsetNode, p.offset);
        }
      }

      if (range) {
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          const pos = range.startOffset;
          let s = pos, en = pos;
          while (s > 0 && /[A-Za-z'-]/.test(text[s - 1])) s--;
          while (en < text.length && /[A-Za-z'-]/.test(text[en])) en++;
          word = text.slice(s, en);
        }
      }
    }

    word = String(word || '').trim();

    if (!word || !/^[A-Za-z'-]+$/.test(word)) return;

    speakOne(word);

  }, true);

  console.log('[WordClickPlaySimple] ready');

})();
