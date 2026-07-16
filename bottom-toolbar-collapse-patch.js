/* bottom-toolbar-collapse-patch.js  v20260717-1
   底部工具列一鍵收合

   目標元素（可自訂）：
   - fullTranslateBox（中文翻譯）
   - gcttsPanel（全文語音播放）
   - geminiQuotaPanel（Gemini 用量面板）

   操作：
   - 點右下角 🔽 按鈕
   - 或 Ctrl+B / Cmd+B

   持久化：
   - notebook_bottom_collapsed_v1（狀態）
   - notebook_bottom_collapse_list_v1（清單）
*/
(function () {
  'use strict';
  var TAG = '[BottomCollapse]';
  var VER = 'v20260713-1';
  var STATE_KEY = 'notebook_bottom_collapsed_v1';
  var LIST_KEY = 'notebook_bottom_collapse_list_v1';

  var DEFAULT_TARGETS = ['fullTranslateBox', 'gcttsPanel', 'geminiQuotaPanel'];

  function getTargets() {
    try {
      var raw = localStorage.getItem(LIST_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) {}
    return DEFAULT_TARGETS.slice();
  }

  function saveTargets(list) {
    try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); }
    catch (e) {}
  }

  function isCollapsed() {
    return localStorage.getItem(STATE_KEY) === '1';
  }

  function setCollapsed(v) {
    localStorage.setItem(STATE_KEY, v ? '1' : '0');
  }

  // 隱藏一個元素
  function hideEl(el) {
    if (!el || el.dataset.bcollapsed === '1') return;
    el.dataset.bcollapsedOrig = el.style.display || '';
    el.style.display = 'none';
    el.dataset.bcollapsed = '1';
  }

  // 還原一個元素
  function showEl(el) {
    if (!el || el.dataset.bcollapsed !== '1') return;
    el.style.display = el.dataset.bcollapsedOrig || '';
    delete el.dataset.bcollapsed;
    delete el.dataset.bcollapsedOrig;
  }

  // 應用當前狀態到所有 targets
  function apply() {
    var collapsed = isCollapsed();
    var targets = getTargets();
    targets.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (collapsed) hideEl(el);
      else showEl(el);
    });
    updateBtnIcon();
  }

   function updateBtnIcon() {
    var btn = document.getElementById('bcollapseBtn');
    if (!btn) return;
    var collapsed = isCollapsed();

    // 用 A文 標籤（若已存在則跳過，避免重寫觸發別的 observer）
    if (!btn.querySelector('.a2c-label')) {
      btn.textContent = '';
      var label = document.createElement('span');
      label.className = 'a2c-label';
      label.textContent = 'A文';
      label.style.cssText = 'font-size:12px;font-weight:700;letter-spacing:-1px;line-height:1;';
      btn.appendChild(label);
    }
    btn.title = collapsed ? '展開翻譯 / 播放器 (Ctrl+B)' : '收合翻譯 / 播放器 (Ctrl+B)';
    // 讓快捷選單裡的顏色統一，不再依 collapsed 換色
  }

  function toggle() {
    setCollapsed(!isCollapsed());
    apply();
    console.log(TAG, isCollapsed() ? '\u{1F53C} 已收合' : '\u{1F53D} 已展開');
  }

  function collapse() {
    setCollapsed(true);
    apply();
  }

  function expand() {
    setCollapsed(false);
    apply();
  }

  function addTarget(id) {
    var list = getTargets();
    if (list.indexOf(id) === -1) {
      list.push(id);
      saveTargets(list);
      apply();
    }
  }

  function removeTarget(id) {
    var list = getTargets();
    var idx = list.indexOf(id);
    if (idx > -1) {
      list.splice(idx, 1);
      saveTargets(list);
      // 順便還原這個 id
      var el = document.getElementById(id);
      if (el) showEl(el);
    }
  }

  function status() {
    var list = getTargets();
    console.log(TAG, '狀態:', isCollapsed() ? '已收合' : '已展開');
    console.log(TAG, '目標清單:');
    list.forEach(function (id) {
      var el = document.getElementById(id);
      console.log('  ' + id + ':', el ? (el.dataset.bcollapsed === '1' ? '(已隱藏)' : '(顯示中)') : '(不存在)');
    });
  }

  // ---- UI ----
  var CSS = '' +
    '#bcollapseBtn{position:fixed;right:12px;bottom:280px;z-index:99997;' +
    '  width:40px;height:40px;border-radius:50%;background:#a68a56;color:#fff;' +
    '  border:none;font-size:16px;cursor:pointer;' +
    '  box-shadow:0 4px 12px rgba(0,0,0,.3);' +
    '  display:flex;align-items:center;justify-content:center;' +
    '  transition:transform .15s,background .2s}' +
    '#bcollapseBtn:hover{transform:scale(1.1)}' +
    '@media (max-width:600px){' +
    '  #bcollapseBtn{right:8px;bottom:260px;width:36px;height:36px;font-size:14px}' +
    '}';

  function injectCSS() {
    if (document.getElementById('bcollapseCSS')) return;
    var s = document.createElement('style');
    s.id = 'bcollapseCSS';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function buildBtn() {
    if (document.getElementById('bcollapseBtn')) return;
    var b = document.createElement('button');
    b.id = 'bcollapseBtn';
    b.onclick = toggle;
    document.body.appendChild(b);
    updateBtnIcon();
  }

  // 快捷鍵 Ctrl+B / Cmd+B
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      // 不干擾 input/textarea
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      toggle();
    }
  });

  // 對外 API
  window.__bottomCollapse = {
    toggle: toggle,
    collapse: collapse,
    expand: expand,
    addTarget: addTarget,
    removeTarget: removeTarget,
    status: status,
    getTargets: getTargets
  };

  function boot() {
    setTimeout(function () {
      injectCSS();
      buildBtn();
      apply();  // 首次套用（讀取記憶的狀態）

      // 每 1.5 秒重新套用，處理後來出現的元素
      setInterval(apply, 1500);

      console.log(TAG, 'ready', VER);
      console.log(TAG, '快捷鍵: Ctrl+B / Cmd+B');
      console.log(TAG, '目標:', getTargets().join(', '));
      console.log(TAG, '手動 API:');
      console.log(TAG, '  __bottomCollapse.toggle()      切換');
      console.log(TAG, '  __bottomCollapse.addTarget(id) 加入元素');
      console.log(TAG, '  __bottomCollapse.status()      查看狀態');
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
