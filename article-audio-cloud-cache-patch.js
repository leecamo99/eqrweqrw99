/* article-audio-cloud-cache-patch.js v20260710-2
   Mode C: Auto generate + auto upload to GitHub /audio/
   - Public API for v5 to call
   - No floating button
*/

(function () {

  'use strict';

  const OWNER  = 'leecamo99';
  const REPO   = 'eqrweqrw99';
  const BRANCH = 'main';
  const DIR    = 'audio';

  const KEY_TTS_LS   = 'notebook_google_cloud_tts_key_v1';
  const KEY_SET_LS   = 'notebook_google_cloud_tts_settings_v1';
  const KEY_GH_TOKEN = 'notebook_github_token_v1';

  const availabilityCache = new Map(); // id -> url or false

  function log(...a) {
    console.log('[ArticleAudioC]', ...a);
  }

  // ---- 產生穩定 ID ----
  async function articleId(text) {

    const enc = new TextEncoder().encode(String(text || '').slice(0, 400));

    const hash = await crypto.subtle.digest('SHA-256', enc);

    const arr = Array.from(new Uint8Array(hash));

    const hex = arr.map(b => b.toString(16).padStart(2, '0')).join('');

    return 'a_' + hex.slice(0, 20);
  }

  // ---- 檢查 GitHub 是否有這個 mp3 ----
  async function checkGitHubAudio(id) {

    if (availabilityCache.has(id)) return availabilityCache.get(id);

    const url =
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${DIR}/${id}.mp3`;

    try {

      const res = await fetch(url, { method: 'HEAD' });

      const val = res.ok ? url : false;

      availabilityCache.set(id, val);
      return val;

    } catch (e) {

      availabilityCache.set(id, false);
      return false;
    }
  }

  // ---- Google Cloud TTS ----
  function loadTTSSettings() {
    try {
      return JSON.parse(localStorage.getItem(KEY_SET_LS) || '{}');
    } catch (e) {
      return {};
    }
  }

  async function synthesizeGoogle(word) {

    const key = localStorage.getItem(KEY_TTS_LS) || '';
    if (!key) throw new Error('No TTS API Key');

    const s = loadTTSSettings();
    const voiceName = s.voice || 'en-US-Chirp3-HD-Aoede';
    const lang = voiceName.split('-').slice(0, 2).join('-') || 'en-US';

    const body = {
      input: { text: word },
      voice: { languageCode: lang, name: voiceName },
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
    if (!res.ok) throw new Error('TTS ' + res.status + ': ' + raw.slice(0, 160));

    const data = JSON.parse(raw);
    if (!data.audioContent) throw new Error('No audioContent');

    const bin = atob(data.audioContent);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'audio/mpeg' });
  }

  // ---- 切段 ----
  function splitText(text) {

    text = String(text || '').replace(/\s+/g, ' ').trim();

    const CHUNK = 400;
    const out = [];

    let i = 0;
    while (i < text.length) {

      let end = Math.min(i + CHUNK, text.length);

      if (end < text.length) {
        const dot = text.lastIndexOf('.', end);
        if (dot > i + 100) end = dot + 1;
      }

      out.push(text.slice(i, end).trim());
      i = end;
    }

    return out.filter(Boolean);
  }

  async function mergeBlobs(blobs) {

    const buffers = [];

    for (const b of blobs) {
      buffers.push(new Uint8Array(await b.arrayBuffer()));
    }

    return new Blob(buffers, { type: 'audio/mpeg' });
  }

  // ---- 上傳到 GitHub ----
  function blobToBase64(blob) {

    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || '');
        resolve(s.split(',')[1] || '');
      };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async function uploadToGitHub(id, blob) {

    const token = localStorage.getItem(KEY_GH_TOKEN);
    if (!token) throw new Error('缺 GitHub Token');

    const b64 = await blobToBase64(blob);

    const url =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DIR}/${id}.mp3`;

    let sha;

    try {
      const check = await fetch(url + `?ref=${BRANCH}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (check.ok) {
        const j = await check.json();
        sha = j.sha;
      }
    } catch (e) {}

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `auto: add audio ${id}`,
        content: b64,
        branch: BRANCH,
        sha
      })
    });

    const raw = await res.text();
    if (!res.ok) throw new Error('GitHub PUT ' + res.status + ': ' + raw.slice(0, 200));

    availabilityCache.set(id, `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${DIR}/${id}.mp3`);
    log('uploaded ✓', id);
  }

  // ---- 主流程 ----
  async function play(text, forcedId) {

    text = String(text || '').trim();

    if (!text) throw new Error('沒有文章文字');

    const id = forcedId || await articleId(text);

    // 1. 檢查 cache
    const cachedUrl = await checkGitHubAudio(id);

    if (cachedUrl) {
      log('cache hit, play url:', cachedUrl);
      return { mode: 'cache', url: cachedUrl, id };
    }

    log('cache miss, generate via Google TTS');

    // 2. 分段合成
    const segments = splitText(text);
    const blobs = [];

    for (const seg of segments) {
      try {
        blobs.push(await synthesizeGoogle(seg));
      } catch (e) {
        log('synth fail', e);
      }
    }

    if (!blobs.length) throw new Error('全部段落合成失敗');

    // 3. 合併
    const merged = await mergeBlobs(blobs);

    // 4. 上傳（失敗不阻塞）
    try {
      await uploadToGitHub(id, merged);
    } catch (e) {
      console.warn('[ArticleAudioC] upload skipped:', e.message);
    }

    // 5. 回傳 blob URL
    const url = URL.createObjectURL(merged);
    return { mode: 'fresh', url, id };
  }

  async function has(text, forcedId) {
    const id = forcedId || await articleId(text);
    const v = await checkGitHubAudio(id);
    return !!v;
  }

  window.__articleAudioCache__ = { play, has, id: articleId };

  log('ready (v2, no floating button)');

})();
``
