/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (全域文字劫持注入版) */
(function() {
  const TAG = '[TTS Word Upgrade]';
  let lastClickedWord = ''; 

  // 1. 全域劫持：直接沒收原生假音的發聲權
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = function(utterance) {
      console.log(`${TAG} 偵測到原生機器人試圖發音，已成功攔截並封鎖。`);
    };
  }

  // 2. 監聽整個網頁的點擊：自動記憶你點的英文字
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.tagName === 'BUTTON' || target.closest('.audio-player-panel') || target.closest('div[style*="fixed"][style*="bottom"]')) return;
    
    const txt = target.textContent.trim().replace(/[^a-zA-Z']/g, '');
    if (txt && txt.length > 0 && txt.length < 30) {
      lastClickedWord = txt;
      console.log(`${TAG} 系統已自動記住你最後點擊的單字: "${lastClickedWord}"`);
    }
  }, true);

  // 3. 定時監控畫面上是否有彈出 WORD NOTE 視窗
  setInterval(() => {
    const btnList = Array.from(document.querySelectorAll('button'));
    const speakBtn = btnList.find(btn => btn.textContent.includes('發音'));

    if (speakBtn && !speakBtn.dataset.isUpgraded) {
      speakBtn.dataset.isUpgraded = 'true';
      
      // 保持紫色質感外觀
      speakBtn.innerHTML = '🔊 TTS 真人發音';
      speakBtn.style.setProperty('background', '#9b59b6', 'important');
      speakBtn.style.setProperty('color', '#ffffff', 'important');

      // 複製新按鈕以徹底清除舊事件
      const newSpeakBtn = speakBtn.cloneNode(true);
      speakBtn.parentNode.replaceChild(newSpeakBtn, speakBtn);

      // 綁定專屬的 Google Cloud TTS 播放邏輯
      newSpeakBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        let wordText = lastClickedWord;

        if (!wordText) {
          const modal = newSpeakBtn.closest('div[style*="fixed"]') || document.body;
          const boldWord = modal.querySelector('strong, b, h2');
          if (boldWord) wordText = boldWord.textContent.trim().replace(/[^a-zA-Z']/g, '');
        }

        console.log(`${TAG} 確定觸發 TTS 真人發音，送出單字: "${wordText}"`);

        if (wordText && wordText.length > 0) {
          if (window.speechSynthesis) window.speechSynthesis.cancel();

          // 💡 核心大絕招：直接尋找 v5.js 存放文章內容的網頁核心節點
          // 你的專案中，儲存文章內容以便閱讀和傳給 TTS 的核心容器通常是 article 或是特定的專案 class
          const contentArea = document.getElementById('text-input') || 
                              document.querySelector('textarea') || 
                              document.querySelector('.article-content') ||
                              document.querySelector('.content') ||
                              document.body;

          // 尋找底部的 v5 播放面板與播放按鈕
          const ttsPanel = document.querySelector('.audio-player-panel') || 
                           document.querySelector('div[style*="fixed"][style*="bottom"]');
          const playBtn = ttsPanel ? Array.from(ttsPanel.querySelectorAll('button')).find(b => 
            b.textContent.includes('播放') || b.textContent.includes('▶') || b.textContent.toLowerCase().includes('play')
          ) : null;

          if (playBtn) {
            // 💡 1. 記憶原本全域的設定與文字狀態，以便播放完單字後能「無縫還原」
            const originalTtsConfigText = window.ttsConfig ? window.ttsConfig.text : null;
            const originalGlobalText = window.currentTTSText;
            
            // 💡 2. 強行把單字塞進所有 v5.js 可能讀取文字的全域變數與暫存區中
            if (window.ttsConfig) window.ttsConfig.text = wordText;
            window.currentTTSText = wordText;
            
            // 針對有隱藏輸入框的備援注入
            const hiddenInput = document.querySelector('.audio-player-panel textarea') || document.querySelector('#text-input');
            let originalInputValue = '';
            if (hiddenInput) {
              originalInputValue = hiddenInput.value;
              hiddenInput.value = wordText;
              hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            console.log(`${TAG} 已成功將全域核心文字暫時劫持替換為: "${wordText}"，驅動播放按鈕...`);
            
            // 💡 3. 點擊底部的播放按鈕（這時 v5 就會乖乖帶著它的 API Key 去播這個單字！）
            playBtn.click();

            // 💡 4. 防呆還原：0.6 秒後悄悄把原本的文章塞回去，這樣你接下來按底部播放時，依然是原本的文章！
            setTimeout(() => {
              if (window.ttsConfig && originalTtsConfigText !== null) window.ttsConfig.text = originalTtsConfigText;
              if (originalGlobalText !== undefined) window.currentTTSText = originalGlobalText;
              if (hiddenInput) {
                hiddenInput.value = originalInputValue;
                hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
              console.log(`${TAG} 全域文章內容已安全還原，不影響原本文章朗讀。`);
            }, 600);

          } else {
            console.error(`${TAG} 錯誤：找不到底部的 TTS 播放面板按鈕。`);
          }
        }
      });

      console.log(`${TAG} WORD NOTE 按鈕已升級為全域文字劫持注入版！`);
    }
  }, 400);
})();
