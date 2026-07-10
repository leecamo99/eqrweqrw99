/* article-audio-cloud-cache-patch.js v20260711-2
   Safe clean JS version
   Mode C: Auto generate + auto upload to GitHub /audio/
   Fixes:
     1. Removes all HTML-link pollution risk
     2. Restores floating Cache button
     3. Shows light-gray "已 Cache" behind notebook title
     4. Updates badge after upload success
     5. Button self-heal every 2s
*/

(function () {
  'use strict';

  var OWNER = 'leecamo99';
  var REPO = 'eqrweqrw99';
  var BRANCH = 'main';
  var DIR = 'audio';

  var STORE = 'notebook_platform_v3';
  var KEY_TTS_LS = 'notebook_google_cloud_tts_key_v1';
  var KEY_SET_LS = 'notebook_google_cloud_tts_settings_v1';
  var KEY_GH_TOKEN = 'notebook_github_token_v1';
  var CACHE_INDEX_KEY = 'notebook_article_audio_cache_index_v2';

  var currentAudio = null;
  var cacheBtn = null;
  var refreshTimer = null;

  function log() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[ArticleAudioC v20260711-2]');
      console.log.apply(console, args);
    } catch (e) {}
  }

  function warn() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[ArticleAudioC v20260711-2]');
      console.warn.apply(console, args);
    } catch (e) {}
  }

  function getDB() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE) || '{}');
      d.notebooks = d.notebooks || [];
      d.learn = d.learn || {};
      return d;
    } catch (e) {
      return { notebooks: [], learn: {} };
    }
  }

  function getCacheIndex() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_INDEX_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveCacheIndex(x) {
    try {
      localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(x || {}));
    } catch (e) {}
  }

  function rawAudioUrl(id) {
    return 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/' + DIR + '/' + id + '.mp3';
  }

  function apiAudioUrl(id) {
    return 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + DIR + '/' + id + '.mp3';
  }

  function cleanMarkedText(s) {
    return String(s || '').replace(/\{\{|\}\}/g, '');
  }

  function getCurrentNotebookId() {
    try {
      if (typeof cur !== 'undefined' && cur) return cur;
    } catch (e) {}
    return null;
  }

  function getCurrentNotebook() {
    var d = getDB();
    var cid = getCurrentNotebookId();
    var i;

    if (cid) {
      for (i = 0; i < d.notebooks.length; i++) {
        if (d.notebooks[i].id === cid) return d.notebooks[i];
      }
    }

    return d.notebooks[0] || null;
  }

  function notebookText(nb) {
    if (!nb) return '';

    var cards = nb.cards || [];
    var out = [];
    var i;

    for (i = 0; i < cards.length; i++) {
      out.push(cards[i].title || '');
      out.push(cleanMarkedText(cards[i].text || ''));
    }

    return out.join('\n').replace(/\s+/g, ' ').trim();
  }

  function getCurrentArticleText() {
    var nb = getCurrentNotebook();
    var t = notebookText(nb);

    if (t) return t;

    var el = document.getElementById('view') || document.querySelector('.card') || document.body;
    return String(el && el.innerText ? el.innerText : '').trim();
  }

  async function articleId(text) {
    text = String(text || '').slice(0, 400);

    var enc = new TextEncoder().encode(text);
    var hash = await crypto.subtle.digest('SHA-256', enc);
    var arr = Array.from(new Uint8Array(hash));
    var hex = arr.map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');

    return 'a_' + hex.slice(0, 20);
  }

  function setButtonState(text, color) {
    if (!cacheBtn) return;
    cacheBtn.textContent = text || '\u25B6 \u5168\u6587\uFF08Cache\uFF09';
    cacheBtn.style.background = color || '#f4d27a';
  }

  function markCached(id, url) {
    if (!id) return;

    var idx = getCacheIndex();
    idx[id] = {
      cached: true,
      id: id,
      url: url || rawAudioUrl(id),
      at: Date.now()
    };

    saveCacheIndex(idx);
    updateCurrentButtonState();
    refreshSidebarLabelsSoon();
  }

  async function checkGitHubAudio(id) {
    if (!id) return null;

    var idx = getCacheIndex();
    if (idx[id] && idx[id].cached) {
      return idx[id].url || rawAudioUrl(id);
    }

    var url = rawAudioUrl(id);

    try {
      var res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (res && res.ok) {
        markCached(id, url);
        return url;
      }
    } catch (e) {}

    return null;
  }

  function loadTTSSettings() {
    try {
      return JSON.parse(localStorage.getItem(KEY_SET_LS) || '{}');
    } catch (e) {
      return {};
    }
  }

  async function synthesizeGoogle(text) {
    var key = localStorage.getItem(KEY_TTS_LS) || '';
    if (!key) throw new Error('No Google Cloud TTS API Key');

    var s = loadTTSSettings();
    var voiceName = s.voice || 'en-US-Chirp3-HD-Aoede';
    var lang = voiceName.split('-').slice(0, 2).join('-') || 'en-US';

    var body = {
      input: { text: text },
      voice: { languageCode: lang, name: voiceName },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: Number(s.rate || 0.92)
      }
    };

    var url = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(key);

    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    var raw = await res.text();
    if (!res.ok) throw new Error('TTS ' + res.status + ': ' + raw.slice(0, 180));

    var data = JSON.parse(raw);
    if (!data.audioContent) throw new Error('No audioContent');

    var bin = atob(data.audioContent);
    var bytes = new Uint8Array(bin.length);
    var i;

    for (i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    return new Blob([bytes], { type: 'audio/mpeg' });
  }

  function splitText(text) {
    text = String(text || '').replace(/\s+/g, ' ').trim();

    var CHUNK = 400;
    var out = [];
    var i = 0;

    while (i < text.length) {
      var end = Math.min(i + CHUNK, text.length);

      if (end < text.length) {
        var dot = text.lastIndexOf('.', end);
        var comma = text.lastIndexOf(',', end);
        var semi = text.lastIndexOf(';', end);
        var cut = Math.max(dot, comma, semi);

        if (cut > i + 120) end = cut + 1;
      }

      var part = text.slice(i, end).trim();
      if (part) out.push(part);
      i = end;
    }

    return out;
  }

  async function mergeBlobs(blobs) {
    var buffers = [];
    var i;

    for (i = 0; i < blobs.length; i++) {
      buffers.push(new Uint8Array(await blobs[i].arrayBuffer()));
    }

    return new Blob(buffers, { type: 'audio/mpeg' });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var s = String(r.result || '');
        resolve(s.split(',')[1] || '');
      };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async function uploadToGitHub(id, blob) {
    var token = localStorage.getItem(KEY_GH_TOKEN) || '';
    if (!token) throw new Error('missing GitHub Token');

    var url = apiAudioUrl(id);
    var sha = null;

    try {
      var check = await fetch(url + '?ref=' + encodeURIComponent(BRANCH), {
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/vnd.github+json'
        }
      });

      if (check.ok) {
        var j = await check.json();
        sha = j.sha;
      }
    } catch (e) {}

    var body = {
      message: 'auto: add audio ' + id,
      content: await blobToBase64(blob),
      branch: BRANCH
    };

    if (sha) body.sha = sha;

    var res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    var raw = await res.text();
    if (!res.ok) throw new Error('GitHub PUT ' + res.status + ': ' + raw.slice(0, 220));

    markCached(id, rawAudioUrl(id));
  }

  function stopCurrent() {
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (e) {}

    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (e) {}
      currentAudio = null;
    }
  }

  function playURL(url) {
    return new Promise(function (resolve, reject) {
      stopCurrent();

      var audio = new Audio(url);
      currentAudio = audio;

      audio.onended = function () {
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };

      audio.onerror = function (e) {
        if (currentAudio === audio) currentAudio = null;
        reject(e);
      };

      audio.play().catch(reject);
    });
  }

  function playBlob(blob) {
    var url = URL.createObjectURL(blob);
    return playURL(url);
  }

  async function playCurrentArticle() {
    var text = getCurrentArticleText();

    if (!text) {
      alert('\u8B80\u4E0D\u5230\u6587\u7AE0\u6587\u5B57');
      return;
    }

    var id = await articleId(text);
    log('article id', id);

    setButtonState('\u6AA2\u67E5 Cache\u2026', '#d9d0bc');

    var cachedUrl = await checkGitHubAudio(id);
    if (cachedUrl) {
      setButtonState('\u25B6 \u5168\u6587\uFF08\u5DF2 Cache\uFF09', '#b7d7a8');
      await playURL(cachedUrl);
      return;
    }

    var segments = splitText(text);
    var blobs = [];
    var i;

    if (!segments.length) {
      setButtonState('\u25B6 \u5168\u6587\uFF08Cache\uFF09', '#f4d27a');
      alert('\u6587\u7AE0\u6C92\u6709\u53EF\u5408\u6210\u7684\u6587\u5B57');
      return;
    }

    for (i = 0; i < segments.length; i++) {
      setButtonState('\u751F\u6210\u97F3\u6A94 ' + (i + 1) + '/' + segments.length, '#f4d27a');
      try {
        var b = await synthesizeGoogle(segments[i]);
        blobs.push(b);
      } catch (e) {
        warn('synth fail', e);
      }
    }

    if (!blobs.length) {
      setButtonState('\u25B6 \u5168\u6587\uFF08Cache\uFF09', '#f4d27a');
      alert('\u5168\u90E8\u6BB5\u843D\u5408\u6210\u5931\u6557');
      return;
    }

    var merged = await mergeBlobs(blobs);

    try {
      setButtonState('\u4E0A\u50B3 Cache\u2026', '#f4d27a');
      await uploadToGitHub(id, merged);
      setButtonState('\u25B6 \u5168\u6587\uFF08\u5DF2 Cache\uFF09', '#b7d7a8');
    } catch (e) {
      warn('upload skipped', e && e.message);
      setButtonState('\u25B6 \u5168\u6587\uFF08\u672A\u4E0A\u50B3\uFF09', '#f4d27a');
    }

    await playBlob(merged);
  }

  async function updateCurrentButtonState() {
    try {
      var text = getCurrentArticleText();
      if (!text) {
        setButtonState('\u25B6 \u5168\u6587\uFF08Cache\uFF09', '#f4d27a');
        return;
      }

      var id = await articleId(text);
      var idx = getCacheIndex();

      if (idx[id] && idx[id].cached) {
        setButtonState('\u25B6 \u5168\u6587\uFF08\u5DF2 Cache\uFF09', '#b7d7a8');
      } else {
        setButtonState('\u25B6 \u5168\u6587\uFF08Cache\uFF09', '#f4d27a');
      }
    } catch (e) {
      setButtonState('\u25B6 \u5168\u6587\uFF08Cache\uFF09', '#f4d27a');
    }
  }

  function addFloatingButton() {
    var old = document.getElementById('articleAudioCacheBtn');

    if (old) {
      cacheBtn = old;
      old.style.display = 'block';
      old.style.visibility = 'visible';
      old.style.opacity = '1';
      return;
    }

    cacheBtn = document.createElement('button');
    cacheBtn.id = 'articleAudioCacheBtn';
    cacheBtn.textContent = '\u25B6 \u5168\u6587\uFF08Cache\uFF09';

    cacheBtn.style.cssText =
      'position:fixed;' +
      'right:8px;' +
      'bottom:72px;' +
      'z-index:2147483647;' +
      'padding:8px 12px;' +
      'border:none;' +
      'border-radius:8px;' +
      'background:#f4d27a;' +
      'color:#111827;' +
      'cursor:pointer;' +
      'font-size:13px;' +
      'font-weight:bold;' +
      'box-shadow:0 4px 12px rgba(0,0,0,.18);' +
      'display:block;' +
      'visibility:visible;' +
      'opacity:1;';

    cacheBtn.onclick = function () {
      playCurrentArticle().catch(function (err) {
        setButtonState('\u25B6 \u5168\u6587\uFF08Cache\uFF09', '#f4d27a');
        alert('\u64AD\u653E\u5931\u6557\uFF1A' + (err && err.message ? err.message : err));
      });
    };

    document.body.appendChild(cacheBtn);
  }

  function addStyle() {
    if (document.getElementById('articleAudioCacheStyleV2')) return;

    var style = document.createElement('style');
    style.id = 'articleAudioCacheStyleV2';
    style.textContent =
      '.nb-cache-label-v2{' +
      'margin-left:6px;' +
      'color:#b8b8b8;' +
      'font-size:11px;' +
      'font-weight:normal;' +
      'white-space:nowrap;' +
      'opacity:.9;' +
      '}' +
      'body.dark .nb-cache-label-v2{' +
      'color:#8f8f8f;' +
      '}' +
      '#articleAudioCacheBtn:hover{' +
      'filter:brightness(.96);' +
      '}';

    document.head.appendChild(style);
  }

  function findNotebookElementById(id) {
    var list = document.querySelectorAll('.nb');
    var i;

    for (i = 0; i < list.length; i++) {
      var el = list[i];
      var click = el.getAttribute('onclick') || '';
      if (click.indexOf(id) >= 0) return el;
    }

    return null;
  }

  async function refreshSidebarLabels() {
    try {
      var d = getDB();
      var idx = getCacheIndex();
      var i;

      for (i = 0; i < d.notebooks.length; i++) {
        var nb = d.notebooks[i];
        var text = notebookText(nb);
        if (!text) continue;

        var id = await articleId(text);
        var el = findNotebookElementById(nb.id);
        if (!el) continue;

        var old = el.querySelector('.nb-cache-label-v2');
        if (old && old.parentNode) old.parentNode.removeChild(old);

        if (idx[id] && idx[id].cached) {
          var title = el.querySelector('b');
          if (title) {
            var span = document.createElement('span');
            span.className = 'nb-cache-label-v2';
            span.textContent = ' \u2713 \u5DF2 Cache';
            title.parentNode.insertBefore(span, title.nextSibling);
          }
        }
      }
    } catch (e) {
      warn('refreshSidebarLabels fail', e);
    }
  }

  function refreshSidebarLabelsSoon() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      refreshSidebarLabels();
    }, 120);
  }

  function hookRender() {
    try {
      if (typeof render !== 'function') return;
      if (window.__articleAudioCacheV2Hooked__) return;

      window.__articleAudioCacheV2Hooked__ = true;
      var oldRender = render;

      render = function () {
        var r = oldRender.apply(this, arguments);
        setTimeout(function () {
          refreshSidebarLabels();
          updateCurrentButtonState();
        }, 150);
        return r;
      };
    } catch (e) {
      warn('hookRender fail', e);
    }
  }

  function forceButtonAlive() {
    setInterval(function () {
      try {
        var b = document.getElementById('articleAudioCacheBtn');
        if (!b) {
          addFloatingButton();
          updateCurrentButtonState();
        } else {
          b.style.display = 'block';
          b.style.visibility = 'visible';
          b.style.opacity = '1';
          b.style.zIndex = '2147483647';
        }
      } catch (e) {}
    }, 2000);
  }

  function init() {
    addStyle();
    addFloatingButton();
    hookRender();
    forceButtonAlive();

    window.__playCurrentArticleWithCache__ = playCurrentArticle;
    window.__refreshArticleAudioCacheBadges__ = refreshSidebarLabels;
    window.__articleAudioCacheCheckCurrent__ = updateCurrentButtonState;
    window.__articleAudioCacheId__ = articleId;

    setTimeout(function () {
      refreshSidebarLabels();
      updateCurrentButtonState();
    }, 300);

    log('ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
