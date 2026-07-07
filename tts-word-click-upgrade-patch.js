/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (精準按鈕覆寫版) */
(function() {
  const TAG = '[TTS Word Upgrade]';

  // 定時監控畫面上是否有彈出 WORD NOTE 視窗
  setInterval(() => {
    // 1. 抓取 WORD NOTE 視窗內部的「🔊 發音」按鈕
    // 依據畫面上顯示的按鈕文字「發音」來捕捉
    const btnList = Array.from(document.querySelectorAll('button'));
    const speakBtn = btnList.find(btn => btn.textContent.includes('發音'));

    if (speakBtn && !speakBtn.dataset.isUpgraded) {
      // 標記這個按鈕已經被我們改造過，避免重複綁定
      speakBtn.dataset.isUpgraded = 'true';
      
      // 改掉按鈕的外觀，讓你一眼看出它成功升級了
      speakBtn.innerHTML = '🔊 TTS 真人發音';
      speakBtn.style.setProperty('background', '#9b59b6', 'important'); // 變成質感紫色
      speakBtn.style.setProperty('color', '#ffffff', 'important');

      // 2. 複製一個全新的按鈕來徹底「清除」舊代碼綁定的所有 Click 事件
      const newSpeakBtn = speakBtn.cloneNode(true);
      speakBtn.parentNode.replaceChild(newSpeakBtn, speakBtn);

      // 3. 綁定我們全新的 Google Cloud TTS 播放邏輯
      newSpeakBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 嘗試抓取當前 WORD NOTE 視窗中顯示的單字文字
        // 依照結構抓取視窗內最大的標題文字 (h2 或 strong 或 class 包含 word-title 的元素)
        let wordText = '';
        const wordHeader = document.querySelector('.word-note-modal h2') || 
                           document.querySelector('div[style*="fixed"] strong') ||
                           document.querySelector('.word-note-title') ||
                           newSpeakBtn.parentNode.parentNode.querySelector('strong') ||
                           newSpeakBtn.parentNode.parentNode.querySelector('h2');

        if (wordHeader) {
          // 清理掉多餘的符號，只留下乾淨的單字本身
          wordText = wordHeader.textContent.trim().replace(/[^a-zA-Z']/g, '');
        }

        // 如果找不到，就用目前畫面上被選取/點擊次數最多的那個單字備援
        if (!wordText) {
          const boldWord = document.querySelector('.word-note-container b') || document.querySelector('strong');
          if (boldWord) wordText = boldWord.textContent.trim().replace(/[^a-zA-Z']/g, '');
        }

        console.log(`${TAG} 觸發 TTS 真人發音，單字為: "${wordText}"`);

        if (wordText && wordText.length > 0) {
          // 先把原本瀏覽器可能在碎念的機器人聲音強制中斷
          if (window.speechSynthesis) window.speechSynthesis.cancel();

          // 呼叫底部的 Google TTS 引擎發音
          if (typeof window.playTextViaGoogleTTS === 'function') {
            window.playTextViaGoogleTTS(wordText);
          } else if (window.ttsAudioPlayer && typeof window.ttsAudioPlayer.playText === 'function') {
            window.ttsAudioPlayer.playText(wordText);
          } else {
            console.error(`${TAG} 錯誤：找不到 Google Cloud TTS 核心播放引擎`);
          }
        } else {
          console.warn(`${TAG} 警告：抓取不到 WORD NOTE 內的單字文字`);
        }
      });

      console.log(`${TAG} 成功將 WORD NOTE 的發音按鈕升級為 Google Cloud TTS！`);
    }
  }, 400); // 每 0.4 秒檢查一次有沒有新跳出視窗
})();
