/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (精準 DIV 定位版) */
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
    // 精準抓取 WORD NOTE 彈窗
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

        // 保留微小渲染緩衝
        setTimeout(async () => {
          let wordText = '';
          
          // 💡 終極修正：直接尋找彈窗內字體大小為 32px 且加粗的那個主要單字 Div！
          const wordDiv = Array.from(modal.querySelectorAll('div')).find(div => {
            const style = div.getAttribute('style') || '';
            return style.includes('32px') && (style.includes('bold') || div.style.fontWeight === 'bold');
          });

          if (wordDiv) {
            wordText = wordDiv.textContent.trim().replace(/[^a-zA-Z']/g, '');
          }

          // 備援：萬一格式變了，找發音按鈕上面的第一個非功能性英文單字
          if (!wordText) {
            const allDivs = Array.from(modal.querySelectorAll('div'));
            for (let d of allDivs) {
              const txt = d.textContent.trim().replace(/[^a-zA-Z']/g, '');
              if (txt && txt.length > 0 && txt.length < 25 && !d.textContent.includes('WORD') && !d.textContent.includes('形')) {
                wordText = txt;
                break;
              }
            }
          }

          if (!wordText || wordText === 'MYNOTEBOOKS') {
            console.error(`${TAG} 錯誤：抓取單字失敗或抓到錯誤標題。`);
            return;
          }

          console.log(`${TAG} 確定觸發獨立真人發音，精準解析單字為: "${wordText}"`);
          await playStandaloneWordAudio(wordText);
        }, 50);
      });
    }
  }, 400);
})();
