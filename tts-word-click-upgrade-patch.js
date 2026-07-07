/* Google Cloud TTS: 單字點擊發音全面真人口音升級補丁 */
(function() {
  const TAG = '[TTS Word Upgrade]';

  // 1. 核心發音劫持函式
  function upgradeWordSpeech() {
    // 劫持可能存在的舊全域發音函式（防建置衝突）
    if (typeof window.speakWord === 'function' && !window.speakWord.isUpgraded) {
      const originalSpeakWord = window.speakWord;
      window.speakWord = function(word) {
        if (!word) return;
        console.log(`${TAG} 攔截到單字點擊: "${word}"，準備調用 Google Cloud TTS...`);
        
        // 嘗試調用 v5/v7 補丁中建立的高級播放方法
        if (typeof window.playTextViaGoogleTTS === 'function') {
          window.playTextViaGoogleTTS(word);
        } else if (window.ttsAudioPlayer && typeof window.ttsAudioPlayer.playText === 'function') {
          window.ttsAudioPlayer.playText(word);
        } else {
          // 備援方案：如果面板還沒準備好，就退回原生的方式
          console.warn(`${TAG} 找不到 Google TTS 播放核心，使用原方案備援`);
          originalSpeakWord(word);
        }
      };
      window.speakWord.isUpgraded = true;
      console.log(`${TAG} 成功劫持全域 speakWord 函式！`);
    }

    // 2. 針對畫面上所有單字（.word, .lemma-word 等）點擊事件進行深層監聽
    document.body.addEventListener('click', function(e) {
      // 判斷點擊的是否為單字元素（依據你專案的 class，通常點擊單字會發音）
      const target = e.target;
      if (target && (target.classList.contains('word') || target.hasAttribute('data-word') || target.tagName === 'SPAN' && target.style.cursor === 'pointer')) {
        const wordText = target.getAttribute('data-word') || target.textContent.trim().replace(/[^a-zA-Z']/g, '');
        
        // 如果這個元素點擊本來就會發音，且我們成功拿到了乾淨的單字
        if (wordText && wordText.length > 0 && window.playTextViaGoogleTTS) {
          // 阻止原生可能觸發的 web speech API
          if (window.speechSynthesis) window.speechSynthesis.cancel(); 
          
          e.stopPropagation();
          console.log(`${TAG} 點擊單字元素發音: ${wordText}`);
          window.playTextViaGoogleTTS(wordText);
        }
      }
    }, true); // 使用 Capture 階段提早攔截
  }

  // 2. 輪詢確保語音核心與單字元件都加載完成
  const initTimer = setInterval(() => {
    if (window.playTextViaGoogleTTS || (window.ttsAudioPlayer && window.ttsAudioPlayer.playText)) {
      clearInterval(initTimer);
      upgradeWordSpeech();
      console.log(`%c ${TAG} 單字發音已成功與 Google Cloud TTS 引擎連線！`, 'color: #9b59b6; font-weight: bold;');
    }
  }, 300);
})();