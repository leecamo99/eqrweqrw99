/* fthl-fade-animation-patch.js v20260711-4
   Mobile-optimized fade with quick, tight ghost trail.
   Uses shorter transitions and smaller trail to keep sync on phones.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[FTHLFade]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  var CSS_ID = 'fthl-fade-style';

  var isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);

  var TRAIL_SIZE   = isMobile ? 3 : 6;
  var TRAIL_TIMEOUT= isMobile ? 700 : 1400;
  var TRANS_MS     = isMobile ? 220 : 400;
  var TRANS_OUT_MS = isMobile ? 400 : 900;

  function ensureCss() {

    var old = document.getElementById(CSS_ID);
    if (old) old.remove();

    var s = document.createElement('style');
    s.id = CSS_ID;

    s.textContent = ''
      // 全部字都有 transition
      + '.card .en .mark, .card .en .hl-target {'
      + '  transition: background-color ' + TRANS_MS + 'ms ease-out, box-shadow ' + TRANS_MS + 'ms ease-out, color ' + TRANS_MS + 'ms ease-out !important;'
      + '}'
      // 當下唸的字：明亮黃
      + '.card .en .mark.hl-force,'
      + '.card .en .hl-target.hl-force {'
      + '  background-color: #ffdb26 !important;'
      + '  color: #000 !important;'
      + '  box-shadow: 0 0 0 2px #ff8800 inset !important;'
      + '  transition: background-color 100ms ease-in !important;'
      + '}'
      // 剛過去的殘影：綠色，快速淡出
      + '.card .en .mark.hl-recent,'
      + '.card .en .hl-target.hl-recent {'
      + '  background-color: rgba(120, 200, 120, 0.55) !important;'
      + '  color: #000 !important;'
      + '  box-shadow: 0 0 0 1px rgba(80, 160, 80, 0.4) inset !important;'
      + '  transition: background-color ' + TRANS_OUT_MS + 'ms ease-out, box-shadow ' + TRANS_OUT_MS + 'ms ease-out !important;'
      + '}';

    document.head.appendChild(s);
  }

  ensureCss();

  var lastEl = null;
  var trail = [];

  function observe() {

    var article = document.querySelector('.card .en');
    if (!article) return;

    var obs = new MutationObserver(function () {

      var current = article.querySelector('.hl-force');
      if (!current) return;
      if (current === lastEl) return;

      if (lastEl && lastEl !== current) {

        lastEl.classList.add('hl-recent');
        trail.push(lastEl);

        // 排出多餘殘影
        while (trail.length > TRAIL_SIZE) {
          var old = trail.shift();
          if (old) old.classList.remove('hl-recent');
        }

        // 定時清除單一殘影
        setTimeout((function (el) {
          return function () {
            if (el) el.classList.remove('hl-recent');
            var idx = trail.indexOf(el);
            if (idx >= 0) trail.splice(idx, 1);
          };
        })(lastEl), TRAIL_TIMEOUT);
      }

      lastEl = current;
    });

    obs.observe(article, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    log('observing, isMobile=' + isMobile + ' trail=' + TRAIL_SIZE + ' trans=' + TRANS_MS + 'ms');
  }

  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var el = document.querySelector('.card .en');
    if (el) {
      observe();
      clearInterval(t);
    }
    if (tries > 60) clearInterval(t);
  }, 500);

  log('ready v20260711-4 (mobile-optimized)');

})();
