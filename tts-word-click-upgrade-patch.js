/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (完美備援音訊版) */
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

  // 播放備援音訊的專用函式 (採用開放的 Free Dictionary API)
  async function playFallbackAudio(word) {
    try {
      console.log(`${TAG} 正在嘗試從公開辭典接口抓取 "${word}" 的真人美式發音...`);
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      const data = await res.json();
      
      // 尋找回傳資料中帶有 mp3 網址的發音節點 (優先抓美音 -us)
      let audioUrl = '';
      if (Array.isArray(data) && data[0]?.phonetics) {
        const usPhonetic = data[0].phonetics.find(p => p.audio && p.audio.includes('-us.mp3'));
        const anyPhonetic = data[0].phonetics.find(p => p.audio && p.audio.length > 0);
        audioUrl = usPhonetic ? usPhonetic.audio : (anyPhonetic ? anyPhonetic.audio : '');
      }

      if (audioUrl) {
        if (localAudio) localAudio.pause();
        localAudio = new Audio(audioUrl);
        await localAudio.play();
        console.log(`${TAG} 🎉 成功播放公開辭典真人發音！`);
      } else {
        throw new Error('未找到可用 MP3');
      }
    } catch (err) {
      console.error(`${TAG} 備援接口也失敗，啟用極限網址直接播放:`, err);
      // 終極保險：直接使用另一個開放的字典音訊網址
      if (localAudio) localAudio.pause();
      localAudio = new Audio(`https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(word.toLowerCase())}--_us_1.mp3`);
      localAudio.play().catch(e => console.error(`${TAG} 所有發音管道均受限`, e));
    }
  }

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

        if (!wordText) {
          const modal = newSpeakBtn.closest('div[style*="fixed"]') || document.body;
          const boldWord = modal.querySelector('strong, b, h2');
          if (boldWord) wordText = boldWord.textContent.trim().replace(/[^a-zA-Z']/g, '');
        }

        if (!wordText) return;
        console.log(`${TAG} 確定觸發 TTS 真人發音，送出單字: "${wordText}"`);

        // 💡 嘗試從本地獲取 Key
        const apiKey = localStorage.getItem('google_tts_api_key') || localStorage.getItem('tts_api_key');
        const voiceSelect = document.querySelector('.audio-player-panel select');
        const voiceName = voiceSelect ? voiceSelect.value : 'en-US-Chirp3-HD-Aoede';

        if (!apiKey) {
          console.warn(`${TAG} 錯誤：找不到 API Key，啟動相容性最好的公開辭典真人接口！`);
          await playFallbackAudio(wordText);
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
            throw new Error('API Key 可能失效或回傳錯誤');
          }
        } catch (err) {
          console.error(`${TAG} Google Cloud TTS 請求失敗，切換至公開辭典接口:`, err);
          await playFallbackAudio(wordText);
        } finally {
          newSpeakBtn.innerHTML = '🔊 TTS 真人發音';
        }
      });

      console.log(`${TAG} WORD NOTE 按鈕已更新為完美備援音訊版！`);
    }
  }, 400);
})();
