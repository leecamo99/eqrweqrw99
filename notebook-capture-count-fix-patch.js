/* notebook-capture-count-fix-patch.js  v20260713-1
   修正 Notebook 列表「N 捕獲」全部一樣的 bug

   原因：原本邏輯用了全域 db.learn 的字數，所以三篇都顯示 36

   真實捕獲數：每個 notebook 的 cards[].text 裡 {{word}} 出現次數
   段數：cards.length
*/
(function () {
  'use strict';
  var TAG = '[CaptureCountFix]';
  var VER = 'v20260713-1';

  function getDB() {
    try { return JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}'); }
    catch (e) { return {}; }
  }

  // 計算單一 notebook 的捕獲數
  function countCaptures(nb) {
    if (!nb || !nb.cards) return 0;
    var total = 0;
    for (var i = 0; i < nb.cards.length; i++) {
      var t = nb.cards[i] && nb.cards[i].text;
      if (!t) continue;
      var m = t.match(/\{\{[^}]+\}\}/g);
      if (m) total += m.length;
    }
    return total;
  }

  // 計算段數
  function countSegments(nb) {
    return (nb && nb.cards && nb.cards.length) || 0;
  }

  var processedSignature = '';

  function fixAllItems() {
    var container = document.getElementById('nblist');
    if (!container) return;

    var items = container.querySelectorAll('.nb');
    if (!items.length) return;

    var db = getDB();
    var notebooks = db.notebooks || {};

    // 用簽名避免重複處理
    var sig = '';
    for (var i = 0; i < items.length; i++) {
      var small = items[i].querySelector('small');
      if (small) sig += small.textContent + '|';
    }
    if (sig === processedSignature) return;
    processedSignature = sig;

    // 匹配每個 .nb 項目 → 找對應 notebook → 更新數字
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var small = item.querySelector('small');
      if (!small) continue;

      // 找 notebook 名稱（<b> 或第一個文字節點）
      var titleEl = item.querySelector('b, strong, h3, h4') 
                 || item.querySelector('div:first-child');
      var name = titleEl && titleEl.textContent.trim();
      if (!name) continue;

      // 找對應 notebook（用 name 匹配）
      var nb = null;
      var ids = Object.keys(notebooks);
      for (var k = 0; k < ids.length; k++) {
        if (notebooks[ids[k]].name === name) {
          nb = notebooks[ids[k]];
          break;
        }
      }
      if (!nb) continue;

      var captures = countCaptures(nb);
      var segments = countSegments(nb);

      // 建構新文字：格式「日期 · N 段 · N 捕獲」
      var date = nb.date || '';
      var newText = date + ' · ' + segments + ' 段 · ' + captures + ' 捕獲';

      if (small.textContent.trim() !== newText) {
        small.textContent = newText;
        console.log(TAG, name + ': ' + captures + ' 捕獲');
      }
    }
  }

  function boot() {
    setTimeout(function () {
      fixAllItems();
      setInterval(fixAllItems, 1500);
      console.log(TAG, 'ready', VER);
      console.log(TAG, '手動: window.__captureCountFix.refresh()');
    }, 1500);
  }

  window.__captureCountFix = {
    refresh: function () { processedSignature = ''; fixAllItems(); },
    countCaptures: countCaptures,
    // Debug: 印出所有 notebook 的真實捕獲數
    debug: function () {
      var db = getDB();
      var notebooks = db.notebooks || {};
      console.log('=== 各 notebook 真實捕獲數 ===');
      Object.keys(notebooks).forEach(function (id) {
        var nb = notebooks[id];
        console.log('  ' + nb.name + ' (' + nb.date + '): ' + 
                    countSegments(nb) + ' 段, ' + 
                    countCaptures(nb) + ' 捕獲');
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
