/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (終極純淨單字真人版) */
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

  // 3. 播放獨立真人音訊的專用核心 (100% 獨立不借用 v5)
  async function playStandaloneWordAudio(word) {
    try {
      console.log(`${TAG} 正在嘗試從公開辭典接口抓取 "${word}" 的真人美式發音...`);
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      const data = await res.json();
      
      // 優先抓取美音 (-us.mp3)
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
      console.error(`${TAG} 備援接口啟動，改用 Oxford 直連網址:`, err);
      if (localAudio) localAudio.pause();
      localAudio = new Audio(`https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(word.toLowerCase())}--_us_1.mp3`);
      localAudio.play().catch(e => console.error(`${TAG} 所有發音管道均受限`, e));
    }
  }

  // 4. 定時監控畫面上是否有彈出 WORD NOTE 視窗
  setInterval(() => {
    const modal = document.querySelector('.word-note-modal') || document.querySelector('div[style*="fixed"]');
    if (!modal) return;

    const btnList = Array.from(modal.querySelectorAll('button'));
    const speakBtn = btnList.find(btn => btn.textContent.includes('發音'));

    if (speakBtn && !speakBtn.dataset.isUpgraded) {
      speakBtn.dataset.isUpgraded = 'true';
      
      // 保持最具質感的紫色外觀
      speakBtn.innerHTML = '🔊 TTS 真人發音';
      speakBtn.style.setProperty('background', '#9b59b6', 'important');
      speakBtn.style.setProperty('color', '#ffffff', 'important');

      // 複製新按鈕以徹底清除舊事件，保證不誤觸、不重複
      const newSpeakBtn = speakBtn.cloneNode(true);
      speakBtn.parentNode.replaceChild(newSpeakBtn, speakBtn);

      // 綁定完全獨立的發音邏輯
      newSpeakBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        let wordText = lastClickedWord;

        // 備援方案：如果沒點到字（例如直接用其他方式開彈窗），從彈窗內抓標題
        if (!wordText) {
          const boldWord = modal.querySelector('strong, b, h2');
          if (boldWord) wordText = boldWord.textContent.trim().replace(/[^a-zA-Z']/g, '');
        }

        if (!wordText) return;
        console.log(`${TAG} 確定觸發 standalone 真人發音，單字: "${wordText}"`);

        // 直接調用獨立播放，不碰 v5 面板、不碰文章、不需要輸入任何 Key
        await playStandaloneWordAudio(wordText);
      });
    }
  }, 400);
})();
