/* ai-chat-merge-sync-patch.js v20260717-2
   包住 cloudUpload / cloudDownload，讓 aiChats 用「合併」而不是「覆蓋」
   規則：同 id 取 updatedAt 較新的；不同 id 全部保留
*/
(function(){
  'use strict';
  var TAG = '[AIChatMerge]';
  var STORE_KEY = 'notebook_platform_v3';

  function loadLocal(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch(e){ return {}; }
  }
  function saveLocal(db){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch(e){}
  }

  // 合併兩個 aiChats：以 updatedAt 較新為準
  function mergeAiChats(a, b){
    a = (a && a.chats) ? a : { chats:{} };
    b = (b && b.chats) ? b : { chats:{} };
    var merged = { chats:{}, currentId: a.currentId || b.currentId };
    var allIds = {};
    Object.keys(a.chats).forEach(function(id){ allIds[id] = 1; });
    Object.keys(b.chats).forEach(function(id){ allIds[id] = 1; });
    Object.keys(allIds).forEach(function(id){
      var ca = a.chats[id];
      var cb = b.chats[id];
      if (ca && cb){
        // 兩邊都有 → 取 updatedAt 較新
        merged.chats[id] = (ca.updatedAt || 0) >= (cb.updatedAt || 0) ? ca : cb;
      } else {
        merged.chats[id] = ca || cb;
      }
    });
    return merged;
  }

  function waitFor(cond, cb, tries){
    tries = tries || 0;
    if (cond()){ cb(); return; }
    if (tries > 40) return;   // 最多等 20 秒
    setTimeout(function(){ waitFor(cond, cb, tries+1); }, 500);
  }

  waitFor(
    function(){ return typeof window.cloudDownload === 'function' && typeof window.cloudUpload === 'function'; },
    function(){
      var origDownload = window.cloudDownload;
      var origUpload   = window.cloudUpload;

      // ▼▼▼ 下載包裝：下載後把「本地新版對話」合併回去
      window.cloudDownload = async function(manual){
        // 1) 先備份本地 aiChats
        var localBefore = loadLocal();
        var localAiChats = localBefore.aiChats
          ? JSON.parse(JSON.stringify(localBefore.aiChats))
          : { chats:{} };
        var localCount = Object.keys(localAiChats.chats || {}).length;

        // 2) 執行原下載（會用雲端整包覆蓋本地）
        var result = await origDownload.apply(this, arguments);

        // 3) 合併本地 + 雲端 aiChats
        var afterDb = loadLocal();
        var cloudAiChats = afterDb.aiChats || { chats:{} };
        var cloudCount = Object.keys(cloudAiChats.chats || {}).length;
        var merged = mergeAiChats(cloudAiChats, localAiChats);
        var mergedCount = Object.keys(merged.chats).length;

        afterDb.aiChats = merged;
        saveLocal(afterDb);
        // 也回寫舊 key，讓 patch 舊邏輯能讀到
        try { localStorage.setItem('notebook_ai_chats_v1', JSON.stringify(merged)); } catch(e){}
try { window.__aiChat && window.__aiChat.reload && window.__aiChat.reload(); } catch(e){} // ★ 追加
        console.log(TAG, '📥 下載合併:', '雲端', cloudCount, '+ 本地', localCount, '→ 合併', mergedCount);
        return result;
      };

      // ▼▼▼ 上傳包裝：上傳前先抓雲端合併一次，避免蓋掉別人的對話
      window.cloudUpload = async function(manual){
        // 1) 先偷抓雲端一次來合併（模擬下載但不覆蓋 UI）
        try {
          // 先備份現在的 db
          var backup = loadLocal();
          var backupAiChats = backup.aiChats ? JSON.parse(JSON.stringify(backup.aiChats)) : { chats:{} };
          var localCount = Object.keys(backupAiChats.chats || {}).length;

          // 悄悄下載一次（不彈 alert）
          var quietDownload = origDownload;
          await quietDownload.call(this, false);

          // 讀取雲端內容
          var afterDown = loadLocal();
          var cloudAiChats = afterDown.aiChats || { chats:{} };
          var cloudCount = Object.keys(cloudAiChats.chats || {}).length;

          // 合併：本地為準（如果本地有新編輯，updatedAt 較新）
          var merged = mergeAiChats(backupAiChats, cloudAiChats);

          // 但是原始 db 其他欄位可能被下載覆蓋回舊版！要還原回本地版
          // 策略：只把 aiChats 塞回，其他欄位取「本地版」（因為使用者剛剛在編輯的是本地）
          backup.aiChats = merged;
          saveLocal(backup);
          try { localStorage.setItem('notebook_ai_chats_v1', JSON.stringify(merged)); } catch(e){}
try { window.__aiChat && window.__aiChat.reload && window.__aiChat.reload(); } catch(e){} // ★ 追加
          console.log(TAG, '📤 上傳前合併:', '本地', localCount, '+ 雲端', cloudCount, '→', Object.keys(merged.chats).length);
        } catch(e){
          console.warn(TAG, '上傳前合併失敗（雲端可能還沒資料）:', e.message);
        }

        // 2) 再執行原上傳
        return await origUpload.apply(this, arguments);
      };

      console.log(TAG, 'ready v1.0 — cloudUpload/cloudDownload 已包裝為合併模式');
    }
  );
})();
