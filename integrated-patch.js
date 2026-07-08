(function(){
  'use strict';

  // 統一發音引擎
  window.playVoice = function(word) {
    const cleanWord = String(word||'').replace(/[^a-zA-Z\s\-]/g, '').trim().split(/\s+/)[0];
    if (!cleanWord) return;
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(cleanWord)}`;
    new Audio(ttsUrl).play().catch(e => console.log("需點擊頁面解鎖音訊"));
  };

  // 暴力注入邏輯
  function inject() {
    // 尋找所有可能是彈窗的 DIV
    const modals = document.querySelectorAll('div[style*="fixed"], div[id*="dock"], .word-note-popup');
    
    modals.forEach(modal => {
        // 只要彈窗裡面有這些關鍵字，且還沒掛過按鈕
        if ((modal.textContent.includes('點擊') || modal.textContent.includes('先想中文')) && !modal.dataset.ttsInjected) {
            modal.dataset.ttsInjected = 'true';
            
            // 建立按鈕
            const btn = document.createElement('button');
            btn.textContent = '🔊 真人發音';
            btn.style.cssText = "display:block; width:100%; padding:10px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-size:14px; margin-bottom:10px;";
            
            // 點擊事件：從該彈窗內找尋 h1/h2 或 .wordbig 作為單字
            btn.onclick = (e) => {
                e.stopPropagation();
                const word = modal.querySelector('h1, h2, .wordbig, .word-title')?.textContent || '';
                if (word) window.playVoice(word);
            };
            
            // 強制塞在彈窗最上方
            modal.prepend(btn);
            console.log("✅ [TTS] 已成功在彈窗注入發音按鈕！");
        }
    });
  }

  // 持續監控頁面變化
  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
})();
