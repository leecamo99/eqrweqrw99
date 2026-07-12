/* wordnote-force-update-patch.js v20260712-3
   v3: New template with colored boxes (definition/synonyms/example)
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

    var html =
      '<div class="wordbig">' + esc(x.lastSurface || surfaceOrLemma) + '</div>' +
      '<div style="color:var(--muted)">原形：<b>' + esc(x.lemma || x.word) + '</b> · ' +
      esc(x.pos || '') + ' · 點擊 ' + (x.clicks || 0) + ' 次 · 亮度 ' + (x.strength || 0) + '/10</div>' +
      '<div style="color:var(--muted)">型態：' + esc(x.lastForm || 'base form') + '</div>' +
      '<div class="meaning">' + esc(x.tw || '') + '</div>';

    if (x.tip) {
      html += '<div style="margin-top:8px;padding:6px 10px;background:rgba(0,0,0,0.03);border-left:3px solid #a68a56;border-radius:3px;font-size:12px;color:#555">' +
              '<b style="color:#a68a56">定義</b> ' + esc(x.tip) + '</div>';
    }

    if (x.synonyms) {
      html += '<div style="margin-top:4px;padding:6px 10px;background:rgba(0,0,0,0.03);border-left:3px solid #7a9;border-radius:3px;font-size:12px;color:#555">' +
              '<b style="color:#7a9">同義</b> ' + esc(x.synonyms) + '</div>';
    }

    if (x.example) {
      html += '<div style="margin-top:4px;padding:6px 10px;background:rgba(0,0,0,0.03);border-left:3px solid #b57;border-radius:3px;font-size:12px;color:#555">' +
              '<b style="color:#b57">例句</b> ' + esc(x.example) + '</div>';
    }

    html += '<div style="font-size:12px;color:var(--muted);margin-top:6px">變形：' + (variants || '—') + '</div>' +
            '<button class="btn" onclick="known(\'' + esc(x.lemma || x.word) + '\')">已熟，歸零</button>' +
            '<button class="btn" onclick="hard(\'' + esc(x.lemma || x.word) + '\')">還不熟</button>' +
            '<button class="btn" onclick="document.getElementById(\'dock\').classList.remove(\'show\')">關閉</button>';

    dockBody.innerHTML = html;

    dock.classList.add('show');
    dock.style.display = '';

    log('updated dockBody for', lemma);
  }

  window.showWord = forceShowWord;

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

  log('ready v20260712-3 (colored boxes)');

})();
