/* v5-fulltext-cache-hook-patch.js v20260710-2 (safe ascii) */

(function () {

  var V5_BTN_SEL = '#gcttsPlay';

  function log() {
    try {
      console.log.apply(console, ['[V5FulltextCache]'].concat([].slice.call(arguments)));
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

  // Master audio for iOS
  var master = document.getElementById('__V5_MASTER_AUDIO__');
  if (!master) {
    master = document.createElement('audio');
    master.id = '__V5_MASTER_AUDIO__';
    master.style.display = 'none';
    document.body.appendChild(master);
  }

  function playURL(url) {

    return new Promise(function (resolve, reject) {

      try {
        master.pause();
        master.currentTime = 0;
      } catch (e) {}

      master.src = url;
      master.onended = function () { resolve(); };
      master.onerror = function (e) { reject(e); };
      master.play().catch(reject);
    });
  }

  function refreshLabel(btn) {

    if (!window.__articleAudioCache__ || !window.__articleAudioCache__.has) return;

    var text = getArticleText();
    if (!text) return;

    Promise.resolve()
      .then(function () { return window.__articleAudioCache__.has(text); })
      .then(function (has) {
        btn.textContent = has ? '\u25B6 Cache' : '\u25B6 TTS';
      })
      .catch(function () {});
  }

  function onClick(e) {

    e.preventDefault();
    e.stopPropagation();

    var btn = e.currentTarget;
    var text = getArticleText();

    if (!text) {
      alert('read article failed');
      return;
    }

    if (!window.__articleAudioCache__) {
      alert('article-audio-cloud-cache-patch.js not loaded');
      return;
    }

    btn.disabled = true;
    var old = btn.textContent;
    btn.textContent = 'preparing...';

    window.__articleAudioCache__.play(text)
      .then(function (result) {

        log('mode:', result.mode, 'url:', result.url);

        btn.textContent = result.mode === 'cache'
          ? '\u25B6 Cache'
          : '\u25B6 generating';

        return playURL(result.url).then(function () { return result; });
      })
      .then(function () {
        btn.textContent = '\u25B6 Cache';
      })
      .catch(function (err) {
        console.error('[V5FulltextCache] error:', err);
        alert('play failed: ' + (err && err.message ? err.message : err));
        btn.textContent = old || '\u25B6 Full';
      })
      .then(function () {
        btn.disabled = false;
      });
  }

  function hookOnce() {

    var btn = document.querySelector(V5_BTN_SEL);
    if (!btn) return false;

    if (btn.dataset.v5CacheHooked === '1') return true;

    var clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.dataset.v5CacheHooked = '1';

    clone.addEventListener('click', onClick, true);
    refreshLabel(clone);

    setInterval(function () { refreshLabel(clone); }, 3000);

    log('hooked on', V5_BTN_SEL);
    return true;
  }

  function hideFloating() {

    var cache = document.getElementById('articleAudioCacheBtn');
    if (cache) cache.style.display = 'none';

    var all = document.querySelectorAll('button');
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      if (b.id === 'gcttsPlay') continue;
      var txt = b.textContent || '';
      if (/Cache/i.test(txt) && getComputedStyle(b).position === 'fixed') {
        b.style.display = 'none';
      }
    }
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (hookOnce()) {
      hideFloating();
      clearInterval(timer);
    }
    if (tries > 30) clearInterval(timer);
  }, 300);

  var mo = new MutationObserver(function () {
    hookOnce();
    hideFloating();
  });
  mo.observe(document.body, { childList: true, subtree: true });

})();
