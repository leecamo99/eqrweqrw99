/* gemini-multi-key-patch.js v20260712-1
   Manages multiple Gemini API keys with automatic rotation.
   Provides window.getGeminiKey() and window.markGeminiKey429().
*/

(function () {

  'use strict';

  var KEYS_STORAGE = 'notebook_gemini_keys_v1';   // 多 key 存這裡
  var LEGACY_KEY_STORAGE = 'notebook_gemini_key_v1';   // 舊 patch 相容
  var RATE_LIMIT_COOLDOWN = 60000;   // 60 秒 cooldown

  var keyStatus = {};   // { key: { lastRateLimitAt: timestamp } }

  function log() {
    try {
      console.log.apply(console, ['[GeminiKeys]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getKeys() {

    // 讀多 key
    var raw = localStorage.getItem(KEYS_STORAGE);
    if (raw) {
      try {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      } catch (e) {}
    }

    // 相容舊版 single key
    var legacy = localStorage.getItem(LEGACY_KEY_STORAGE);
    if (legacy) return [legacy];

    return [];
  }

  function saveKeys(keys) {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));

    // 同時更新舊 key，讓其他 patch 也能用
    if (keys.length > 0) {
      localStorage.setItem(LEGACY_KEY_STORAGE, keys[0]);
    } else {
      localStorage.removeItem(LEGACY_KEY_STORAGE);
    }
  }

  function isKeyAvailable(key) {

    var status = keyStatus[key];
    if (!status) return true;

    var elapsed = Date.now() - status.lastRateLimitAt;
    return elapsed >= RATE_LIMIT_COOLDOWN;
  }

  function getAvailableKey() {

    var keys = getKeys();
    if (keys.length === 0) return null;

    // 先找可用的 key
    for (var i = 0; i < keys.length; i++) {
      if (isKeyAvailable(keys[i])) {
        return keys[i];
      }
    }

    // 全部都在 cooldown，回傳最舊 cooldown 的
    var oldest = null;
    var oldestTime = Infinity;

    for (var j = 0; j < keys.length; j++) {
      var s = keyStatus[keys[j]];
      if (!s) return keys[j];   // 沒紀錄的優先
      if (s.lastRateLimitAt < oldestTime) {
        oldestTime = s.lastRateLimitAt;
        oldest = keys[j];
      }
    }

    return oldest;
  }

  function getAllAvailableKeys() {
    return getKeys().filter(isKeyAvailable);
  }

  function markKey429(key) {
    keyStatus[key] = {
      lastRateLimitAt: Date.now()
    };
    log('marked 429:', key.slice(0, 10) + '...');
  }

  function markKeyOk(key) {
    // 成功時清除 cooldown
    delete keyStatus[key];
    log('marked ok:', key.slice(0, 10) + '...');
  }

  function getKeyStatus() {

    var keys = getKeys();
    return keys.map(function (k) {

      var status = keyStatus[k];
      var available = isKeyAvailable(k);
      var cooldownRemaining = 0;

      if (!available && status) {
        cooldownRemaining = Math.ceil((RATE_LIMIT_COOLDOWN - (Date.now() - status.lastRateLimitAt)) / 1000);
      }

      return {
        key: k.slice(0, 10) + '...' + k.slice(-4),
        keyFull: k,
        available: available,
        cooldownRemaining: cooldownRemaining
      };
    });
  }

  // 匯出全域 API
  window.getGeminiKey = getAvailableKey;
  window.markGeminiKey429 = markKey429;
  window.markGeminiKeyOk = markKeyOk;
  window.getGeminiKeys = getKeys;
  window.saveGeminiKeys = saveKeys;
  window.getGeminiKeyStatus = getKeyStatus;

  // UI: 建立管理 modal
  function openKeyManager() {

    if (document.getElementById('geminiKeyManagerModal')) {
      document.getElementById('geminiKeyManagerModal').remove();
    }

    var modal = document.createElement('div');
    modal.id = 'geminiKeyManagerModal';

    modal.style.cssText = ''
      + 'position: fixed;'
      + 'inset: 0;'
      + 'background: rgba(0,0,0,0.6);'
      + 'z-index: 99999;'
      + 'display: flex;'
      + 'align-items: center;'
      + 'justify-content: center;'
      + 'padding: 20px;'
      + 'font-family: Segoe UI, Microsoft JhengHei, sans-serif;';

    modal.innerHTML = 
      '<div style="' +
        'background: #fff;' +
        'border-radius: 10px;' +
        'padding: 20px;' +
        'max-width: 600px;' +
        'width: 100%;' +
        'max-height: 90vh;' +
        'display: flex;' +
        'flex-direction: column;' +
        'gap: 12px;' +
      '">' +

        '<div style="display: flex; justify-content: space-between; align-items: center;">' +
          '<h2 style="margin: 0; font-size: 18px; color: #333;">🔑 Gemini API Keys 管理</h2>' +
          '<button id="keyManagerClose" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>' +
        '</div>' +

        '<div style="color: #666; font-size: 12px; line-height: 1.6;">' +
          '添加多個 API key，遇到 429 限額時自動切換到下一個 key。<br>' +
          '每個 key 遇到 429 後有 60 秒冷卻期。' +
        '</div>' +

        '<div id="keyListContainer" style="flex: 1; overflow-y: auto; padding: 5px 0;"></div>' +

        '<div style="display: flex; gap: 6px; padding-top: 10px; border-top: 1px solid #eee;">' +
          '<input type="text" id="newKeyInput" placeholder="貼上 API Key (AIza...)" style="' +
            'flex: 1;' +
            'padding: 8px 12px;' +
            'border: 1px solid #ccc;' +
            'border-radius: 4px;' +
            'font-family: monospace;' +
            'font-size: 12px;' +
          '">' +
          '<button id="addKeyBtn" style="' +
            'padding: 8px 16px;' +
            'background: #2f6f9f;' +
            'color: white;' +
            'border: none;' +
            'border-radius: 4px;' +
            'cursor: pointer;' +
            'font-size: 12px;' +
          '">加入</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    var refreshList = function () {

      var container = document.getElementById('keyListContainer');
      if (!container) return;

      var statuses = getKeyStatus();

      if (statuses.length === 0) {
        container.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">尚未加入任何 API Key</div>';
        return;
      }

      container.innerHTML = statuses.map(function (s, i) {

        var statusColor = s.available ? '#4a7856' : '#c65';
        var statusText = s.available ? '✓ 可用' : '⏱ 冷卻中 ' + s.cooldownRemaining + 's';

        return '<div style="' +
          'display: flex;' +
          'align-items: center;' +
          'gap: 10px;' +
          'padding: 10px;' +
          'margin-bottom: 6px;' +
          'background: #f8f7f2;' +
          'border-radius: 6px;' +
          'border-left: 4px solid ' + statusColor + ';' +
        '">' +
          '<div style="flex: 1;">' +
            '<div style="font-family: monospace; font-size: 12px; color: #333;">' + s.key + '</div>' +
            '<div style="font-size: 11px; color: ' + statusColor + '; margin-top: 3px;">' + statusText + '</div>' +
          '</div>' +
          '<button class="deleteKeyBtn" data-idx="' + i + '" style="' +
            'padding: 5px 10px;' +
            'background: #c65;' +
            'color: white;' +
            'border: none;' +
            'border-radius: 3px;' +
            'cursor: pointer;' +
            'font-size: 11px;' +
          '">🗑️ 刪除</button>' +
        '</div>';

      }).join('');

      // 綁定刪除
      container.querySelectorAll('.deleteKeyBtn').forEach(function (btn) {
        btn.onclick = function () {
          if (confirm('確定刪除這個 API Key？')) {
            var idx = parseInt(this.dataset.idx);
            var keys = getKeys();
            keys.splice(idx, 1);
            saveKeys(keys);
            refreshList();
          }
        };
      });
    };

    // 綁定關閉
    document.getElementById('keyManagerClose').onclick = function () {
      modal.remove();
    };

    // 綁定加入
    document.getElementById('addKeyBtn').onclick = function () {

      var input = document.getElementById('newKeyInput');
      var key = input.value.trim();

      if (!key) {
        alert('請輸入 API Key');
        return;
      }

      if (!/^AIza/.test(key)) {
        if (!confirm('這不像 AIza... 開頭的 Gemini API Key，確定要加入？')) {
          return;
        }
      }

      var keys = getKeys();

      if (keys.indexOf(key) !== -1) {
        alert('這個 key 已經加入過');
        return;
      }

      keys.push(key);
      saveKeys(keys);

      input.value = '';
      refreshList();
    };

    refreshList();

    // 定期更新狀態
    var refreshInterval = setInterval(function () {
      if (!document.getElementById('geminiKeyManagerModal')) {
        clearInterval(refreshInterval);
        return;
      }
      refreshList();
    }, 1000);
  }

  window.openGeminiKeyManager = openKeyManager;

  // 加到 settings menu 內（如果 v6 patch 存在）
  function addManagerButton() {

    if (document.getElementById('openGeminiKeyManagerBtn')) return;

    var block = document.getElementById('settings-menu-block');
    if (!block) return;

    var btn = document.createElement('button');
    btn.id = 'openGeminiKeyManagerBtn';
    btn.textContent = '🔑 管理多個 Gemini Keys';
    btn.style.cssText = ''
      + 'display: block;'
      + 'width: 100%;'
      + 'margin-top: 8px;'
      + 'padding: 8px;'
      + 'background: #a68a56;'
      + 'color: white;'
      + 'border: none;'
      + 'border-radius: 4px;'
      + 'cursor: pointer;'
      + 'font-size: 12px;';

    btn.onclick = openKeyManager;

    block.appendChild(btn);

    log('manager button added to settings');
  }

  setInterval(addManagerButton, 2000);

  log('ready v20260712-1');

})();
