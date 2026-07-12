/* ocr-panel-to-settings-patch.js  v20260713-1
   把中間 OCR 上傳面板（Upload/Capture/Learn）搬到「⚙ 設定與管理」Modal 內

   邏輯：
   1) 開機時找到 OCR 面板 → 隱藏
   2) 攔截 window.openSettingsHub()
   3) 開設定 Modal 後，把 OCR 面板「借」進 Modal 顯示
   4) Modal 關閉時把面板「還」回原位置並再次隱藏
*/
(function () {
  'use strict';
  var TAG = '[OcrToSettings]';
  var VER = 'v20260713-1';

  var panelEl = null;
  var origParent = null;
  var origNext = null;
  var headingEl = null;  // "Upload · Capture · Learn" 標題
  var origHeadingDisplay = '';
  var origPanelDisplay = '';
  var modalWatchInterval = null;
  var wasModalOpen = false;

  // 找 OCR 上傳面板
  function findOcrPanel() {
    if (panelEl && document.body.contains(panelEl)) return panelEl;

    // 找含 "OCR 語言" 的最小元素
    var candidate = null;
    var all = document.querySelectorAll('label, span, div, p');
    for (var i = 0; i < all.length; i++) {
      var t = all[i].textContent || '';
      if (/OCR 語言/.test(t) && all[i].children.length < 3) {
        candidate = all[i];
        break;
      }
    }
    if (!candidate) return null;

    // 往上找，直到找到同時包含「選檔 OCR」和「貼上文字」的容器
    var el = candidate;
    for (var depth = 0; depth < 10; depth++) {
      if (!el || !el.parentElement) break;
      var parentText = el.parentElement.textContent || '';
      if (/選檔.*OCR|OCR.*貼上文字|貼上文字.*OCR/.test(parentText)) {
        el = el.parentElement;
      } else {
        break;
      }
    }

    // 再往上一層，看有沒有包含 "Upload · Capture · Learn" 的容器
    if (el && el.parentElement) {
      var pt = el.parentElement.textContent || '';
      if (/Upload.*Capture.*Learn/.test(pt) && (el.parentElement.textContent || '').length < 500) {
        el = el.parentElement;
      }
    }

    return el;
  }

  // 找頁面上 "Upload · Capture · Learn" 標題（可能是分離的）
  function findUploadHeading() {
    if (headingEl && document.body.contains(headingEl)) return headingEl;
    var all = document.querySelectorAll('h1, h2, h3, h4, p, div');
    for (var i = 0; i < all.length; i++) {
      var t = (all[i].textContent || '').trim();
      // 「Upload · Capture · Learn」 是短短一行
      if (t === 'Upload · Capture · Learn' || 
          (/Upload.*Capture.*Learn/.test(t) && t.length < 40 && all[i].children.length <= 1)) {
        return all[i];
      }
    }
    return null;
  }

  function hidePanel() {
    panelEl = findOcrPanel();
    if (!panelEl) {
      console.warn(TAG, '找不到 OCR 面板');
      return false;
    }
    origParent = panelEl.parentElement;
    origNext = panelEl.nextSibling;
    origPanelDisplay = panelEl.style.display || '';
    panelEl.style.display = 'none';
    panelEl.dataset.ocrHidden = '1';
    console.log(TAG, '已隱藏 OCR 面板');

    // 順便處理標題
    headingEl = findUploadHeading();
    if (headingEl && !headingEl.contains(panelEl) && !panelEl.contains(headingEl)) {
      origHeadingDisplay = headingEl.style.display || '';
      headingEl.style.display = 'none';
      headingEl.dataset.ocrHidden = '1';
      console.log(TAG, '已隱藏標題');
    }
    return true;
  }

  function restorePanel() {
    if (panelEl) {
      // 還回原位置
      if (origParent && document.body.contains(origParent)) {
        if (origNext && origParent.contains(origNext)) {
          origParent.insertBefore(panelEl, origNext);
        } else {
          origParent.appendChild(panelEl);
        }
      }
      panelEl.style.display = 'none';  // 還原後仍保持隱藏
    }
  }

  // 把面板放進 Modal 內
  function injectIntoModal() {
    var modal = document.getElementById('settingsHubModal');
    if (!modal) return;

    if (!panelEl) panelEl = findOcrPanel();
    if (!panelEl) {
      console.warn(TAG, '注入時找不到面板');
      return;
    }

    // 找 Modal 內的內容區（第一個大 scroll 容器，或 modal 本身）
    var body = modal.querySelector('[class*="body"], [class*="content"], [class*="scroll"]');
    if (!body) {
      // 找 Modal 內第一個大 div
      var divs = modal.querySelectorAll('div');
      for (var i = 0; i < divs.length; i++) {
        var d = divs[i];
        if (d.children.length > 2 && d.getBoundingClientRect().height > 100) {
          body = d;
          break;
        }
      }
    }
    if (!body) body = modal;

    // 建個 wrap 塞面板
    if (modal.querySelector('.ocrPanelWrap')) return;  // 已注入

    var wrap = document.createElement('div');
    wrap.className = 'ocrPanelWrap';
    wrap.style.cssText = 'margin:14px 0;padding:14px;border:1px solid #d5c9a8;' +
                        'border-radius:8px;background:#faf7ee';

    var title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;color:#a68a56;font-size:14px;' +
                         'margin-bottom:10px;border-bottom:1px solid #d5c9a8;padding-bottom:6px';
    title.textContent = '📤 上傳新文件 (OCR)';
    wrap.appendChild(title);

    // 面板本體
    panelEl.style.display = origPanelDisplay || '';
    wrap.appendChild(panelEl);

    body.appendChild(wrap);
    console.log(TAG, '已注入到設定 Modal');
  }

  // 面板從 Modal 收回原處
  function retractFromModal() {
    if (!panelEl) return;
    panelEl.style.display = 'none';
    if (origParent && document.body.contains(origParent)) {
      if (origNext && origParent.contains(origNext)) {
        origParent.insertBefore(panelEl, origNext);
      } else {
        origParent.appendChild(panelEl);
      }
    }
    console.log(TAG, '面板已收回原位置');
  }

  // 攔截 openSettingsHub
  function hijack() {
    if (typeof window.openSettingsHub !== 'function') {
      console.warn(TAG, 'openSettingsHub 尚未定義');
      return false;
    }
    if (window.openSettingsHub.__hijacked) return true;

    var orig = window.openSettingsHub;
    window.openSettingsHub = function () {
      var r = orig.apply(this, arguments);
      // 開 Modal 後 200ms 注入
      setTimeout(function () {
        injectIntoModal();
      }, 200);
      return r;
    };
    window.openSettingsHub.__hijacked = true;
    console.log(TAG, '已攔截 openSettingsHub');
    return true;
  }

  // 監聽 Modal 開/關狀態
  function watchModal() {
    var modal = document.getElementById('settingsHubModal');
    var isOpen = !!modal;

    if (isOpen && !wasModalOpen) {
      // Modal 剛開 → 注入
      setTimeout(injectIntoModal, 200);
    }
    if (!isOpen && wasModalOpen) {
      // Modal 剛關 → 收回
      retractFromModal();
    }
    wasModalOpen = isOpen;
  }

  // 對外 API
  window.__ocrToSettings = {
    hide: hidePanel,
    restore: function () {
      if (panelEl) {
        panelEl.style.display = '';
        delete panelEl.dataset.ocrHidden;
      }
      if (headingEl) {
        headingEl.style.display = '';
        delete headingEl.dataset.ocrHidden;
      }
      console.log(TAG, '已還原顯示');
    },
    findPanel: findOcrPanel,
    inject: injectIntoModal,
    version: VER
  };

  function boot() {
    setTimeout(function () {
      var ok = hidePanel();
      if (!ok) {
        // 首次找不到，稍後再試
        setTimeout(hidePanel, 2000);
      }

      // 攔截設定按鈕
      if (!hijack()) {
        setTimeout(hijack, 2000);
      }

      // 監聽 Modal
      modalWatchInterval = setInterval(watchModal, 500);

      console.log(TAG, 'ready', VER);
      console.log(TAG, '點 ⚙ 設定與管理 開啟後會看到「📤 上傳新文件 (OCR)」');
      console.log(TAG, '手動 API:');
      console.log(TAG, '  __ocrToSettings.restore()  還原顯示到主畫面');
      console.log(TAG, '  __ocrToSettings.hide()     再次隱藏');
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
