/* wordnote-force-update-patch.js v20260711-2
   Forces window.showWord to render dockBody directly.
   Bypasses patch scope issues where showWordPatched is not executed.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[WNForceShow]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function esc(s) {
    return String(s || '').replace(/[<>&"']/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getDB() {
    try {
      return JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
    } catch (e) {
      return {};
    }
  }

  // 強制版 showWord
  function forceShowWord(surfaceOrLemma) {

    var db = getDB();
    db.learn = db.learn || {};

    var info = window.lemmatizeWord ? window.lemmatizeWord(surfaceOrLemma) : { lemma: surfaceOrLemma };
    var lemma = info.lemma || surfaceOrLemma;

    var x = db.learn[lemma] || db.learn[surfaceOrLemma];

    if (!x) {
      log('no data for', lemma);
      return;
    }

    var dockBody = document.getElementById('dockBody');
    var dock = document.getElementById('dock');

    if (!dockBody || !dock) return;

    var variants = Object.entries(x.variants || {})
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (kv) { return esc(kv[0]) + ' ×' + kv[1]; })
      .join(', ');

    dockBody.innerHTML =
      '<div class="wordbig">' + esc(x.lastSurface || surfaceOrLemma) + '</div>' +
      '<div style="color:var(--muted)">原形：<b>' + esc(x.lemma || x.word) + '</b> · ' +
      esc(x.pos || '') + ' · 點擊 ' + (x.clicks || 0) + ' 次 · 亮度 ' + (x.strength || 0) + '/10</div>' +
      '<div style="color:var(--muted)">型態：' + esc(x.lastForm || 'base form') + '</div>' +
      '<div class="meaning">' + esc(x.tw || '') + '</div>' +
      '<div style="color:var(--muted)">' + esc(x.tip || '') + '</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:6px">變形：' + (variants || '—') + '</div>' +
      '<button class="btn" onclick="known(\'' + esc(x.lemma || x.word) + '\')">已熟，歸零</button>' +
      '<button class="btn" onclick="hard(\'' + esc(x.lemma || x.word) + '\')">還不熟</button>' +
      '<button class="btn" onclick="document.getElementById(\'dock\').classList.remove(\'show\')">關閉</button>';

    dock.classList.add('show');
    dock.style.display = '';

    log('updated dockBody for', lemma);
  }

  // 覆蓋 window.showWord
  window.showWord = forceShowWord;

  // Hook clickWord 之後自動呼叫 showWord
  var origClick = window.clickWord;

  if (typeof origClick === 'function') {
    window.clickWord = function (surface) {
      var result = origClick.call(this, surface);
      var info = window.lemmatizeWord ? window.lemmatizeWord(surface) : { lemma: surface };
      setTimeout(function () {
        forceShowWord(info.lemma || surface);
      }, 50);
      return result;
    };
  }

  log('ready v20260711-2');

})();
