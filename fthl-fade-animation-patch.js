/* fthl-fade-animation-patch.js v20260711-1
   Smooth fade-in/out highlight for FTHL.
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
      // 所有 mark 統一有 transition
      + '.card .en .mark {'
      + '  transition: background-color 220ms ease, box-shadow 220ms ease, color 220ms ease !important;'
      + '}'
      // 目前唸的字：鮮黃 + 橘色邊
      + '.card .en .mark.hl-force,'
      + '.card .en .mark.speaking,'
      + '.card .en .mark.hl-refresh {'
      + '  background-color: #ffdb26 !important;'
      + '  color: #000 !important;'
      + '  box-shadow: 0 0 0 2px #ff8800 inset !important;'
      + '}'
      // 剛唸過的字（殘影）：淡黃 + 短暫
      + '.card .en .mark.hl-recent {'
      + '  background-color: rgba(255, 219, 38, 0.35) !important;'
      + '  box-shadow: 0 0 0 1px rgba(255, 136, 0, 0.35) inset !important;'
      + '}';

    document.head.appendChild(s);
  }

  ensureCss();

  var lastEl = null;
  var recentEl = null;

  // 監聽 hl-force class 變化
  function observe() {

    var article = document.querySelector('.card .en');
    if (!article) return;

    var obs = new MutationObserver(function () {

      var current = article.querySelector('.mark.hl-force');
      if (!current) return;

      if (current === lastEl) return;

      // 移動殘影：舊的 recent 移除，last 變 recent
      if (recentEl && recentEl !== current) {
        recentEl.classList.remove('hl-recent');
      }

      if (lastEl && lastEl !== current) {
        lastEl.classList.add('hl-recent');
        recentEl = lastEl;

        // 250 ms 後移除殘影
        setTimeout((function (el) {
          return function () {
            if (el) el.classList.remove('hl-recent');
            if (recentEl === el) recentEl = null;
          };
        })(lastEl), 300);
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

  log('ready v20260711-1');

})();
