/* fthl-fade-animation-patch.js v20260711-2
   Stronger fade animation with visible ghost trail.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[FTHLFade]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  var CSS_ID = 'fthl-fade-style';

  function ensureCss() {

    if (document.getElementById(CSS_ID)) return;

    var s = document.createElement('style');
    s.id = CSS_ID;

    s.textContent = ''
      + '.card .en .mark, .card .en .hl-target {'
      + '  transition: background-color 380ms ease-out, box-shadow 380ms ease-out, color 380ms ease-out !important;'
      + '}'
      // 目前唸的字：鮮亮
      + '.card .en .mark.hl-force,'
      + '.card .en .hl-target.hl-force,'
      + '.card .en .mark.speaking,'
      + '.card .en .mark.hl-refresh {'
      + '  background-color: #ffdb26 !important;'
      + '  color: #000 !important;'
      + '  box-shadow: 0 0 0 2px #ff8800 inset !important;'
      + '}'
      // 剛唸過的殘影：綠色，慢慢淡出
      + '.card .en .mark.hl-recent,'
      + '.card .en .hl-target.hl-recent {'
      + '  background-color: rgba(140, 220, 140, 0.55) !important;'
      + '  box-shadow: 0 0 0 1px rgba(90, 180, 90, 0.5) inset !important;'
      + '  transition: background-color 800ms ease-out, box-shadow 800ms ease-out !important;'
      + '}';

    document.head.appendChild(s);
  }

  ensureCss();

  var lastEl = null;
  var recentEls = [];  // 殘影佇列
  var MAX_RECENT = 3;

  function observe() {

    var article = document.querySelector('.card .en');
    if (!article) return;

    var obs = new MutationObserver(function () {

      var current = article.querySelector('.hl-force');
      if (!current) return;

      if (current === lastEl) return;

      // 舊的 last 變殘影
      if (lastEl && lastEl !== current) {

        lastEl.classList.add('hl-recent');
        recentEls.push(lastEl);

        // 排出多餘的殘影
        while (recentEls.length > MAX_RECENT) {
          var old = recentEls.shift();
          if (old) old.classList.remove('hl-recent');
        }

        // 700ms 後單獨清除
        setTimeout((function (el) {
          return function () {
            if (el) el.classList.remove('hl-recent');
            var idx = recentEls.indexOf(el);
            if (idx >= 0) recentEls.splice(idx, 1);
          };
        })(lastEl), 700);
      }

      lastEl = current;
    });

    obs.observe(article, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    log('observing article for class changes');
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

  log('ready v20260711-2 (stronger fade + ghost trail)');

})();
