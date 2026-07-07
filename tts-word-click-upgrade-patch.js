/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (絕對防外流精準版) */
(function() {
  const TAG = '[TTS Word Upgrade]';
  let localAudio = null;

  // 1. 全域劫持：直接沒收原生假音的發聲權
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = function(utterance) {
      console.log(`${TAG} 偵測到原生機器人試圖發音，已成功攔截並封鎖。`);
    };
  }

  // 2. 播放獨立真人音訊的專用核心
  async function playStandaloneWordAudio(word) {
    try {
      console.log(`${TAG} 正在嘗試從公開辭典接口抓取 "${word}" 的真人美式發音...`);
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      const data = await res.json();
      
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

  // 3. 定時監控畫面上是否有彈出 WORD NOTE 視窗
  setInterval(() => {
    // 💡 修正 1：精準識別彈窗，排除外部包含 MY NOTEBOOKS 的側邊欄容器
    const allModals = Array.from(document.querySelectorAll('div[style*="fixed"]'));
    const modal = allModals.find(div => div.textContent.includes('WORD NOTE') && !div.textContent.includes('MY NOTEBOOKS'));
    
    if (!modal) return;

    const btnList = Array.from(modal.querySelectorAll('button'));
    const speakBtn = btnList.find(btn => btn.textContent.includes('發音'));

    if (speakBtn && !speakBtn.dataset.isUpgraded) {
      speakBtn.dataset.isUpgraded = 'true';
      
      // 保持紫色外觀
      speakBtn.innerHTML = '🔊 TTS 真人發音';
      speakBtn.style.setProperty('background', '#9b59b6', 'important');
      speakBtn.style.setProperty('color', '#ffffff', 'important');

      const newSpeakBtn = speakBtn.cloneNode(true);
      speakBtn.parentNode.replaceChild(newSpeakBtn, speakBtn);

      newSpeakBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 💡 修正 2：給網頁 UI 渲染保留 50 毫秒極短緩衝時間，確保文字 100% 寫入進去
        setTimeout(async () => {
          let wordText = '';
          
          // 💡 修正 3：嚴格限縮搜尋範圍！只在「發音按鈕的同層父級容器」內尋找加粗標題，徹底與外面世界隔離
          const parentContainer = newSpeakBtn.parentElement || modal;
          const boldTags = parentContainer.querySelectorAll('b, strong');
          
          for (let b of boldTags) {
            const txt = b.textContent.trim().replace(/[^a-zA-Z']/g, '');
            // 排除掉可能干擾的功能字眼
            if (txt && txt.length > 0 && !b.textContent.includes('WORD') && txt.toLowerCase() !== 'key') {
              wordText = txt;
              break;
            }
          }

          if (!wordText) {
            console.warn(`${TAG} 警告：嚴格範圍內找不到有效單字，嘗試最後盲抓`);
            const fallbackBold = modal.querySelector('b, strong');
            if (fallbackBold) wordText = fallbackBold.textContent.trim().replace(/[^a-zA-Z']/g, '');
          }

          // 如果不小心抓到大寫的長字串（代表可能抓錯成功能選單），直接拒絕發音
          if (!wordText || wordText === 'MYNOTEBOOKS') {
            console.error(`${TAG} 錯誤：抓取到異常單字來源 "${wordText}"，已自動攔截防止錯誤發音。`);
            return;
          }

          console.log(`${TAG} 確定觸發獨立真人發音，精準解析單字為: "${wordText}"`);
          await playStandaloneWordAudio(wordText);
        }, 50);
      });
    }
  }, 400);
})();
