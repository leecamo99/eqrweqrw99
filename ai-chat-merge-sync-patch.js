/* ai-chat-merge-sync-patch.js v1.2
   關鍵發現：db 是全域物件，直接寫入 window.db.aiChats 即可
   - 上傳前：從 localStorage 抓最新 aiChats 塞進 window.db
   - 下載後：合併本地備份 + 雲端 aiChats
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

  function waitFor(cond, cb, tries){
    tries = tries || 0;
    if (cond()){ cb(); return; }
    if (tries > 40) return;
    setTimeout(function(){ waitFor(cond, cb, tries+1); }, 500);
  }

  waitFor(
    function(){ return typeof window.cloudUpload==='function' && typeof window.cloudDownload==='function'; },
    function(){
      var origUp   = window.cloudUpload;
      var origDown = window.cloudDownload;

      // ---- 上傳包裝：把 localStorage 最新 aiChats 注入 window.db ----
      window.cloudUpload = async function(){
        try {
          var fresh = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
          if (window.db && fresh.aiChats){
            window.db.aiChats = fresh.aiChats;
            console.log(TAG, '📤 注入本地 aiChats 到 window.db，對話數:', Object.keys(fresh.aiChats.chats||{}).length);
          }
        } catch(e){
          console.warn(TAG, '注入失敗:', e.message);
        }
        return await origUp.apply(this, arguments);
      };

      // ---- 下載包裝：先備份本地，下載後合併 ----
      window.cloudDownload = async function(){
        // 1) 備份本地 aiChats
        var before = {};
        try { before = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch(e){}
        var backupAi = before.aiChats ? JSON.parse(JSON.stringify(before.aiChats)) : { chats:{} };
        var backupCount = Object.keys(backupAi.chats || {}).length;

        // 2) 執行原下載（雲端整包覆蓋 window.db 和 localStorage）
        var result = await origDown.apply(this, arguments);

        // 3) 讀出雲端下載後的 aiChats
        var after = {};
        try { after = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch(e){}
        var cloudAi = after.aiChats || { chats:{} };
        var cloudCount = Object.keys(cloudAi.chats || {}).length;

        // 4) 合併
        var merged = mergeAi(cloudAi, backupAi);
        var mergedCount = Object.keys(merged.chats).length;

        // 5) 寫回 localStorage 和 window.db
        after.aiChats = merged;
        try { localStorage.setItem(STORE_KEY, JSON.stringify(after)); } catch(e){}
        if (window.db) window.db.aiChats = merged;

        // 6) 也寫舊 key 保底
        try { localStorage.setItem('notebook_ai_chats_v1', JSON.stringify(merged)); } catch(e){}

        // 7) 通知 AI 抽屜 reload
        try {
          if (window.__aiChat && window.__aiChat.reload) window.__aiChat.reload();
        } catch(e){}

        console.log(TAG, '📥 下載合併：雲端', cloudCount, '+ 本地備份', backupCount, '→', mergedCount);
        return result;
      };

      console.log(TAG, 'v1.2 ready — window.db 直接注入');
    }
  );
})();
