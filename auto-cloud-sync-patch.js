/* auto-cloud-sync-patch.js v20260717-2
   1. Floating cloud button (bottom-right) for one-click upload.
   2. Auto-uploads after 5 minutes of user inactivity when data is dirty.
   3. Visual status indicator (synced / dirty / uploading / error).
*/

(function () {

  'use strict';

  var IDLE_TIME = 5 * 60 * 1000;        // 5 分鐘閒置後自動同步
  var CHECK_INTERVAL = 30 * 1000;       // 每 30 秒檢查一次

  function log() {
    try {
      console.log.apply(console, ['[AutoSync]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  var state = {
    lastActivity: Date.now(),
    lastDbHash: null,
    isDirty: false,
    isUploading: false,
    lastUploadOk: null,
    lastUploadTime: null,
    autoTimer: null
  };

  // ========================================
  // 監聽使用者活動
  // ========================================

  function markActivity() {
    state.lastActivity = Date.now();
  }

  // 各種事件都算「活動」
  ['click', 'touchstart', 'mousemove', 'keydown', 'scroll'].forEach(function (event) {
    document.addEventListener(event, markActivity, { passive: true, capture: true });
  });

  // ========================================
  // 監聽資料變更
  // ========================================

  function computeDbHash() {

    try {
      var raw = localStorage.getItem('notebook_platform_v3') || '';
      var hash = 0;
      for (var i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
      }
      return String(hash);
    } catch (e) {
      return '';
    }
  }

  function checkDirty() {

    var currentHash = computeDbHash();

    if (state.lastDbHash === null) {
      state.lastDbHash = currentHash;
      return false;
    }

    if (state.lastDbHash !== currentHash) {
      state.isDirty = true;
      updateButton();
      log('data changed, marked dirty');
      return true;
    }

    return false;
  }

  setInterval(checkDirty, 10 * 1000);   // 10 秒檢查資料變更

  // ========================================
  // 上傳邏輯
  // ========================================

  async function doUpload(isManual) {

    if (state.isUploading) {
      log('already uploading, skip');
      return;
    }

    state.isUploading = true;
    updateButton();

    log(isManual ? '手動上傳' : '自動上傳');

    try {

      // 用網站原本的雲端上傳函式
      if (typeof window.uploadToCloud === 'function') {
        await window.uploadToCloud();
      } else if (typeof window.uploadCloud === 'function') {
        await window.uploadCloud();
      } else if (typeof window.cloudUpload === 'function') {
        await window.cloudUpload();
      } else if (typeof window.syncToCloud === 'function') {
        await window.syncToCloud();
      } else if (typeof window.githubUpload === 'function') {
        await window.githubUpload();
      } else {
        throw new Error('找不到上傳函式');
      }

      state.lastUploadOk = true;
      state.lastUploadTime = Date.now();
      state.isDirty = false;
      state.lastDbHash = computeDbHash();

      log('上傳成功');

      if (isManual) {
        showToast('☁️ 已上傳', 'success');
      }

    } catch (e) {

      state.lastUploadOk = false;
      log('上傳失敗:', e.message);

      if (isManual) {
        showToast('❌ 上傳失敗: ' + e.message.slice(0, 50), 'error');
      }
    } finally {
      state.isUploading = false;
      updateButton();
    }
  }

  // ========================================
  // 自動同步偵測
  // ========================================

  function checkAutoUpload() {

    if (state.isUploading) return;
    if (!state.isDirty) return;

    var idleTime = Date.now() - state.lastActivity;

    if (idleTime >= IDLE_TIME) {
      log('已閒置', Math.floor(idleTime / 60000), '分鐘，自動同步');
      doUpload(false);
    }
  }

  setInterval(checkAutoUpload, CHECK_INTERVAL);

  // ========================================
  // 浮動按鈕
  // ========================================

  function createButton() {

    if (document.getElementById('autoSyncBtn')) return;

    var btn = document.createElement('bottom');
    btn.id = 'autoSyncBtn';

    btn.style.cssText = 
      'position: fixed;' +
      'bottom: 20px;' +
      'right: 20px;' +
      'width: 50px;' +
      'height: 50px;' +
      'border-radius: 50%;' +
      'border: none;' +
      'font-size: 24px;' +
      'cursor: pointer;' +
      'box-shadow: 0 4px 12px rgba(0,0,0,0.2);' +
      'transition: all 0.3s;' +
      'z-index: 999998;' +
      'user-select: none;' +
      'background: #4CAF50;' +
      'color: white;';

    btn.textContent = '☁️';

    // 點擊 = 手動上傳
    btn.onclick = function () {
      doUpload(true);
    };

    // Hover 顯示狀態
    btn.onmouseover = function () {
      showStatusTooltip(btn);
    };

    btn.onmouseout = function () {
      hideStatusTooltip();
    };

    document.body.appendChild(btn);

    log('button created');
  }

  function updateButton() {

    var btn = document.getElementById('autoSyncBtn');
    if (!btn) return;

    var color, text;

    if (state.isUploading) {
      color = '#2196F3';   // 藍色 = 上傳中
      text = '⏳';
    } else if (state.isDirty) {
      color = '#FF9800';   // 橙色 = 有變動
      text = '☁️';
    } else if (state.lastUploadOk === false) {
      color = '#f44336';   // 紅色 = 失敗
      text = '☁️';
    } else {
      color = '#4CAF50';   // 綠色 = 已同步
      text = '☁️';
    }

    btn.style.background = color;
    btn.textContent = text;
  }

  // ========================================
  // 狀態提示
  // ========================================

  function showStatusTooltip(btn) {

    hideStatusTooltip();

    var tip = document.createElement('div');
    tip.id = 'autoSyncTooltip';
    tip.style.cssText = 
      'position: fixed;' +
      'bottom: 80px;' +
      'right: 20px;' +
      'padding: 10px 14px;' +
      'background: rgba(0,0,0,0.85);' +
      'color: white;' +
      'border-radius: 6px;' +
      'font-size: 12px;' +
      'font-family: Segoe UI, Microsoft JhengHei, sans-serif;' +
      'z-index: 999999;' +
      'box-shadow: 0 4px 12px rgba(0,0,0,0.3);' +
      'max-width: 250px;';

    var status;
    if (state.isUploading) {
      status = '⏳ 正在上傳...';
    } else if (state.isDirty) {
      var idleMin = Math.floor((Date.now() - state.lastActivity) / 60000);
      status = '📤 有變動待同步<br>閒置 5 分鐘後自動同步<br>已閒置 ' + idleMin + ' 分鐘';
    } else if (state.lastUploadOk === false) {
      status = '❌ 上次上傳失敗<br>點擊重試';
    } else if (state.lastUploadTime) {
      var mins = Math.floor((Date.now() - state.lastUploadTime) / 60000);
      status = '✅ 已同步<br>' + (mins > 0 ? mins + ' 分鐘前' : '剛剛');
    } else {
      status = '☁️ 尚未同步<br>點擊立即上傳';
    }

    tip.innerHTML = status + '<br><br><span style="color:#aaa;font-size:11px">點擊按鈕立即上傳</span>';

    document.body.appendChild(tip);
  }

  function hideStatusTooltip() {
    var tip = document.getElementById('autoSyncTooltip');
    if (tip) tip.remove();
  }

  // ========================================
  // Toast 訊息
  // ========================================

  function showToast(msg, type) {

    var existing = document.getElementById('autoSyncToast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'autoSyncToast';

    var bg;
    if (type === 'success') bg = '#4CAF50';
    else if (type === 'error') bg = '#f44336';
    else bg = '#2196F3';

    toast.style.cssText = 
      'position: fixed;' +
      'bottom: 80px;' +
      'right: 20px;' +
      'padding: 12px 20px;' +
      'background: ' + bg + ';' +
      'color: white;' +
      'border-radius: 6px;' +
      'font-size: 13px;' +
      'font-family: Segoe UI, Microsoft JhengHei, sans-serif;' +
      'z-index: 999999;' +
      'box-shadow: 0 4px 12px rgba(0,0,0,0.3);' +
      'animation: slideIn 0.3s;';

    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, 3000);
  }

  // ========================================
  // 初始化
  // ========================================

  setTimeout(createButton, 1000);
  setInterval(createButton, 5000);   // 每 5 秒確保按鈕存在

  // 定期更新按鈕（顯示閒置時間等）
  setInterval(function () {
    var tip = document.getElementById('autoSyncTooltip');
    if (tip) {
      showStatusTooltip(document.getElementById('autoSyncBtn'));
    }
  }, 10 * 1000);

  log('ready v20260716-1');

})();
/* === v1.9.4 左上角快捷漢堡（放寬吸收條件 + 定期補抓） === */
(function shortcutHubV194(){
  document.getElementById('shortcutHub')?.remove();
  document.getElementById('shortcutHubStyle')?.remove();

  const IDS = ['autoSyncBtn', 'aiChatBtn', 'bcollapseBtn'];

  const hub = document.createElement('div');
  hub.id = 'shortcutHub';
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'shortcutHubToggle';
  toggleBtn.title = '快捷選單';
  toggleBtn.setAttribute('aria-label', '快捷選單');
  toggleBtn.textContent = '☰';
  hub.appendChild(toggleBtn);
  const list = document.createElement('div');
  list.id = 'shortcutHubList';
  hub.appendChild(list);
  document.body.appendChild(hub);

  const css = document.createElement('style');
  css.id = 'shortcutHubStyle';
  css.textContent = `
    #shortcutHub{
      position:fixed!important;
      top:60px!important; left:10px!important;
      z-index:9999!important;
      display:flex;flex-direction:column;gap:8px;
    }
    #shortcutHubToggle{
      width:36px!important;height:36px!important;
      border-radius:50%!important;border:none!important;
      background:#4a7c59!important;color:#fff!important;
      font-size:16px!important;cursor:pointer!important;
      box-shadow:0 2px 8px rgba(0,0,0,.25)!important;
      transition:transform .2s!important;
      display:flex!important;align-items:center!important;justify-content:center!important;
      padding:0!important;
    }
    #shortcutHub.open #shortcutHubToggle{ transform:rotate(90deg); }
    #shortcutHubList{ display:none;flex-direction:column;gap:8px; }
    #shortcutHub.open #shortcutHubList{ display:flex; }
    #shortcutHubList > *{
      position:static!important;
      top:auto!important;left:auto!important;
      right:auto!important;bottom:auto!important;
      transform:none!important;margin:0!important;
      width:36px!important;height:36px!important;
      min-width:36px!important;min-height:36px!important;
      padding:0!important;
      border-radius:50%!important;border:none!important;
      box-sizing:border-box!important;
      background:#4a7c59!important;color:#fff!important;
      display:flex!important;align-items:center!important;justify-content:center!important;
      font-size:16px!important;line-height:1!important;
      box-shadow:0 2px 6px rgba(0,0,0,.2)!important;
      cursor:pointer!important;
      transition:transform .15s, background .15s!important;
      opacity:1!important;
    }
    #shortcutHubList > *:hover{
      background:#5a8c69!important;
      transform:scale(1.08)!important;
    }
    #shortcutHubList > * > *{
      font-size:16px!important;
      width:auto!important;height:auto!important;
      max-width:24px!important;max-height:24px!important;
    }
    #shortcutHubList .a2c-label{
      font-size:12px!important;
      font-weight:700!important;
      letter-spacing:-1px!important;
      line-height:1!important;
    }
    #shortcutHub.hidden-by-menu{ display:none!important; }
  `;
  document.head.appendChild(css);

  toggleBtn.addEventListener('click', e => {
    e.stopPropagation();
    hub.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (hub.contains(e.target)) return;
    hub.classList.remove('open');
  }, true);

  let absorbBusy = false;
  function absorbButtons(){
    if (absorbBusy) return;
    absorbBusy = true;
    IDS.forEach(id => {
      const el = document.getElementById(id);
      // ★ 只要不在 list 裡就吸收，不管原本掛哪
      if (el && el.parentElement !== list) list.appendChild(el);
    });

    setTimeout(() => absorbBusy = false, 200);
  }
  absorbButtons();



  function checkMainMenu(){
    const side = document.getElementById('side');
    if (!side){ hub.classList.remove('hidden-by-menu'); return; }
    hub.classList.toggle('hidden-by-menu', side.classList.contains('open'));
  }
  checkMainMenu();
  const side = document.getElementById('side');
  if (side){
    new MutationObserver(checkMainMenu).observe(side, {
      attributes:true, attributeFilter:['class']
    });
  }

  // ★ 監看整個 DOM 樹（含深層）+ 每 2 秒補抓
  new MutationObserver(absorbButtons).observe(document.body, {
    childList:true, subtree:true
  });
  setInterval(absorbButtons, 2000);

  console.log('✅ v1.9.4 已注入');
})();
