/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (終極音訊隔離版) */
(function() {
  const TAG = '[TTS Word Upgrade]';

  // 1. 全域劫持：直接閹割掉原生假音的發聲核心，不准它發出任何聲音
  if (window.speechSynthesis) {
    const originalSpeak = window.speechSynthesis.speak;
    window.speechSynthesis.speak = function(utterance) {
      console.log(`${TAG} 偵測到原生機器人試圖發音，已成功攔截並封鎖。`);
      // 故意不執行 originalSpeak，直接沒收它的發音權
    };
  }

  // 2. 定時監控畫面上是否有彈出 WORD NOTE 視窗
  setInterval(() => {
    const btnList = Array.from(document.querySelectorAll('button'));
    const speakBtn = btnList.find(btn => btn.textContent.includes('發音'));

    if (speakBtn && !speakBtn.dataset.isUpgraded) {
      speakBtn.dataset.isUpgraded = 'true';
      
      // 換上醒目的紫色外觀
      speakBtn.innerHTML = '🔊 TTS 真人發音';
      speakBtn.style.setProperty('background', '#9b59b6', 'important');
      speakBtn.style.setProperty('color', '#ffffff', 'important');

      // 複製新按鈕以徹底清除舊代碼上綁定的所有隱藏 Click 事件
      const newSpeakBtn = speakBtn.cloneNode(true);
      speakBtn.parentNode.replaceChild(newSpeakBtn, speakBtn);

      // 綁定專屬的 Google Cloud TTS 播放邏輯
      newSpeakBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 撈取單字標題
        let wordText = '';
        const wordHeader = document.querySelector('.word-note-modal h2') || 
                           document.querySelector('div[style*="fixed"] strong') ||
                           document.querySelector('.word-note-title') ||
                           newSpeakBtn.parentNode.parentNode.querySelector('strong') ||
                           newSpeakBtn.parentNode.parentNode.querySelector('h2');

        if (wordHeader) {
          wordText = wordHeader.textContent.trim().replace(/[^a-zA-Z']/g, '');
        }

        if (!wordText) {
          const boldWord = document.querySelector('.word-note-container b') || document.querySelector('strong');
          if (boldWord) wordText = boldWord.textContent.trim().replace(/[^a-zA-Z']/g, '');
        }

        console.log(`${TAG} 點擊觸發！單字: "${wordText}"`);

        if (wordText && wordText.length > 0) {
          // 強制中斷任何正在播放的原生語音
          if (window.speechSynthesis) window.speechSynthesis.cancel();

          // 精準呼叫 v5 的 Google TTS 高品質發音引擎
          if (typeof window.playTextViaGoogleTTS === 'function') {
            window.playTextViaGoogleTTS(wordText);
          } else if (window.ttsAudioPlayer && typeof window.ttsAudioPlayer.playText === 'function') {
            window.ttsAudioPlayer.playText(wordText);
          } else {
            // 如果面板還沒完全對接好，我們嘗試主動呼叫 v5 內部的核心
            const playBtn = document.querySelector('.audio-player-panel button') || document.querySelector('button[id*="play"]');
            console.error(`${TAG} 錯誤：找不到 Google Cloud TTS 播放函式，請確認底部的語音面板已經載入。`);
          }
        }
      });

      console.log(`${TAG} WORD NOTE 按鈕已與原生 Web API 隔離，成功對接 Google TTS！`);
    }
  }, 400);
})();
