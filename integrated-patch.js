(function(){
  'use strict';

  // --- 統一發音引擎 (含備援) ---
  window.playVoice = function(word) {
    const cleanWord = String(word||'').replace(/[^a-zA-Z\s\-]/g, '').trim().split(/\s+/)[0];
    if (!cleanWord) return;
    
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(cleanWord)}`;
    const audio = new Audio(ttsUrl);
    
    audio.play().catch(e => {
        const fallback = new SpeechSynthesisUtterance(cleanWord);
        fallback.lang = 'en-US';
        window.speechSynthesis.speak(fallback);
    });
  };

  // --- 精準注入邏輯 ---
  function inject() {
    // 鎖定所有彈窗
    const modals = document.querySelectorAll('.word-note-popup, .flashcard-modal, div[id*="popup"]');
    
    modals.forEach(modal => {
        // 1. 檢查是否已經有我們注入過的按鈕 (防止重複)
        if (modal.querySelector('.tts-native-btn')) return;
        
        // 2. 檢查是否包含關鍵字
        if (modal.textContent.includes('點擊') || modal.textContent.includes('先想中文')) {
            
            // 建立按鈕
            const btn = document.createElement('button');
            btn.className = 'tts-native-btn'; // 給予 Class 方便檢測
            btn.textContent = '🔊 真人發音';
            btn.style.cssText = "display:block; width:100%; padding:8px; margin-bottom:5px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;";
            
            btn.onclick = (e) => {
                e.stopPropagation();
                const word = modal.querySelector('h1, h2, .wordbig, .word-title')?.textContent || '';
                if (word) window.playVoice(word);
            };
            
            // 使用 prepend 確保放在最上方，且只塞一次
            modal.prepend(btn);
            console.log("✅ [TTS] 已精準注入唯一按鈕");
        }
    });
  }

  // 使用 MutationObserver 監控
  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
})();
