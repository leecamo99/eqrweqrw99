/* flash-later-fix-patch.js  v20260713-1
   閃卡增強 patch
   功能：
   1) ⭐ 修正「稍後」按鈕（原本只關視窗）→ 改成模擬點「還不熟」但不改 SRS
   2) ⭐ 加「×」關閉按鈕（右上角）
   3) ⭐ 進度顯示（flashMeta 加「📊 3/40」）
*/
(function () {
  'use strict';
  var TAG = '[FlashEnhance]';
  var VER = 'v20260713-1';

  // ---- 進度追蹤 ----
  var seenWords = [];   // 這輪已看過的字（用來算進度）
  var totalGuess = 0;   // 猜測的總數
  var lastWord = '';

  function resetProgress() {
    seenWords = [];
    totalGuess = 0;
    lastWord = '';
  }

  // 從 SRS 資料估算「本輪要複習的字數」
  function guessTotal() {
    try {
      var db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
      var learn = db.learn || {};
      var now = Date.now();
      var due = 0;
      // 通用邏輯：due < 現在 或無 due 資料 = 需要複習
      Object.keys(learn).forEach(function (w) {
        var e = learn[w];
        if (!e) return;
        // 猜多種 SRS 欄位名稱
        var d = e.due || e.dueAt || (e.srs && e.srs.due) || 0;
        if (!d || d <= now) due++;
      });
      return due;
    } catch (e) { return 0; }
  }

  function updateProgress() {
    var flashQ = document.getElementById('flashQ');
    var flashMeta = document.getElementById('flashMeta');
    if (!flashQ || !flashMeta) return;

    var word = flashQ.textContent.trim().toLowerCase();
    if (!word || !/^[a-z][a-z\-']*$/i.test(word)) return;

    // 新字才加進計數
    if (word !== lastWord) {
      lastWord = word;
      if (seenWords.indexOf(word) === -1) {
        seenWords.push(word);
      }
      if (totalGuess === 0) totalGuess = guessTotal() + seenWords.length;
    }

    // 移除舊進度標記
    var oldTag = flashMeta.querySelector('.flash-progress');
    if (oldTag) oldTag.remove();

    // 加新進度
    var tag = document.createElement('span');
    tag.className = 'flash-progress';
    tag.style.cssText = 'color:#a68a56;margin-left:10px;font-weight:bold';
    tag.textContent = '· 📊 ' + seenWords.length + ' / ' + Math.max(totalGuess, seenWords.length);
    flashMeta.appendChild(tag);
  }

  // ---- 稍後按鈕：攔截 hard 讓它不改 SRS ----
  function flashLater() {
    var flashQ = document.getElementById('flashQ');
    var word = flashQ && flashQ.textContent.trim();
    if (!word) { console.warn(TAG, '沒有當前字'); return; }

    console.log(TAG, '跳過:', word);

    // 攔截 hard() 讓它變成無效
    var origHard = window.hard;
    if (typeof origHard === 'function') {
      window.hard = function () {
        console.log(TAG, '(攔截 hard，不改 SRS)');
      };
      // 模擬按「還不熟」
      var found = false;
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === '還不熟') {
          btns[i].click();
          found = true;
          break;
        }
      }
      // 100ms 後還原 hard
      setTimeout(function () { window.hard = origHard; }, 100);
      if (!found) console.warn(TAG, '找不到還不熟按鈕');
    } else {
      console.warn(TAG, 'window.hard 不存在，無法攔截');
    }
  }

  // ---- 關閉按鈕 ----
  function closeFlash() {
    var flash = document.getElementById('flash');
    if (flash) {
      flash.classList.remove('show');
      console.log(TAG, '關閉閃卡');
      resetProgress();
    }
  }

  function injectCloseBtn() {
    var flash = document.getElementById('flash');
    if (!flash || flash.querySelector('.flash-close-btn')) return;

    var box = flash.querySelector('.box') || flash.firstElementChild;
    if (!box) return;

    // 確保 box 有 position:relative
    var boxStyle = window.getComputedStyle(box);
    if (boxStyle.position === 'static') {
      box.style.position = 'relative';
    }

    var btn = document.createElement('button');
    btn.className = 'flash-close-btn';
    btn.textContent = '✕';
    btn.title = '關閉閃卡練習';
    btn.style.cssText = 
      'position:absolute;top:8px;right:8px;' +
      'width:28px;height:28px;padding:0;' +
      'background:transparent;color:#a68a56;' +
      'border:1px solid rgba(166,138,86,0.3);' +
      'border-radius:50%;cursor:pointer;font-size:14px;' +
      'line-height:1;z-index:10;' +
      'display:flex;align-items:center;justify-content:center;' +
      'transition:all 0.15s';
    btn.onmouseover = function () {
      btn.style.background = 'rgba(166,138,86,0.15)';
      btn.style.borderColor = '#a68a56';
    };
    btn.onmouseout = function () {
      btn.style.background = 'transparent';
      btn.style.borderColor = 'rgba(166,138,86,0.3)';
    };
    btn.onclick = function (e) {
      e.stopPropagation();
      closeFlash();
    };
    box.appendChild(btn);
    console.log(TAG, '關閉按鈕已注入');
  }

  // ---- 稍後按鈕綁定 ----
  function bindLaterBtn() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.textContent.trim() === '稍後' && !b.__laterBound) {
        b.onclick = flashLater;
        b.__laterBound = true;
        console.log(TAG, '「稍後」按鈕已重綁');
      }
    }
  }

  // ---- ESC 快捷鍵關閉 ----
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var flash = document.getElementById('flash');
      if (flash && flash.classList.contains('show')) {
        closeFlash();
      }
    }
  });

  // ---- 主循環 ----
  var flashWasShown = false;
  function scan() {
    var flash = document.getElementById('flash');
    if (!flash) return;

    var isShown = flash.classList.contains('show');

    // 開啟時初始化
    if (isShown && !flashWasShown) {
      console.log(TAG, '閃卡開啟，初始化');
      resetProgress();
    }
    // 關閉時重置
    if (!isShown && flashWasShown) {
      resetProgress();
    }
    flashWasShown = isShown;

    if (!isShown) return;

    injectCloseBtn();
    bindLaterBtn();
    updateProgress();
  }

  function boot() {
    scan();
    setInterval(scan, 500);

    var obs = new MutationObserver(function () { scan(); });
    obs.observe(document.body, { 
      childList: true, subtree: true, characterData: true 
    });

    console.log(TAG, 'ready', VER);
    console.log(TAG, '功能：');
    console.log(TAG, '  ✕ 關閉按鈕（右上角 / ESC）');
    console.log(TAG, '  📊 進度顯示（flashMeta）');
    console.log(TAG, '  ⏭ 稍後修正（不改 SRS）');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
