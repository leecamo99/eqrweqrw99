[
/* v5-fulltext-cache-hook-patch.js v20260710-1
   Hook v5's #gcttsPlay button:
     - Cached in GitHub → play cached MP3
     - Not cached → generate via Google TTS, upload, then play
   Remove the floating articleAudioCacheBtn.
*/

(function () {

  'use strict';

  const V5_BTN_SEL = '#gcttsPlay';

  function log(...a) {
    console.log('[V5FulltextCache]', ...a);
  }

  function getArticleText() {

    const el =
      document.querySelector('.card .en') ||
      document.querySelector('#cardContent .en') ||
      document.querySelector('.article-body') ||
      document.querySelector('.card');

    return String(el?.innerText || '').trim();
  }

  // 建立單一 audio 反覆用（手機 iOS 手勢限制）
  let master = document.getElementById('__V5_MASTER_AUDIO__');
  if (!master) {
    master = document.createElement('audio');
    master.id = '__V5_MASTER_AUDIO__';
    master.style.display = 'none';
    document.body.appendChild(master);
  }

  function playURL(url) {

    return new Promise((resolve, reject) => {

      try {
        master.pause();
        master.currentTime = 0;
      } catch (e) {}

      master.src = url;
      master.onended = () => resolve();
      master.onerror = (e) => reject(e);
      master.play().catch(reject);
    });
  }

  async function refreshLabel(btn) {

    if (!window.__articleAudioCache__?.has) return;

    const text = getArticleText();
    if (!text) return;

    try {
      const has = await window.__articleAudioCache__.has(text);
      btn.textContent = has ? '▶ 全文（Cache）' : '▶ 全文（TTS）';
    } catch (e) {}
  }

  async function onClick(e) {

    e.preventDefault();
    e.stopPropagation();

    const btn = e.currentTarget;

    const text = getArticleText();
    if (!text) return alert('讀不到文章文字');

    if (!window.__articleAudioCache__) {
      return alert('article-audio-cloud-cache-patch.js 尚未載入');
    }

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = '⏳ 準備中…';

    try {

      const result = await window.__articleAudioCache__.play(text);

      log('mode:', result.mode, 'url:', result.url);

      btn.textContent = result.mode === 'cache'
        ? '▶ 全文（Cache）'
        : '▶ 全文（TTS 生成中/播放）';

      await playURL(result.url);

      btn.textContent = result.mode === 'cache'
        ? '▶ 全文（Cache）'
        : '▶ 全文（Cache）'; // 播完後這篇已經上傳了

    } catch (err) {

      console.error('[V5FulltextCache] error:', err);
      alert('播放失敗：' + (err.message || err));
      btn.textContent = old || '▶ 全文';

    } finally {

      btn.disabled = false;
    }
  }

  function hookOnce() {

    const btn = document.querySelector(V5_BTN_SEL);
    if (!btn) return false;

    if (btn.dataset.v5CacheHooked === '1') return true;

    // 移除既有 handler（若有）
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);

    clone.dataset.v5CacheHooked = '1';
    clone.addEventListener('click', onClick, true);

    // 初始化 label
    refreshLabel(clone);

    // 每 3 秒重新檢查一次 cache 狀態
    setInterval(() => refreshLabel(clone), 3000);

    log('hooked ✓ on', V5_BTN_SEL);
    return true;
  }

  // 隱藏浮動按鈕
  function hideFloating() {

    const cache = document.getElementById('articleAudioCacheBtn');
    if (cache) cache.style.display = 'none';

    // 也把其他明顯是「▶ 全文（Cache）」的按鈕藏掉（保留 gcttsPlay）
    document.querySelectorAll('button').forEach(b => {

      if (b.id === 'gcttsPlay') return;

      if (/▶\s*全文.*Cache/i.test(b.textContent) &&
          getComputedStyle(b).position === 'fixed') {
        b.style.display = 'none';
      }
    });
  }

  // v5 button 有時是動態插入，反覆嘗試
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (hookOnce()) {
      hideFloating();
      clearInterval(timer);
    }
    if (tries > 30) clearInterval(timer);
  }, 300);

  // 若 sidebar / dockBody 變動可能重繪按鈕，用 MO 觸發 rehook
  const mo = new MutationObserver(() => {
    hookOnce();
    hideFloating();
  });
  mo.observe(document.body, { childList: true, subtree: true });

})();
