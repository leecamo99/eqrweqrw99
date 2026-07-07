/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (動態記憶單字版) */
(function() {
  const TAG = '[TTS Word Upgrade]';
  let lastClickedWord = ''; // 用來動態記憶你最後點擊的那個英文字

  // 1. 全域劫持：直接沒收原生假音的發聲權
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = function(utterance) {
      console.log(`${TAG} 偵測到原生機器人試圖發音，已成功攔截並封鎖。`);
    };
  }

  // 2. 監聽整個網頁的點擊：只要你用手指點了任何英文字，我們就把這個字記下來！
  document.addEventListener('click', (e) => {
    const target = e.target;
    // 排除點擊按鈕或功能選單
    if (target.tagName === 'BUTTON' || target.closest('.audio-player-panel')) return;
    
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

        let wordText = lastClickedWord; // 首選：直接用剛剛記下來的點擊單字

        // 備援方案：如果因為各種原因沒記到，再從彈窗內進行 DOM 深度撈取
        if (!wordText) {
          const modal = newSpeakBtn.closest('div[style*="fixed"]') || document.body;
          const allElements = modal.querySelectorAll('h1, h2, h3, strong, b, span, p, div');
          for (let el of allElements) {
            // 如果剛好有元素有 data-word 屬性
            if (el.hasAttribute('data-word')) {
              wordText = el.getAttribute('data-word');
              break;
            }
            const txt = el.textContent.trim().replace(/[^a-zA-Z']/g, '');
            if (txt && txt.length > 0 && !el.textContent.includes('WORD') && !el.textContent.includes('發音') && el.children.length === 0) {
              wordText = txt;
              break;
            }
          }
        }

        console.log(`${TAG} 確定觸發 TTS 真人發音，送出單字: "${wordText}"`);

        if (wordText && wordText.length > 0) {
          if (window.speechSynthesis) window.speechSynthesis.cancel();

          // 精準呼叫 v5 的 Google TTS 高品質發音引擎
          if (typeof window.playTextViaGoogleTTS === 'function') {
            window.playTextViaGoogleTTS(wordText);
          } else if (window.ttsAudioPlayer && typeof window.ttsAudioPlayer.playText === 'function') {
            window.ttsAudioPlayer.playText(wordText);
          } else {
            console.error(`${TAG} 錯誤：找不到 Google Cloud TTS 播放函式，請確認底部的語音面板已經載入。`);
          }
        } else {
          console.warn(`${TAG} 警告：動態與靜態皆無法取得單字文字`);
        }
      });

      console.log(`${TAG} WORD NOTE 按鈕升級成功（已啟用記憶體雙軌抓字技術）！`);
    }
  }, 400);
})();
