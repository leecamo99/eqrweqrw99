(function(){
  'use strict';

  // --- 1. 定義所有核心功能函式 ---
  function bindMeaning(){
    const meaning = document.querySelector('#dockBody .meaning');
    if(!meaning || meaning.dataset.bound) return;
    meaning.dataset.bound = 'true';
    meaning.style.cursor = 'help';
    meaning.addEventListener('mouseenter', e => { /* ...原本的 hover 詳解邏輯... */ });
  }

  function playVoice(word) {
    const cleanWord = word.replace(/[^a-zA-Z\s\-]/g, '').trim().split(/\s+/)[0];
    if (!cleanWord) return;
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(cleanWord)}`;
    new Audio(ttsUrl).play().catch(e => console.log("需點擊頁面解鎖"));
  }

  // --- 2. 統一的執行邏輯 (使用 setTimeout 確保 DOM 就緒) ---
  function mainLoop() {
    try {
        bindMeaning(); // 確保這先執行
        
        // 處理發音按鈕注入
        document.querySelectorAll('div').forEach(el => {
            if ((el.textContent.includes('點擊') || el.textContent.includes('發音')) && !el.dataset.upgraded) {
                el.dataset.upgraded = 'true';
                el.addEventListener('click', (e) => {
                    const word = document.querySelector('.word-note-popup h1, .wordbig')?.textContent || '';
                    if (word) playVoice(word);
                });
            }
        });
    } catch (e) {
        console.error("執行衝突:", e);
    }
  }

  // 監控頁面變化
  new MutationObserver(mainLoop).observe(document.body, { childList: true, subtree: true });
})();
