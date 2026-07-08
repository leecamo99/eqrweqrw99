(function(){
  'use strict';

  // --- 1. 統一發音引擎 (備援機制：Google TTS + 瀏覽器內建語音) ---
  window.playVoice = function(word) {
    const cleanWord = String(word||'').replace(/[^a-zA-Z\s\-]/g, '').trim().split(/\s+/)[0];
    if (!cleanWord) return;
    
    // Google TTS 接口
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(cleanWord)}`;
    const audio = new Audio(ttsUrl);
    
    // 播放邏輯：若被攔截則使用瀏覽器內建語音
    audio.play().catch(e => {
        console.warn("Google TTS 遭阻擋，啟用備援發音...");
        const fallback = new SpeechSynthesisUtterance(cleanWord);
        fallback.lang = 'en-US';
        window.speechSynthesis.speak(fallback);
    });
  };

  // --- 2. 暴力注入邏輯 ---
  function inject() {
    // 針對所有可能的彈窗進行掃描
    const modals = document.querySelectorAll('div[style*="fixed"], div[id*="dock"], .word-note-popup');
    
    modals.forEach(modal => {
        // 偵測是否為閃卡 (含有觸發關鍵字) 且尚未注入過
        if ((modal.textContent.includes('點擊') || modal.textContent.includes('先想中文')) && !modal.dataset.ttsInjected) {
            modal.dataset.ttsInjected = 'true';
            
            // 建立按鈕
            const btn = document.createElement('button');
            btn.textContent = '🔊 真人發音';
            btn.style.cssText = "display:block; width:100%; padding:10px; margin-bottom:10px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-size:14px; font-weight:bold;";
            
            // 綁定點擊事件
            btn.onclick = (e) => {
                e.stopPropagation();
                // 從該彈窗中抓取標題文字
                const word = modal.querySelector('h1, h2, .wordbig, .word-title')?.textContent || '';
                if (word) window.playVoice(word);
            };
            
            // 強制塞入彈窗最頂部
            modal.prepend(btn);
            console.log("✅ [TTS] 已注入按鈕");
        }
    });
  }

  // --- 3. 初始化監控 ---
  const observer = new MutationObserver(inject);
  observer.observe(document.body, { childList: true, subtree: true });
  
  // 初始執行一次
  inject();
})();
