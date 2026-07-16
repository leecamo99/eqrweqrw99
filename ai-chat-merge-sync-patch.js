/* ai-chat-merge-sync-patch.js v1.3
   關鍵：上傳前用 ghGet 偷抓雲端 aiChats 做合併，避免蓋掉別台的對話
*/
(function(){
  'use strict';
  var TAG = '[AIChatMerge]';
  var STORE_KEY = 'notebook_platform_v3';

  function mergeAi(a, b){
    a = (a && a.chats) ? a : { chats:{} };
    b = (b && b.chats) ? b : { chats:{} };
    var merged = { chats:{}, currentId: a.currentId || b.currentId };
    var ids = {};
    Object.keys(a.chats).forEach(function(id){ ids[id]=1; });
    Object.keys(b.chats).forEach(function(id){ ids[id]=1; });
    Object.keys(ids).forEach(function(id){
      var ca = a.chats[id], cb = b.chats[id];
      if (ca && cb) merged.chats[id] = (ca.updatedAt||0) >= (cb.updatedAt||0) ? ca : cb;
      else merged.chats[id] = ca || cb;
    });
    return merged;
  }

  // 偷抓雲端 aiChats（不動 window.db 其他欄位）
  async function fetchCloudAiChats(){
    try {
      var sync = document.getElementById('sync');
      if (!sync || !sync.token || typeof window.ghGet !== 'function') return { chats:{} };
      var ex = await window.ghGet(sync.path);
      if (!ex || !ex.content) return { chats:{} };
      var decoded;
      if (typeof window.b64d === 'function'){
        decoded = window.b64d(ex.content);
      } else {
        // 標準 base64 解碼（含 UTF-8 修正）
        decoded = decodeURIComponent(escape(atob(ex.content.replace(/\s/g,''))));
      }
      var remote = JSON.parse(decoded);
      return remote.aiChats || { chats:{} };
    } catch(e){
      console.warn(TAG, '偷抓雲端失敗:', e.message);
      return { chats:{} };
    }
  }

  function waitFor(cond, cb, tries){
    tries = tries || 0;
    if (cond()){ cb(); return; }
    if (tries > 40) return;
    setTimeout(function(){ waitFor(cond, cb, tries+1); }, 500);
  }

  waitFor(
    function(){
      return typeof window.cloudUpload === 'function'
          && typeof window.cloudDownload === 'function'
          && typeof window.ghGet === 'function';
    },
    function(){
      var origUp   = window.cloudUpload;
      var origDown = window.cloudDownload;

      // ---- 上傳包裝：偷抓雲端 → 合併 → 注入 window.db → 上傳 ----
      window.cloudUpload = async function(){
        try {
          var localFull = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
          var localAi = localFull.aiChats || { chats:{} };
          var localCount = Object.keys(localAi.chats || {}).length;

          var cloudAi = await fetchCloudAiChats();
          var cloudCount = Object.keys(cloudAi.chats || {}).length;

          var merged = mergeAi(cloudAi, localAi);
          var mergedCount = Object.keys(merged.chats).length;

          if (window.db) window.db.aiChats = merged;
          localFull.aiChats = merged;
          try { localStorage.setItem(STORE_KEY, JSON.stringify(localFull)); } catch(e){}
          try { localStorage.setItem('notebook_ai_chats_v1', JSON.stringify(merged)); } catch(e){}
          try { if (window.__aiChat && window.__aiChat.reload) window.__aiChat.reload(); } catch(e){}

          console.log(TAG, '📤 上傳前合併: 本地', localCount, '+ 雲端', cloudCount, '→', mergedCount);
        } catch(e){
          console.warn(TAG, '上傳前合併失敗:', e.message);
        }
        return await origUp.apply(this, arguments);
      };

      // ---- 下載包裝：備份本地 → 執行下載 → 合併 ----
      window.cloudDownload = async function(){
        var before = {};
        try { before = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch(e){}
        var backupAi = before.aiChats ? JSON.parse(JSON.stringify(before.aiChats)) : { chats:{} };
        var backupCount = Object.keys(backupAi.chats || {}).length;

        var result = await origDown.apply(this, arguments);

        var after = {};
        try { after = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch(e){}
        var cloudAi = after.aiChats || { chats:{} };
        var cloudCount = Object.keys(cloudAi.chats || {}).length;

        var merged = mergeAi(cloudAi, backupAi);
        var mergedCount = Object.keys(merged.chats).length;

        after.aiChats = merged;
        try { localStorage.setItem(STORE_KEY, JSON.stringify(after)); } catch(e){}
        if (window.db) window.db.aiChats = merged;
        try { localStorage.setItem('notebook_ai_chats_v1', JSON.stringify(merged)); } catch(e){}
        try { if (window.__aiChat && window.__aiChat.reload) window.__aiChat.reload(); } catch(e){}

        console.log(TAG, '📥 下載合併: 雲端', cloudCount, '+ 本地備份', backupCount, '→', mergedCount);
        return result;
      };

      console.log(TAG, 'v1.3 ready — 上傳前 ghGet 偷抓雲端做合併');
    }
  );
})();
