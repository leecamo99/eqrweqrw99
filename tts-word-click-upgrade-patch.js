/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (v5 播放核心相容版) */
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

          // 💡 針對 v5 進行精準的多重函式庫轟炸播放
          if (typeof window.playTextViaGoogleTTS === 'function') {
            window.playTextViaGoogleTTS(wordText);
          } else if (typeof window.speakText === 'function') {
            // v5 主程式常見的全域播放函式名稱
            window.speakText(wordText);
          } else if (typeof window.playText === 'function') {
            window.playText(wordText);
          } else if (window.ttsAudioPlayer && typeof window.ttsAudioPlayer.playText === 'function') {
            window.ttsAudioPlayer.playText(wordText);
          } else {
            // 💡 終極暴力備援：如果找不到任何 JS 函式，直接模擬「將單字填入底部的輸入框，並點擊撥放鈕」
            const ttsTextArea = document.querySelector('.audio-player-panel textarea') || document.querySelector('textarea');
            const ttsPlayBtn = document.querySelector('.audio-player-panel button') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('播放') || b.textContent.includes('▶'));
            
            if (ttsTextArea && ttsPlayBtn) {
              console.log(`${TAG} 觸發 v5 介面模擬播放方案`);
              const oldVal = ttsTextArea.value;
              ttsTextArea.value = wordText;
              // 觸發輸入事件確保背後框架有收到
              ttsTextArea.dispatchEvent(new Event('input', { bubbles: true }));
              ttsPlayBtn.click();
              // 播放後悄悄把原本輸入框的文章塞回去，不影響你聽長文章
              setTimeout(() => { ttsTextArea.value = oldVal; ttsTextArea.dispatchEvent(new Event('input', { bubbles: true })); }, 800);
            } else {
              console.error(`${TAG} 錯誤：找不到任何可用的 Google Cloud TTS 播放介面。`);
            }
          }
        }
      });

      console.log(`${TAG} WORD NOTE 按鈕已成功適配 v5 核心引擎！`);
    }
  }, 400);
})();
