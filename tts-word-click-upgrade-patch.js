/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (v5 面板事件觸發版) */
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
      
      // 換上漂亮的紫色外觀
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

        // 備援方案：如果沒記到，從彈窗內抓取
        if (!wordText) {
          const modal = newSpeakBtn.closest('div[style*="fixed"]') || document.body;
          const boldWord = modal.querySelector('strong, b, h2');
          if (boldWord) wordText = boldWord.textContent.trim().replace(/[^a-zA-Z']/g, '');
        }

        console.log(`${TAG} 確定觸發 TTS 真人發音，送出單字: "${wordText}"`);

        if (wordText && wordText.length > 0) {
          if (window.speechSynthesis) window.speechSynthesis.cancel();

          // 💡 嘗試直接調用全域 API 函式
          if (typeof window.playTextViaGoogleTTS === 'function') {
            window.playTextViaGoogleTTS(wordText);
          } else if (typeof window.speakText === 'function') {
            window.speakText(wordText);
          } else if (typeof window.playText === 'function') {
            window.playText(wordText);
          } else if (window.ttsAudioPlayer && typeof window.ttsAudioPlayer.playText === 'function') {
            window.ttsAudioPlayer.playText(wordText);
          } else {
            // 💡 終極按鈕觸發核心：直接利用網頁上既有的播放機制來出聲！
            // 尋找你底部的 v5 播放面板中的「播放」按鈕
            const ttsPanel = document.querySelector('.audio-player-panel') || 
                             document.querySelector('div[style*="fixed"][style*="bottom"]');
            
            // 尋找面板內的播放按鈕 (可能包含 播放、▶、Play 等關鍵字)
            const playBtn = ttsPanel ? Array.from(ttsPanel.querySelectorAll('button')).find(b => 
              b.textContent.includes('播放') || b.textContent.includes('▶') || b.textContent.toLowerCase().includes('play')
            ) : null;

            if (playBtn) {
              console.log(`${TAG} 成功調用 v5 面板按鈕發音機制`);
              
              // 如果 v5 腳本有暴露特定的單字臨時變數或全域文字緩衝區，我們直接餵給它
              if (window.ttsConfig) window.ttsConfig.text = wordText;
              if (window.currentTTSText !== undefined) window.currentTTSText = wordText;
              
              // 直接觸發底部的播放按鈕點擊
              playBtn.click();
            } else {
              console.error(`${TAG} 錯誤：找不到任何可用的 Google Cloud TTS 播放函式或面板按鈕。`);
            }
          }
        }
      });

      console.log(`${TAG} WORD NOTE 按鈕已成功適配 v5 核心引擎！`);
    }
  }, 400);
})();
