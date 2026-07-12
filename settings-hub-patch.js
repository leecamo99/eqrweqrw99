/* settings-hub-patch.js v20260712-1
   Central settings page for cloud sync, keys, tools, imports.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[SettingsHub]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function openSettingsHub() {

    if (document.getElementById('settingsHubModal')) {
      document.getElementById('settingsHubModal').remove();
    }

    var modal = document.createElement('div');
    modal.id = 'settingsHubModal';
    modal.style.cssText = 
      'position: fixed;' +
      'inset: 0;' +
      'background: rgba(0,0,0,0.6);' +
      'z-index: 99998;' +
      'display: flex;' +
      'align-items: center;' +
      'justify-content: center;' +
      'padding: 20px;' +
      'font-family: Segoe UI, Microsoft JhengHei, sans-serif;' +
      'overflow: auto;';

    var syncStatus = document.getElementById('syncText')?.textContent || '尚未設定';

    modal.innerHTML = 
      '<div style="' +
        'background: #f8f7f2;' +
        'border-radius: 12px;' +
        'padding: 20px;' +
        'max-width: 700px;' +
        'width: 100%;' +
        'max-height: 90vh;' +
        'overflow-y: auto;' +
        'box-shadow: 0 14px 38px rgba(0,0,0,0.35);' +
      '">' +

        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #a68a56;">' +
          '<h2 style="margin: 0; font-size: 22px; color: #333;">⚙️ 設定與管理</h2>' +
          '<button id="settingsHubCloseBtn" style="padding: 5px 12px; background: transparent; border: 1px solid #aaa; border-radius: 4px; cursor: pointer; font-size: 14px;">關閉</button>' +
        '</div>' +

        // 雲端同步區
        '<div class="settingsSection">' +
          '<h3 style="color: #a68a56; font-size: 16px; margin: 15px 0 10px; border-bottom: 1px dashed #d9cfbc; padding-bottom: 5px;">☁️ 雲端同步 (GitHub)</h3>' +
          '<div style="color: #666; font-size: 12px; margin-bottom: 10px;">' +
            '狀態：<span id="hubSyncStatus" style="color: #a68a56;">' + escapeHtml(syncStatus) + '</span>' +
          '</div>' +
          '<div style="display: flex; gap: 8px; flex-wrap: wrap;">' +
            '<button class="settingsBtn" data-action="openSync">📝 設定</button>' +
            '<button class="settingsBtn" data-action="cloudUpload">⬆️ 上傳</button>' +
            '<button class="settingsBtn" data-action="cloudDownload">⬇️ 載入</button>' +
          '</div>' +
        '</div>' +

        // API Keys 區
        '<div class="settingsSection">' +
          '<h3 style="color: #a68a56; font-size: 16px; margin: 15px 0 10px; border-bottom: 1px dashed #d9cfbc; padding-bottom: 5px;">🔑 API Keys 管理</h3>' +
          '<div style="color: #666; font-size: 12px; margin-bottom: 10px;">' +
            '設定 GitHub Token、Gemini、Google TTS、Google Translate 等 API Keys' +
          '</div>' +
          '<div style="display: flex; gap: 8px; flex-wrap: wrap;">' +
            '<button class="settingsBtn" data-action="apiKeys">🔧 開啟 API Keys 設定</button>' +
            '<button class="settingsBtn" data-action="geminiKeys">🔑 管理多個 Gemini Keys</button>' +
          '</div>' +
        '</div>' +

        // 建立筆記本區
        '<div class="settingsSection">' +
          '<h3 style="color: #a68a56; font-size: 16px; margin: 15px 0 10px; border-bottom: 1px dashed #d9cfbc; padding-bottom: 5px;">📝 建立筆記本</h3>' +
          '<div style="display: flex; gap: 8px; flex-wrap: wrap;">' +
            '<button class="settingsBtn" data-action="paste">📋 貼上文字建立</button>' +
            '<button class="settingsBtn" data-action="blank">📄 新增空白</button>' +
          '</div>' +
        '</div>' +

        // 資料管理區
        '<div class="settingsSection">' +
          '<h3 style="color: #a68a56; font-size: 16px; margin: 15px 0 10px; border-bottom: 1px dashed #d9cfbc; padding-bottom: 5px;">💾 資料管理</h3>' +
          '<div style="color: #666; font-size: 12px; margin-bottom: 10px;">' +
            '備份、匯出、匯入本機資料' +
          '</div>' +
          '<div style="display: flex; gap: 8px; flex-wrap: wrap;">' +
            '<button class="settingsBtn" data-action="export">💾 匯出全部</button>' +
            '<button class="settingsBtn" data-action="import">📂 匯入</button>' +
            '<button class="settingsBtn danger" data-action="reset">🗑️ 清空本機</button>' +
          '</div>' +
        '</div>' +

        // 學習資料統計
        '<div class="settingsSection">' +
          '<h3 style="color: #a68a56; font-size: 16px; margin: 15px 0 10px; border-bottom: 1px dashed #d9cfbc; padding-bottom: 5px;">📊 學習資料統計</h3>' +
          '<div id="hubStats" style="color: #666; font-size: 12px; line-height: 1.8;"></div>' +
        '</div>' +

      '</div>';

    document.body.appendChild(modal);

    // 加樣式
    ensureButtonStyle();

    // 綁定關閉
    document.getElementById('settingsHubCloseBtn').onclick = function () {
      modal.remove();
    };

    // 點外面關閉
    modal.onclick = function (e) {
      if (e.target === modal) modal.remove();
    };

    // 綁定所有按鈕
    modal.querySelectorAll('.settingsBtn').forEach(function (btn) {
      btn.onclick = function () {
        handleAction(this.dataset.action, modal);
      };
    });

    // 更新統計
    updateStats();
  }

  function ensureButtonStyle() {
    if (document.getElementById('settingsHubStyle')) return;

    var style = document.createElement('style');
    style.id = 'settingsHubStyle';
    style.textContent = 
      '.settingsSection { margin-bottom: 20px; padding: 12px; background: white; border-radius: 8px; border: 1px solid #e5ddc9; }' +
      '.settingsBtn { padding: 8px 14px; background: #a68a56; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; transition: background 0.2s; }' +
      '.settingsBtn:hover { background: #7a6547; }' +
      '.settingsBtn.danger { background: #c65; }' +
      '.settingsBtn.danger:hover { background: #a54; }';

    document.head.appendChild(style);
  }

  function handleAction(action, modal) {

    switch (action) {

      case 'openSync':
        modal.remove();
        if (typeof window.openSync === 'function') window.openSync();
        break;

      case 'cloudUpload':
        modal.remove();
        if (typeof window.cloudUpload === 'function') window.cloudUpload(true);
        break;

      case 'cloudDownload':
        modal.remove();
        if (typeof window.cloudDownload === 'function') window.cloudDownload(true);
        break;

      case 'apiKeys':
        // 觸發 settings-menu-patch 的展開
        var block = document.getElementById('settings-menu-block');
        if (block) {
          var title = block.querySelector('div[style*="cursor:pointer"], div[style*="cursor: pointer"]');
          if (title) {
            modal.remove();
            // 讓 #sync 顯示
            var sync = document.getElementById('sync');
            if (sync) sync.style.display = 'block';
            setTimeout(function () {
              title.click();
              title.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          } else {
            alert('請先展開設定選單');
          }
        } else {
          alert('API Keys 選單尚未載入');
        }
        break;

      case 'geminiKeys':
        modal.remove();
        if (typeof window.openGeminiKeyManager === 'function') {
          window.openGeminiKeyManager();
        } else {
          alert('請先加載 gemini-multi-key-patch.js');
        }
        break;

      case 'paste':
        modal.remove();
        if (typeof window.openPaste === 'function') window.openPaste();
        break;

      case 'blank':
        modal.remove();
        if (typeof window.createBlank === 'function') window.createBlank();
        break;

      case 'export':
        if (typeof window.exportAll === 'function') window.exportAll();
        break;

      case 'import':
        modal.remove();
        var importFile = document.getElementById('importFile');
        if (importFile) importFile.click();
        break;

      case 'reset':
        modal.remove();
        if (typeof window.resetAll === 'function') window.resetAll();
        break;
    }
  }

  function updateStats() {

    var statsEl = document.getElementById('hubStats');
    if (!statsEl) return;

    try {
      var db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');

      var notebooks = db.notebooks || [];
      var totalCards = 0;
      notebooks.forEach(function (nb) {
        totalCards += (nb.cards || []).length;
      });

      var learn = db.learn || {};
      var totalWords = Object.keys(learn).length;
      var weakWords = Object.values(learn).filter(function (w) {
        return (w.lifetimeClicks || 0) >= 10 || (w.maxClickStreak || 0) >= 10 || w.isWeak || ((w.clicks || 0) >= 10);
      }).length;

      // localStorage 大小
      var lsSize = 0;
      for (var key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          lsSize += (localStorage[key].length + key.length) * 2;
        }
      }
      var lsSizeMB = (lsSize / 1024 / 1024).toFixed(2);

      statsEl.innerHTML = 
        '📚 筆記本數量：' + notebooks.length + '<br>' +
        '📄 段落總數：' + totalCards + '<br>' +
        '📖 已學單字：' + totalWords + ' 個<br>' +
        '⚠️ 弱點單字：' + weakWords + ' 個<br>' +
        '💾 本機儲存：' + lsSizeMB + ' MB / 約 10 MB';

    } catch (e) {
      statsEl.innerHTML = '無法載入統計';
    }
  }

  function escapeHtml(text) {
    return String(text || '').replace(/[<>&"']/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function bindSettingsBtn() {

    var btn = document.getElementById('openSettingsPageBtn');
    if (btn && !btn.dataset.hubBound) {
      btn.dataset.hubBound = '1';
      btn.onclick = openSettingsHub;
      log('button bound');
    }
  }

  setInterval(bindSettingsBtn, 1000);
  bindSettingsBtn();

  window.openSettingsHub = openSettingsHub;

  log('ready v20260712-1');

})();
