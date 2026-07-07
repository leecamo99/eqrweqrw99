/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (獨立 Key 儲存版) */
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
    const modal = document.querySelector('.word-note-modal') || document.querySelector('div[style*="fixed"]');
    if (!modal) return;

    // A. 處理發音按鈕
    const btnList = Array.from(modal.querySelectorAll('button'));
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

      // 建立獨立的 [Key] 按鈕並掛在發音按鈕旁邊
      if (!modal.querySelector('.tts-word-key-btn')) {
        const keyBtn = document.createElement('button');
        keyBtn.className = 'tts-word-key-btn';
        keyBtn.innerHTML = '🔑 Key';
        keyBtn.style.cssText = 'background: #34495e !important; color: white !important; margin-left: 8px; padding: 4px 8px; border-radius: 4px; border: none; font-size: 12px; cursor: pointer;';
        
        // 點擊 [Key] 按鈕輸入密鑰
        keyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const savedKey = localStorage.getItem('standalone_word_tts_key') || '';
          const userKey = prompt('請輸入您的 Google Cloud API Key (單字獨立發音專用):', savedKey);
          if (userKey !== null) {
            localStorage.setItem('standalone_word_tts_key', userKey.trim());
            alert('金鑰已成功記憶！之後不用再輸入了。');
          }
        });
        newSpeakBtn.parentNode.appendChild(keyBtn);
      }

      // 綁定專屬的 Google Cloud TTS 播放邏輯
      newSpeakBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        let wordText = lastClickedWord;

        if (!wordText) {
          const boldWord = modal.querySelector('strong, b, h2');
          if (boldWord) wordText = boldWord.textContent.trim().replace(/[^a-zA-Z']/g, '');
        }

        if (!wordText) return;
        console.log(`${TAG} 確定觸發 TTS 真人發音，送出單字: "${wordText}"`);

        // 💡 讀取我們自己專屬按鈕存下來的 Key
        const apiKey = localStorage.getItem('standalone_word_tts_key');
        
        // 嘗試抓取底部選單選用的語音，抓不到就用預設高品質語音
        const voiceSelect = document.querySelector('.audio-player-panel select');
        const voiceName = voiceSelect ? voiceSelect.value : 'en-US-Chirp3-HD-Aoede';

        if (!apiKey) {
          console.warn(`${TAG} 錯誤：找不到獨立儲存的 API Key`);
          alert('請先點擊旁邊的 🔑 Key 按鈕輸入您的 Google Cloud API Key！');
          return;
        }

        try {
          newSpeakBtn.innerHTML = '⏳ 載入中...';
          
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
            await localAudio.play();
            console.log(`${TAG} 🎉 獨立驅動：真人單字發音成功！`);
          } else {
            throw new Error(data.error?.message || 'API 請求失敗');
          }
        } catch (err) {
          console.error(`${TAG} Google Cloud TTS 請求失敗:`, err);
          alert('發音請求失敗，請檢查 Key 是否正確或是否有額度。');
        } finally {
          newSpeakBtn.innerHTML = '🔊 TTS 真人發音';
        }
      });
    }
  }, 400);
})();
