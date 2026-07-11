/* fthl-fade-animation-patch.js v20260711-3
   Longer fade + trailing ghost effect (up to 8 trailing words).
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[FTHLFade]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  var CSS_ID = 'fthl-fade-style';
  var TRAIL_SIZE = 8;
  var TRAIL_TIMEOUT = 2400;

  function ensureCss() {

    if (document.getElementById(CSS_ID)) return;

    var s = document.createElement('style');
    s.id = CSS_ID;

    s.textContent = ''
      // 全部字都有慢速 transition
      + '.card .en .mark, .card .en .hl-target {'
      + '  transition: background-color 600ms ease-out, box-shadow 600ms ease-out, color 300ms ease-out !important;'
      + '}'
      // 當下唸的字：明亮黃
      + '.card .en .mark.hl-force,'
      + '.card .en .hl-target.hl-force {'
      + '  background-color: #ffdb26 !important;'
      + '  color: #000 !important;'
      + '  box-shadow: 0 0 0 2px #ff8800 inset !important;'
      + '  transition: background-color 200ms ease-in !important;'
      + '}'
      // 剛過去的殘影：綠色，慢慢淡出
      + '.card .en .mark.hl-recent,'
      + '.card .en .hl-target.hl-recent {'
      + '  background-color: rgba(120, 200, 120, 0.65) !important;'
      + '  color: #000 !important;'
      + '  box-shadow: 0 0 0 1px rgba(80, 160, 80, 0.55) inset !important;'
      + '  transition: background-color 1200ms ease-out, box-shadow 1200ms ease-out !important;'
      + '}';

    document.head.appendChild(s);
  }

  ensureCss();

  var lastEl = null;
  var trail = [];  // 殘影佇列

  function observe() {

    var article = document.querySelector('.card .en');
    if (!article) return;

    var obs = new MutationObserver(function () {

      var current = article.querySelector('.hl-force');
      if (!current) return;

      if (current === lastEl) return;

      // 舊的 lastEl 變殘影
      if (lastEl && lastEl !== current) {

        lastEl.classList.add('hl-recent');
        trail.push(lastEl);

        // 排出多餘的殘影
        while (trail.length > TRAIL_SIZE) {
          var old = trail.shift();
          if (old) old.classList.remove('hl-recent');
        }

        // 用 timeout 淡出這一個
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

    log('observing article, trail size', TRAIL_SIZE);
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

  log('ready v20260711-3 (long fade + 8-word trail)');

})();
