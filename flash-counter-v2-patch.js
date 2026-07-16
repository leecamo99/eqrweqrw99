/*!
 * flash-counter-v2-patch.js
 * 目的：修正閃卡「本輪 33 字」誤導問題
 * 原 patch bug：
 *   1. countDueWords 用 due 欄位，但主程式用 clicks 判定已熟 → 對不上
 *   2. 分母是開啟時快照，中途按已熟不會減
 *   3. 沒有「當前池中剩幾字」的即時值
 *
 * 本 patch 做法：
 *   - 掛在原 patch 之後（版本號 v20260716-1）
 *   - 每 500ms 重算兩個真實值：
 *       A) 池中剩餘：clicks 低於熟練門檻的字
 *       B) 本篇捕獲：從左側單字表抓
 *   - 顯示：📊 本輪 X 已看 · 池中剩 Y · 本篇 Z 字
 *   - 提供 window.__setMasterThreshold(n) 讓你自己調門檻
 */
(function () {
  'use strict';
  var TAG = '[FlashCounterV2]';
  var VER = 'v20260716-1';

  // ==== 可調門檻 ====
  // clicks >= MASTER_THRESHOLD 視為已熟，不列入「池中剩餘」
  var MASTER_THRESHOLD = parseInt(
    localStorage.getItem('__flashMasterThreshold') || '5',
    10
  );

  // 提供全域函式讓你 Console 調整
  window.__setMasterThreshold = function (n) {
    MASTER_THRESHOLD = parseInt(n, 10) || 5;
    localStorage.setItem('__flashMasterThreshold', String(MASTER_THRESHOLD));
    console.log(TAG, '熟練門檻已改為 clicks >=', MASTER_THRESHOLD);
    updateCounter(true);
  };

  window.__showFlashDebug = function () {
    try {
      var db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
      var learn = db.learn || {};
      var all = Object.values(learn);
      var pool = all.filter(function (e) {
        return (e.clicks || 0) < MASTER_THRESHOLD;
      });
      var mastered = all.filter(function (e) {
        return (e.clicks || 0) >= MASTER_THRESHOLD;
      });
      console.log(TAG, '=== DEBUG ===');
      console.log('總字數:', all.length);
      console.log('已熟(clicks>=' + MASTER_THRESHOLD + '):', mastered.length);
      console.log('池中剩餘:', pool.length);
      console.log(
        '池中字:',
        pool.map(function (e) {
          return (e.word || e.lemma) + '(' + (e.clicks || 0) + ')';
        })
      );
    } catch (e) {
      console.error(TAG, e);
    }
  };

  function countPool() {
    try {
      var db = JSON.parse(
        localStorage.getItem('notebook_platform_v3') || '{}'
      );
      var learn = db.learn || {};
      var n = 0;
      Object.keys(learn).forEach(function (k) {
        var e = learn[k];
        if (!e) return;
        if ((e.clicks || 0) < MASTER_THRESHOLD) n++;
      });
      return n;
    } catch (e) {
      return -1;
    }
  }

  function countCaptured() {
    // 抓左側單字表（本篇捕獲）
    var selectors = [
      '#capturedWordList li',
      '.captured-word',
      '[data-lemma]',
      '#wordList li',
      '.word-item'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      if (els.length > 0) return els.length;
    }
    return -1;
  }

  var lastRender = 0;
  var lastText = '';

  function updateCounter(force) {
    var flash = document.getElementById('flash');
    if (!flash || !flash.classList.contains('show')) return;
    var flashMeta = document.getElementById('flashMeta');
    if (!flashMeta) return;

    var now = Date.now();
    if (!force && now - lastRender < 400) return;
    lastRender = now;

    var pool = countPool();
    var captured = countCaptured();

    // 移除原 patch 的舊 tag（避免雙顯示）
    var oldTags = flashMeta.querySelectorAll('.flash-progress, .flash-counter-v2');
    oldTags.forEach(function (t) {
      t.remove();
    });

    // 從舊 patch 的 seenWords 抓「本輪已看」（若能取得）
    var seenCount = 0;
    if (window.__flashSeenWords && Array.isArray(window.__flashSeenWords)) {
      seenCount = window.__flashSeenWords.length;
    }

    var parts = [];
    if (seenCount > 0) parts.push('本輪 ' + seenCount);
    parts.push('池中剩 ' + pool);
    if (captured > 0) parts.push('本篇 ' + captured);

    var text = '· 📊 ' + parts.join(' · ');
    if (text === lastText && !force) return;
    lastText = text;

    var tag = document.createElement('span');
    tag.className = 'flash-counter-v2';
    tag.style.cssText =
      'color:#4dc9e6;margin-left:10px;font-weight:bold;' +
      'font-size:13px;cursor:pointer;user-select:none';
    tag.textContent = text;
    tag.title =
      '點擊查看詳細（Console）\n' +
      '調整門檻：__setMasterThreshold(數字)\n' +
      '目前熟練門檻：clicks >= ' +
      MASTER_THRESHOLD;
    tag.onclick = function (e) {
      e.stopPropagation();
      window.__showFlashDebug();
    };
    flashMeta.appendChild(tag);
  }

  function boot() {
    setTimeout(function () {
      setInterval(updateCounter, 500);
      console.log(TAG, 'ready', VER, '| 熟練門檻 clicks >=', MASTER_THRESHOLD);
      console.log(
        TAG,
        '💡 調整門檻：__setMasterThreshold(3) | 查看詳細：__showFlashDebug()'
      );
    }, 2500); // 比原 patch 晚一點啟動，確保原 tag 已產生
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
