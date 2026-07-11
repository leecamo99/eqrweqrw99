/* article-audio-cloud-cache-patch.js v20260710-3.1
   Add forceRegen(text) to always run fresh + overwrite GitHub mp3 + json.
*/

(function () {

  'use strict';

  var OWNER  = 'leecamo99';
  var REPO   = 'eqrweqrw99';
  var BRANCH = 'main';
  var DIR    = 'audio';

  var KEY_TTS_LS   = 'notebook_google_cloud_tts_key_v1';
  var KEY_SET_LS   = 'notebook_google_cloud_tts_settings_v1';
  var KEY_GH_TOKEN = 'notebook_github_token_v1';

  var availabilityCache = new Map();
  var metaCache = new Map();

  function log() {
    try {
      console.log.apply(console, ['[ArticleAudioC]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  async function articleId(text) {
    var enc = new TextEncoder().encode(String(text || '').slice(0, 400));
    var hash = await crypto.subtle.digest('SHA-256', enc);
    var arr = Array.from(new Uint8Array(hash));
    var hex = arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    return 'a_' + hex.slice(0, 20);
  }

  async function checkGitHubAudio(id) {

    if (availabilityCache.has(id)) return availabilityCache.get(id);

    var mp3Url  = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/' + DIR + '/' + id + '.mp3';
    var metaUrl = mp3Url + '.json';

    try {
      var res = await fetch(mp3Url, { method: 'HEAD' });
      if (!res.ok) {
        availabilityCache.set(id, false);
        return false;
      }

      var val = { mp3: mp3Url, meta: null };

      try {
        var metaRes = await fetch(metaUrl);
        if (metaRes.ok) {
          var j = await metaRes.json();
          if (j && j.segments) {
            metaCache.set(id, j);
            val.meta = j;
          }
        }
      } catch (e) {}

      availabilityCache.set(id, val);
      return val;

    } catch (e) {
      availabilityCache.set(id, false);
      return false;
    }
  }

  function loadTTSSettings() {
    try {
      return JSON.parse(localStorage.getItem(KEY_SET_LS) || '{}');
    } catch (e) {
      return {};
    }
  }

  function tokenizeWords(text) {
    var arr = [];
    var re = /[A-Za-z][A-Za-z'\u2019-]*/g;
    var m;
    while ((m = re.exec(text)) !== null) arr.push(m[0]);
    return arr;
  }

  function measureBlobDuration(blob) {
    return new Promise(function (resolve) {
      try {
        var url = URL.createObjectURL(blob);
        var a = new Audio();
        a.preload = 'metadata';
        a.onloadedmetadata = function () {
          var ms = Math.round((a.duration || 0) * 1000);
          URL.revokeObjectURL(url);
          resolve(ms);
        };
        a.onerror = function () {
          URL.revokeObjectURL(url);
          resolve(0);
        };
        a.src = url;
      } catch (e) {
        resolve(0);
      }
    });
  }

  async function synthesizeGoogle(text) {

    var key = localStorage.getItem(KEY_TTS_LS) || '';
    if (!key) throw new Error('No TTS API Key');

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

    var res = await fetch(
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(key),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    var raw = await res.text();
    if (!res.ok) throw new Error('TTS ' + res.status + ': ' + raw.slice(0, 160));

    var data = JSON.parse(raw);
    if (!data.audioContent) throw new Error('No audioContent');

    var bin = atob(data.audioContent);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
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
        if (dot > i + 100) end = dot + 1;
      }
      out.push(text.slice(i, end).trim());
      i = end;
    }

    return out.filter(Boolean);
  }

  async function mergeBlobs(blobs) {
    var buffers = [];
    for (var i = 0; i < blobs.length; i++) {
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

  async function githubGetSha(path) {
    var token = localStorage.getItem(KEY_GH_TOKEN);
    if (!token) return undefined;
    var url = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path + '?ref=' + BRANCH;
    try {
      var res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return undefined;
      var j = await res.json();
      return j.sha;
    } catch (e) {
      return undefined;
    }
  }

  async function githubPutFile(path, contentB64, message) {

    var token = localStorage.getItem(KEY_GH_TOKEN);
    if (!token) throw new Error('缺 GitHub Token');

    var sha = await githubGetSha(path);
    var url = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path;

    var res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        content: contentB64,
        branch: BRANCH
