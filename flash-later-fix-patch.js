/* flash-later-fix-patch.js  v20260713-3
   🚨 關鍵修正：移除 MutationObserver（避免無限迴圈）
   - 改用 setInterval 800ms 輪詢
   - 加入節流：最多每 500ms 掃一次
   - 只在狀態真的改變時才做事（避免重複注入）
*/
(function () {
  'use strict';
  var TAG = '[FlashEnhance]';
  var VER = 'v20260713-3';

  var seenWords = [];
  var totalGuess = 0;
  var lastWord = '';
  var wasShown = false;
  var lastScanTime = 0;
  var closeBtnInjected = false;
  var laterBtnBound = false;

  function resetProgress() {
    seenWords = [];
    totalGuess = 0;
    lastWord = '';
    closeBtnInjected = false;
    laterBtnBound = false;
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

    // 只在字換了才更新
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

    console.log(TAG, '\u23ed\ufe0f 跳過:', word);

    var origHard = window.hard;
    if (typeof origHard === 'function') {
      window.hard = function () {};  // 靜默攔截
      var found = false;
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === '\u9084\u4e0d\u719f') {
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
      console.log(TAG, '\ud83d\udd1a 關閉閃卡');
      cleanupUI();
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
    btn.title = '\u95dc\u9589 (ESC)';
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
      if (b.textContent.trim() === '\u7a0d\u5f8c' && !b.__laterBound) {
        b.onclick = flashLater;
        b.__laterBound = true;
        laterBtnBound = true;
        console.log(TAG, '\u23ed\ufe0f 稍後按鈕已重綁');
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
    // ⭐ 節流：最多每 500ms 掃一次
    var now = Date.now();
    if (now - lastScanTime < 500) return;
    lastScanTime = now;

    var flash = document.getElementById('flash');
    if (!flash) return;

    var isShown = flash.classList.contains('show');

    // 狀態改變才做事
    if (isShown && !wasShown) {
      console.log(TAG, '\ud83c\udfaf 閃卡開啟');
      resetProgress();
    }
    if (!isShown && wasShown) {
      console.log(TAG, '\ud83d\udd1a 閃卡關閉，清理');
      cleanupUI();
      resetProgress();
    }
    wasShown = isShown;

    if (!isShown) return;

    // 只在需要時才注入
    if (!closeBtnInjected) injectCloseBtn();
    if (!laterBtnBound) bindLaterBtn();
    updateProgress();
  }

  function boot() {
    setTimeout(function () {
      // ⭐ 只用 setInterval，不用 MutationObserver（避免無限迴圈）
      setInterval(scan, 800);

      console.log(TAG, 'ready', VER);
      console.log(TAG, '\u26a0\ufe0f 使用 800ms polling（無 MutationObserver）');
    }, 2000);  // 延遲 2 秒避免與其他 patch 衝突
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
