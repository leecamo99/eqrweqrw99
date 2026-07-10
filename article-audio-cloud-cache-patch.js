/* article-audio-cloud-cache-patch.js v20260710-1
   Mode C: Auto generate + auto upload to GitHub /audio/
   Flow:
     1. On play, hash the article text -> id
     2. Try play: https://raw.githubusercontent.com/{owner}/{repo}/main/audio/{id}.mp3
     3. If not found:
        - Split text via existing Google Cloud TTS logic
        - Fetch each segment MP3 blob
        - Concatenate all blobs into 1 MP3
        - PUT to GitHub /audio/{id}.mp3 (needs token)
        - Play the merged MP3
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

  let currentAudio = null;

  function log(...a) {
    console.log('[ArticleAudioC]', ...a);
  }

  // ---- 讀文章文字 ----
  function getCurrentArticleText() {

    // 你目前顯示文章的容器 id，如果不同請自行改
    const article =
      document.getElementById('cardContent') ||
      document.querySelector('.article-body') ||
      document.querySelector('.card') ||
      document.body;

    return String(article?.innerText || '').trim();
  }

  // ---- 產生穩定 ID ----
  async function articleId(text) {

    const enc = new TextEncoder().encode(text.slice(0, 400));

    const hash = await crypto.subtle.digest('SHA-256', enc);

    const arr = Array.from(new Uint8Array(hash));

    const hex = arr.map(b => b.toString(16).padStart(2, '0')).join('');

    return 'a_' + hex.slice(0, 20);
  }

  // ---- 檢查 GitHub 是否有這個 mp3 ----
  async function checkGitHubAudio(id) {

    const url =
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${DIR}/${id}.mp3`;

    try {
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok ? url : null;
    } catch (e) {
      return null;
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

  // ---- 切段（簡化版；如果你已有更好的分段可改用） ----
  function splitText(text) {

    text = text.replace(/\s+/g, ' ').trim();

    const CHUNK = 400; // 每段最多字元
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

  // ---- 合併多個 MP3 blob ----
  // 簡單粗暴的方式：直接把 mp3 二進位串接
  // 對大多數瀏覽器都能連續播放
  async function mergeBlobs(blobs) {

    const buffers = [];

    for (const b of blobs) {
      buffers.push(new Uint8Array(await b.arrayBuffer()));
    }

    return new Blob(buffers, { type: 'audio/mpeg' });
  }

  // ---- 上傳到 GitHub ----
  async function uploadToGitHub(id, blob) {

    const token = localStorage.getItem(KEY_GH_TOKEN);

    if (!token) {
      throw new Error('缺 GitHub Token。請在 Console 執行 localStorage.setItem("notebook_github_token_v1", "你的token")');
    }

    const b64 = await blobToBase64(blob);

    const url =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DIR}/${id}.mp3`;

    // 先看看有沒有既有 sha（有的話要帶 sha 才能覆蓋，避免 conflict）
    let sha = undefined;

    try {
      const check = await fetch(url + `?ref=${BRANCH}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (check.ok) {
        const j = await check.json();
        sha = j.sha;
      }
    } catch (e) {}

    const body = {
      message: `auto: add audio ${id}`,
      content: b64,
      branch: BRANCH,
      sha
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const raw = await res.text();
    if (!res.ok) throw new Error('GitHub PUT ' + res.status + ': ' + raw.slice(0, 200));

    log('uploaded ✓', id);
  }

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

  // ---- 播放（一次到底） ----
  function playURL(url) {

    return new Promise((resolve, reject) => {

      stopCurrent();

      const audio = new Audio(url);
      currentAudio = audio;

      audio.onended = () => {
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };

      audio.onerror = (e) => {
        if (currentAudio === audio) currentAudio = null;
        reject(e);
      };

      audio.play().catch(reject);
    });
  }

  function playBlob(blob) {
    const url = URL.createObjectURL(blob);
    return playURL(url);
  }

  function stopCurrent() {

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

  // ---- 主流程 ----
  async function playCurrentArticle() {

    const text = getCurrentArticleText();
    if (!text) return alert('讀不到文章文字');

    const id = await articleId(text);
    log('article id:', id);

    // 1. GitHub 有嗎？
    const url = await checkGitHubAudio(id);

    if (url) {
      log('cache hit → play GitHub audio');
      await playURL(url);
      return;
    }

    log('cache miss → generate via Google TTS');

    // 2. 分段合成
    const segments = splitText(text);

    const blobs = [];
    let i = 0;

    for (const seg of segments) {

      i++;
      log(`synth ${i}/${segments.length}`);

      try {
        const b = await synthesizeGoogle(seg);
        blobs.push(b);
      } catch (e) {
        log('synth fail', e);
      }
    }

    if (!blobs.length) return alert('全部段落合成失敗');

    // 3. 合併
    const merged = await mergeBlobs(blobs);

    // 4. 上傳（若沒 token 就 skip 上傳，只播放）
    try {
      await uploadToGitHub(id, merged);
    } catch (e) {
      console.warn('[ArticleAudioC] upload skipped:', e.message);
    }

    // 5. 播放
    await playBlob(merged);
  }

  // ---- 對外 ----
  window.__playCurrentArticleWithCache__ = playCurrentArticle;

  // ---- 掛一個浮動按鈕 ▶ 全文（GitHub cache） ----
  const btn = document.createElement('button');
  btn.textContent = '▶ 全文（Cache）';
  btn.style.cssText = `
    position:fixed;
    right:8px;
    bottom:8px;
    z-index:2147483647;
    padding:8px 12px;
    border:none;
    border-radius:8px;
    background:#f4d27a;
    color:#111827;
    cursor:pointer;
    font-size:13px;
    font-weight:bold;
  `;
  btn.onclick = () => {
    playCurrentArticle().catch(err => {
      alert('播放失敗：' + err.message);
    });
  };

  document.body.appendChild(btn);

  log('ready');

})();
