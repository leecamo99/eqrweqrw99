/* flash-later-fix-patch.js  v20260713-2
   關鍵修正：
   1) 只在閃卡「真的顯示」時才注入關閉按鈕
   2) 閃卡關閉時自動移除關閉按鈕（不殘留）
   3) 嚴格 selector：只找 #flash > .box（避免污染其他 UI）
   4) 延遲 1 秒才啟動掃描（避免頁面初始化衝突）
   5) 進度顯示更精準
*/
(function () {
  'use strict';
  var TAG = '[FlashEnhance]';
  var VER = 'v20260713-2';

  var seenWords = [];
  var totalGuess = 0;
  var lastWord = '';
  var wasShown = false;
  var origLaterHandler = null;

  function resetProgress() {
    seenWords = [];
    totalGuess = 0;
    lastWord = '';
  }

  function guessTotal() {
    try {
      var db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
      var learn = db.learn || {};
      var now = Date.now();
      var due = 0;
      Object.keys(learn).forEach(function (w) {
        var e = learn[w];
        if (!e) return;
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

    var word = (flashQ.textContent || '').trim().toLowerCase();
    if (!word || !/^[a-z][a-z\-']*$/i.test(word)) return;

    if (word !== lastWord) {
      lastWord = word;
      if (seenWords.indexOf(word) === -1) {
        seenWords.push(word);
      }
      if (totalGuess === 0) totalGuess = guessTotal() + seenWords.length;
    }

    var oldTag = flashMeta.querySelector('.flash-progress');
    if (oldTag) oldTag.remove();

    var tag = document.createElement('span');
    tag.className = 'flash-progress';
    tag.style.cssText = 'color:#a68a56;margin-left:10px;font-weight:bold';
    tag.textContent = '· \uD83D\uDCCA ' + seenWords.length + ' / ' + Math.max(totalGuess, seenWords.length);
    flashMeta.appendChild(tag);
  }

  function flashLater() {
    var flashQ = document.getElementById('flashQ');
    var word = flashQ && flashQ.textContent.trim();
    if (!word) { console.warn(TAG, '沒有當前字'); return; }

    console.log(TAG, '\u23ED\uFE0F 跳過:', word);

    var origHard = window.hard;
    if (typeof origHard === 'function') {
      window.hard = function () {
        console.log(TAG, '(攔截 hard，不改 SRS)');
      };
      var found = false;
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === '還不熟') {
          btns[i].click();
          found = true;
          break;
        }
      }
      setTimeout(function () { window.hard = origHard; }, 100);
      if (!found) console.warn(TAG, '找不到還不熟按鈕');
    } else {
      console.warn(TAG, 'window.hard 不存在，無法攔截');
    }
  }

  function closeFlash() {
    var flash = document.getElementById('flash');
    if (flash) {
      flash.classList.remove('show');
      console.log(TAG, '關閉閃卡');
      cleanupUI();
      resetProgress();
    }
  }

  // 移除注入的 UI（關閉按鈕、進度）
  function cleanupUI() {
    var closeBtn = document.querySelector('.flash-close-btn');
    if (closeBtn) closeBtn.remove();
    var progress = document.querySelector('.flash-progress');
    if (progress) progress.remove();
  }

  function injectCloseBtn() {
    var flash = document.getElementById('flash');
    if (!flash) return;
    // ⭐ 嚴格檢查：必須是 #flash 且 shown
    if (!flash.classList.contains('show')) return;
    // 已注入就不重複
    if (flash.querySelector('.flash-close-btn')) return;

    // ⭐ 只找 #flash 直接子層的 .box
    var box = null;
    for (var i = 0; i < flash.children.length; i++) {
      if (flash.children[i].classList && flash.children[i].classList.contains('box')) {
        box = flash.children[i];
        break;
      }
    }
    if (!box) box = flash.firstElementChild;
    if (!box) return;

    var boxStyle = window.getComputedStyle(box);
    if (boxStyle.position === 'static') {
      box.style.position = 'relative';
    }

    var btn = document.createElement('button');
    btn.className = 'flash-close-btn';
    btn.textContent = '\u2715';
    btn.title = '關閉閃卡練習 (ESC)';
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
    console.log(TAG, '\u2715 關閉按鈕已注入');
  }

  function bindLaterBtn() {
    var flash = document.getElementById('flash');
    if (!flash || !flash.classList.contains('show')) return;

    var btns = flash.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.textContent.trim() === '稍後' && !b.__laterBound) {
        origLaterHandler = b.onclick;  // 保存原本的
        b.onclick = flashLater;
        b.__laterBound = true;
        console.log(TAG, '\u23ED\uFE0F 稍後按鈕已重綁');
      }
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var flash = document.getElementById('flash');
      if (flash && flash.classList.contains('show')) {
        closeFlash();
      }
    }
  });

  function scan() {
    var flash = document.getElementById('flash');
    if (!flash) return;

    var isShown = flash.classList.contains('show');

    if (isShown && !wasShown) {
      console.log(TAG, '\uD83C\uDFAF 閃卡開啟，初始化');
      resetProgress();
    }
    if (!isShown && wasShown) {
      console.log(TAG, '\uD83D\uDD1A 閃卡關閉，清理 UI');
      cleanupUI();
      resetProgress();
    }
    wasShown = isShown;

    if (!isShown) return;

    injectCloseBtn();
    bindLaterBtn();
    updateProgress();
  }

  function boot() {
    // ⭐ 延遲 1 秒啟動，避免頁面初始化衝突
    setTimeout(function () {
      scan();
      setInterval(scan, 500);

      var obs = new MutationObserver(function () { scan(); });
      obs.observe(document.body, { 
        childList: true, subtree: true, characterData: true 
      });

      console.log(TAG, 'ready', VER);
      console.log(TAG, '功能：');
      console.log(TAG, '  \u2715 關閉按鈕（右上角 / ESC）');
      console.log(TAG, '  \uD83D\uDCCA 進度顯示');
      console.log(TAG, '  \u23ED\uFE0F 稍後修正（不改 SRS）');
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
