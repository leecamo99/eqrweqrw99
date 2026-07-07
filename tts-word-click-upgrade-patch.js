/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (純淨獨立驅動版) */
(function() {
  const TAG = '[TTS Word Upgrade]';
  let lastClickedWord = ''; 
  let localAudio = null;

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

          // 💡 直接從網頁本地儲存空間撈取當初輸入的 API 金鑰
          const apiKey = localStorage.getItem('google_tts_api_key') || localStorage.getItem('tts_api_key');
          
          // 嘗試抓取底部選單選用的語音，抓不到就用預設高品質語音
          const voiceSelect = document.querySelector('.audio-player-panel select');
          const voiceName = voiceSelect ? voiceSelect.value : 'en-US-Chirp3-HD-Aoede';

          if (!apiKey) {
            console.warn(`${TAG} 錯誤：在 localStorage 中找不到 API Key，啟用免密鑰高清備援接口！`);
            // 💡 備援：如果真的因為作用域拿不到 Key，直接走 Google 官方的高清免費真人接口，保證一定有聲音
            if (localAudio) localAudio.pause();
            localAudio = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(wordText)}`);
            localAudio.play();
            return;
          }

          try {
            newSpeakBtn.innerHTML = '⏳ 載入中...';
            
            // 💡 完全獨立驅動：直接發送請求，不透過 v5
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
              if (localAudio) localAudio.pause();
              localAudio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
              localAudio.play();
              console.log(`${TAG} 🎉 獨立驅動：真人單字發音成功！`);
            } else {
              throw new Error('API 回傳空內容');
            }
          } catch (err) {
            console.error(`${TAG} 獨立請求失敗，切換至免密鑰備援接口:`, err);
            if (localAudio) localAudio.pause();
            localAudio = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(wordText)}`);
            localAudio.play();
          } finally {
            newSpeakBtn.innerHTML = '🔊 TTS 真人發音';
          }
        }
      });

      console.log(`${TAG} WORD NOTE 按鈕已回歸純淨獨立驅動版！`);
    }
  }, 400);
})();
