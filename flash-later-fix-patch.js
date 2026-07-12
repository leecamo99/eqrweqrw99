/* flash-later-fix-patch.js  v20260713-4
   關鍵修正：解決 fullTranslateBox 遮罩問題（z-index 2147483000）
   功能：
   1) ⭐ 閃卡開啟時：隱藏會蓋住的元素（fullTranslateBox 等）
   2) ⭐ 閃卡關閉時：還原它們
   3) ⭐ 強制閃卡 z-index 到最上層
   4) 關閉按鈕 + ESC
   5) 稍後修正（不改 SRS）
   6) 進度顯示
   7) 無 MutationObserver（避免無限迴圈）
*/
(function () {
  'use strict';
  var TAG = '[FlashEnhance]';
  var VER = 'v20260713-4';

  // 會蓋住閃卡的元素 ID 清單
  var BLOCKERS = ['fullTranslateBox'];

  var seenWords = [];
  var totalGuess = 0;
  var lastWord = '';
  var wasShown = false;
  var lastScanTime = 0;
  var closeBtnInjected = false;
  var laterBtnBound = false;
  var savedBlockerStyles = {};

  function resetProgress() {
    seenWords = [];
    totalGuess = 0;
    lastWord = '';
    closeBtnInjected = false;
    laterBtnBound = false;
  }

  function hideBlockers() {
    BLOCKERS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !savedBlockerStyles[id]) {
        savedBlockerStyles[id] = el.style.display || '';
        el.style.display = 'none';
        console.log(TAG, 'hide blocker:', id);
      }
    });
  }

  function restoreBlockers() {
    Object.keys(savedBlockerStyles).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.style.display = savedBlockerStyles[id];
        console.log(TAG, 'restore blocker:', id);
      }
    });
    savedBlockerStyles = {};
  }

  function boostFlashZIndex() {
    var flash = document.getElementById('flash');
    if (!flash) return;
    if (flash.style.zIndex !== '999999') {
      flash.style.zIndex = '999999';
    }
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

    if (word === lastWord) return;
    lastWord = word;

    if (seenWords.indexOf(word) === -1) {
      seenWords.push(word);
    }
    if (totalGuess === 0) totalGuess = guessTotal() + seenWords.length;

    var oldTag = flashMeta.querySelector('.flash-progress');
    if (oldTag) oldTag.remove();

    var tag = document.createElement('span');
    tag.className = 'flash-progress';
    tag.style.cssText = 'color:#a68a56;margin-left:10px;font-weight:bold';
    tag.textContent = '\u00b7 \uD83D\uDCCA ' + seenWords.length + ' / ' + Math.max(totalGuess, seenWords.length);
    flashMeta.appendChild(tag);
  }

  function flashLater() {
    var flashQ = document.getElementById('flashQ');
    var word = flashQ && flashQ.textContent.trim();
    if (!word) { console.warn(TAG, '沒有當前字'); return; }

    console.log(TAG, '\u23ED\uFE0F 跳過:', word);

    var origHard = window.hard;
    if (typeof origHard === 'function') {
      window.hard = function () {};
      var found = false;
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === '\u9084\u4E0D\u719F') {
          btns[i].click();
          found = true;
          break;
        }
      }
      setTimeout(function () { window.hard = origHard; }, 100);
      if (!found) console.warn(TAG, '找不到還不熟按鈕');
    } else {
      console.warn(TAG, 'window.hard 不存在');
    }
  }

  function closeFlash() {
    var flash = document.getElementById('flash');
    if (flash) {
      flash.classList.remove('show');
      flash.style.zIndex = '';
      console.log(TAG, '\uD83D\uDD1A 關閉閃卡');
      cleanupUI();
      restoreBlockers();
      resetProgress();
    }
  }

  function cleanupUI() {
    var closeBtn = document.querySelector('.flash-close-btn');
    if (closeBtn) closeBtn.remove();
    var progress = document.querySelector('.flash-progress');
    if (progress) progress.remove();
  }

  function injectCloseBtn() {
    if (closeBtnInjected) return;
    var flash = document.getElementById('flash');
    if (!flash || !flash.classList.contains('show')) return;
    if (flash.querySelector('.flash-close-btn')) { closeBtnInjected = true; return; }

    var box = null;
    for (var i = 0; i < flash.children.length; i++) {
      if (flash.children[i].classList && flash.children[i].classList.contains('box')) {
        box = flash.children[i];
        break;
      }
    }
    if (!box) return;

    var boxStyle = window.getComputedStyle(box);
    if (boxStyle.position === 'static') {
      box.style.position = 'relative';
    }

    var btn = document.createElement('button');
    btn.className = 'flash-close-btn';
    btn.textContent = '\u2715';
    btn.title = '\u95DC\u9589 (ESC)';
    btn.style.cssText = 
      'position:absolute;top:8px;right:8px;' +
      'width:28px;height:28px;padding:0;' +
      'background:transparent;color:#a68a56;' +
      'border:1px solid rgba(166,138,86,0.3);' +
      'border-radius:50%;cursor:pointer;font-size:14px;' +
      'line-height:1;z-index:10;' +
      'display:flex;align-items:center;justify-content:center';
    btn.onclick = function (e) {
      e.stopPropagation();
      closeFlash();
    };
    box.appendChild(btn);
    closeBtnInjected = true;
    console.log(TAG, '\u2715 關閉按鈕已注入');
  }

  function bindLaterBtn() {
    if (laterBtnBound) return;
    var flash = document.getElementById('flash');
    if (!flash || !flash.classList.contains('show')) return;

    var btns = flash.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.textContent.trim() === '\u7A0D\u5F8C' && !b.__laterBound) {
        b.onclick = flashLater;
        b.__laterBound = true;
        laterBtnBound = true;
        console.log(TAG, '\u23ED\uFE0F 稍後按鈕已重綁');
        return;
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
    var now = Date.now();
    if (now - lastScanTime < 500) return;
    lastScanTime = now;

    var flash = document.getElementById('flash');
    if (!flash) return;

    var isShown = flash.classList.contains('show');

    if (isShown && !wasShown) {
      console.log(TAG, '\uD83C\uDFAF 閃卡開啟');
      resetProgress();
      hideBlockers();        // ⭐ 隱藏遮罩物
      boostFlashZIndex();    // ⭐ 提高 z-index
    }
    if (!isShown && wasShown) {
      console.log(TAG, '\uD83D\uDD1A 閃卡關閉');
      cleanupUI();
      restoreBlockers();     // ⭐ 還原遮罩物
      flash.style.zIndex = '';
      resetProgress();
    }
    wasShown = isShown;

    if (!isShown) return;

    if (!closeBtnInjected) injectCloseBtn();
    if (!laterBtnBound) bindLaterBtn();
    updateProgress();
  }

  function boot() {
    setTimeout(function () {
      setInterval(scan, 800);
      console.log(TAG, 'ready', VER);
      console.log(TAG, '功能：');
      console.log(TAG, '  \u2715 關閉按鈕（ESC）');
      console.log(TAG, '  \uD83D\uDCCA 進度顯示');
      console.log(TAG, '  \u23ED\uFE0F 稍後修正');
      console.log(TAG, '  \uD83D\uDEE1\uFE0F 遮罩物隔離 (fullTranslateBox)');
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
