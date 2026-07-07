/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (API 金鑰共享自主播放版) */
(function() {
  const TAG = '[TTS Word Upgrade]';
  let lastClickedWord = ''; 
  let localAudio = null; // 我們自己獨立的播放器，不跟文章打架

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
      newSpeakBtn.addEventListener('click', async (e) => {
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

          // 💡 獲取網頁上現有的金鑰設定與語音設定
          const apiKey = localStorage.getItem('google_tts_api_key') || (window.ttsConfig && window.ttsConfig.apiKey);
          
          // 嘗試抓取底部 v5 目前選用的語音與語速，如果抓不到就用高品質預設值
          const voiceSelect = document.querySelector('.audio-player-panel select');
          const voiceName = voiceSelect ? voiceSelect.value : 'en-US-Chirp3-HD-Aoede';
          
          if (!apiKey) {
            console.error(`${TAG} 錯誤：找不到 Google Cloud TTS API Key，請先點擊底部面板的 [Key] 按鈕輸入。`);
            alert('請先點擊底部 TTS 面板的 [Key] 按鈕輸入您的 Google Cloud API Key 才能啟用真人發音。');
            return;
          }

          try {
            speakBtn.innerHTML = '⏳ 載入中...';
            
            // 💡 直接對 Google Cloud TTS API 發出單字請求
            const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: { text: wordText },
                voice: { languageCode: 'en-US', name: voiceName },
                audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 }
              })
            });

            const data = await response.json();
            if (data.audioContent) {
              // 建立獨立音訊，絕不影響底部的文章播放狀態
              if (localAudio) localAudio.pause();
              localAudio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
              localAudio.play();
              console.log(`${TAG} 真人單字音訊播放成功！`);
            } else {
              console.error(`${TAG} API 回傳錯誤:`, data);
            }
          } catch (err) {
            console.error(`${TAG} 請求失敗:`, err);
          } finally {
            newSpeakBtn.innerHTML = '🔊 TTS 真人發音';
          }
        }
      });

      console.log(`${TAG} WORD NOTE 按鈕已升級為獨立 API 金鑰共享版！`);
    }
  }, 400);
})();
