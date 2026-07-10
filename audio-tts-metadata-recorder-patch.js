/* audio-tts-metadata-recorder-patch.js v20260710-2
   Attach at fetch level to catch every text:synthesize call.
   Works regardless of whether v5 uses __TTS_GLOBAL_SYNTH__ or not.

   Records per-segment metadata:
     text, words, durMs, blobSize
   Exposes:
     window.__TTS_SEG_METADATA__   Map(text -> {text, words, durMs, order})
     window.__TTS_GET_SEG_META__   (text) -> object or null
     window.__TTS_LAST_ORDER__     增量計數，用來記錄合成順序
*/

(function () {

  'use strict';

  var STORE = new Map();
  window.__TTS_SEG_METADATA__ = STORE;
  window.__TTS_GET_SEG_META__ = function (text) {
    return STORE.get(text) || null;
  };

  var ORDER = 0;

  function tokenizeWords(text) {
    var arr = [];
    var re = /[A-Za-z][A-Za-z'\u2019-]*/g;
    var m;
    while ((m = re.exec(text)) !== null) arr.push(m[0]);
    return arr;
  }

  function measureDurationFromBase64(b64) {

    return new Promise(function (resolve) {

      try {

        // b64 是純 base64（不含 data: prefix）
        var binary = atob(b64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        var blob = new Blob([bytes], { type: 'audio/mp3' });
        var url = URL.createObjectURL(blob);
        var a = new Audio();

        a.preload = 'metadata';

        a.onloadedmetadata = function () {
          var ms = Math.round((a.duration || 0) * 1000);
          URL.revokeObjectURL(url);
          resolve({ ms: ms, size: blob.size });
        };

        a.onerror = function () {
          URL.revokeObjectURL(url);
          resolve({ ms: 0, size: blob.size });
        };

        a.src = url;

      } catch (e) {
        resolve({ ms: 0, size: 0 });
      }
    });
  }

  var origFetch = window.fetch;

  window.fetch = function (input, init) {

    var url = typeof input === 'string' ? input : (input && input.url) || '';

    var isSynth = /texttospeech\.googleapis\.com.*text:synthesize/i.test(url);

    // 抓 request body 的 text（用於配對記錄）
    var reqText = '';

    if (isSynth) {

      try {

        var body = init && init.body;

        if (body) {

          var raw = null;

          if (typeof body === 'string') raw = body;
          else if (body instanceof Blob) raw = null; // 難以簡單同步讀
          else if (body instanceof FormData) raw = null;
          else if (body && typeof body === 'object') raw = JSON.stringify(body);

          if (raw) {
            try {
              var j = JSON.parse(raw);
              // Google Cloud TTS：input.text 或 input.ssml
              reqText =
                (j && j.input && (j.input.text || j.input.ssml)) || '';
              // 若 SSML，把標籤去掉
              reqText = String(reqText).replace(/<[^>]+>/g, '');
            } catch (e) {}
          }
        }

      } catch (e) {}
    }

    var p = origFetch.apply(this, arguments);

    if (!isSynth) return p;

    return p.then(function (res) {

      // 我們要保留原本的 response 不被消耗，所以先 clone
      try {

        res.clone().json().then(function (json) {

          try {

            var audioB64 = json && json.audioContent;
            if (!audioB64) return;

            var text = reqText || '(unknown)';

            if (!STORE.has(text)) {

              ORDER++;
              window.__TTS_LAST_ORDER__ = ORDER;

              measureDurationFromBase64(audioB64).then(function (info) {

                STORE.set(text, {
                  text: text,
                  words: tokenizeWords(text),
                  durMs: info.ms,
                  blobSize: info.size,
                  order: ORDER,
                  recordedAt: Date.now()
                });

                console.log('[TTSMetaRec v2] recorded seg', {
                  order: ORDER,
                  chars: text.length,
                  words: STORE.get(text).words.length,
                  durMs: info.ms
                });
              });
            }

          } catch (e) {
            console.warn('[TTSMetaRec v2] parse err', e);
          }

        }).catch(function (e) {
          console.warn('[TTSMetaRec v2] json err', e);
        });

      } catch (e) {
        console.warn('[TTSMetaRec v2] clone err', e);
      }

      return res;
    });
  };

  console.log('[TTSMetaRec v2] ready (fetch-level hook)');

})();
