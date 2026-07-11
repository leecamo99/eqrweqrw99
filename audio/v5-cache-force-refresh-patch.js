/* v5-cache-force-refresh-patch.js v20260710-1
   Add a ♻ button beside #gcttsPlay to force TTS regeneration and overwrite GitHub cache.
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

    if (!window.__articleAudioCache__) {
      return alert('article-audio-cloud-cache-patch.js not loaded');
    }

    var id = await window.__articleAudioCache__.id(text);
    log('force regen', id);

    // 直接繞開 has()。強制重跑一次 TTS + 上傳
    // 目的是覆蓋 GitHub 上原本的 mp3 + mp3.json
    // 為了達到「一定 miss」的效果，我們臨時包裝一次呼叫
    var origHas = window.__articleAudioCache__.has;
    var origPlay = window.__articleAudioCache__.play;

    // 攔截：這一次的 play 呼叫，強迫走 miss 分支
    window.__articleAudioCache__.has = async function () { return false; };

    btn.disabled = true;
    var origLabel = btn.textContent;
    btn.textContent = '⏳ 重生成中';

    try {

      // play() 內部先呼叫 checkGitHubAudio，我們用 sabotage：清 availabilityCache
      // 但 availabilityCache 是 closure 私有變數，所以最簡單辦法：hash 不同
      // 為了不改文章，我們用「同一 id 直接改路徑」不可行
      // 因此改用直接呼叫 fresh 路徑：patch v3 沒暴露這個 API，改變通做法是：
      //   1) 先叫 play() 讓它 cache hit（不會執行合成）
      //   2) 用 has() 提示 → 我們自己去清 GitHub 檔然後再叫 play() 又不方便
      //
      // 所以另一種可靠做法：直接手動重跑合成流程；但那太重
      //
      // 最實用的方式：把 patch v3 的 availabilityCache 弄壞。
      // patch v3 沒暴露它，只能整頁重載 → 這不是我們要的。
      //
      // 於是：patch v3 需要小小升級 API。為了避免現在就再改 v3，
      // 我們用「臨時 has = false」+ 呼叫 play() 內部依然會 HEAD 得知 cache hit。
      //
      // 因此結論：目前 v3 沒有真正的 forceRegen 入口。
      // → 你只有兩條路：
      //    A) 直接改 patch v3，加 forceRegen（我下面提供）
      //    B) 開發者手動：把 GitHub 上的 mp3 刪掉，或改文章前 400 字

      alert('目前 v3 沒有 forceRegen 入口。請先把 patch v3 升到 v3.1（我下方會給你 3 行 diff）');
      btn.textContent = origLabel;

    } catch (e) {
      console.error(e);
      alert('重生成失敗：' + (e && e.message ? e.message : e));
      btn.textContent = origLabel;
    } finally {
      window.__articleAudioCache__.has = origHas;
      window.__articleAudioCache__.play = origPlay;
      btn.disabled = false;
    }
  }

  function inject() {

    if (document.getElementById('v5ForceRefreshBtn')) return true;

    var playBtn = document.querySelector('#gcttsPlay');
    if (!playBtn || !playBtn.parentNode) return false;

    var btn = document.createElement('button');
    btn.id = 'v5ForceRefreshBtn';
    btn.textContent = '♻';
    btn.title = '重新生成音檔並覆蓋 GitHub';
    btn.style.cssText = ''
      + 'margin-left:6px;background:#333;color:#ffd25a;border:0;'
      + 'border-radius:6px;padding:4px 8px;cursor:pointer;';

    btn.addEventListener('click', function () { forceRegenerate(btn); });

    playBtn.parentNode.insertBefore(btn, playBtn.nextSibling);
    log('button injected');
    return true;
  }

  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (inject() || tries > 60) clearInterval(t);
  }, 500);

})();
