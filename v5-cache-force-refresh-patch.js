/* v5-cache-force-refresh-patch.js v20260711-1
   Adds a ♻ button beside #gcttsPlay to force regenerate audio and overwrite GitHub cache.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[V5ForceRefresh]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getArticleText() {
    var el =
      document.querySelector('.card .en') ||
      document.querySelector('#cardContent .en') ||
      document.querySelector('.article-body') ||
      document.querySelector('.card');
    return (el && el.innerText || '').trim();
  }

  function master() {
    return document.getElementById('__V5_MASTER_AUDIO__');
  }

  function playURL(url) {
    return new Promise(function (resolve, reject) {
      var m = master();
      if (!m) return reject(new Error('no master audio'));
      try { m.pause(); m.currentTime = 0; } catch (e) {}
      m.src = url;
      m.onended = function () { resolve(); };
      m.onerror = function (e) { reject(e); };
      m.play().catch(reject);
    });
  }

  async function forceRegenerate(btn) {

    var text = getArticleText();
    if (!text) return alert('讀不到文章文字');

    if (!window.__articleAudioCache__ || !window.__articleAudioCache__.forceRegen) {
      return alert('article-audio-cloud-cache-patch.js 需要 v3.1 以上');
    }

    var confirmMsg =
      '將重新呼叫 Google Cloud TTS 合成本文，並覆蓋 GitHub 上的 mp3 與 mp3.json。\n' +
      '此動作會消耗 TTS 配額。要繼續嗎？';

    if (!confirm(confirmMsg)) return;

    btn.disabled = true;
    var origLabel = btn.textContent;
    btn.textContent = '⏳';

    try {

      var result = await window.__articleAudioCache__.forceRegen(text);
      log('done', result.id);
      await playURL(result.url);
      btn.textContent = origLabel;

    } catch (e) {

      console.error(e);
      alert('重生成失敗：' + (e && e.message ? e.message : e));
      btn.textContent = origLabel;

    } finally {
      btn.disabled = false;
    }
  }

  function inject() {

    if (document.getElementById('v5ForceRefreshBtn')) return true;

    var playBtn = document.querySelector('#gcttsPlay');
    if (!playBtn || !playBtn.parentNode) return false;

    var btn = document.createElement('button');
    btn.id = 'v5ForceRefreshBtn';
    btn.type = 'button';
    btn.textContent = '\u267B';
    btn.title = '重新生成音檔並覆蓋 GitHub';

    btn.style.cssText = ''
      + 'margin-left:6px;'
      + 'background:#333;'
      + 'color:#ffd25a;'
      + 'border:0;'
      + 'border-radius:6px;'
      + 'padding:4px 8px;'
      + 'cursor:pointer;';

    btn.addEventListener('click', function () {
      forceRegenerate(btn);
    });

    playBtn.parentNode.insertBefore(btn, playBtn.nextSibling);
    log('button injected');
    return true;
  }

  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (inject() || tries > 60) clearInterval(t);
  }, 500);

  log('ready v20260711-1');

})();
