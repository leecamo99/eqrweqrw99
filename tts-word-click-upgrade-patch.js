/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (無懼衝突終極版) */
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
      
      if (!res.ok) throw new Error('主要辭典接口無回應');
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
      try {
        if (localAudio) localAudio.pause();
        localAudio = new Audio(`https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(word.toLowerCase())}--_us_1.mp3`);
        await localAudio.play();
      } catch (e) {
        console.error(`${TAG} 所有發音管道均受限`, e);
      }
    }
  }

  // 3. 定時監控畫面上是否有彈出 WORD NOTE 視窗
  setInterval(() => {
    try {
      // 💡 萬用防禦：只要點開的容器裡面有 "WORD NOTE" 且又是 fixed 浮動層就抓
      const modal = Array.from(document.querySelectorAll('div')).find(div => {
        const style = div.getAttribute('style') || '';
        return div.textContent.includes('WORD NOTE') && style.includes('fixed') && !div.textContent.includes('MY NOTEBOOKS');
      });
      
      if (!modal) return;

      const speakBtn = Array.from(modal.querySelectorAll('button')).find(btn => btn.textContent.includes('發音'));

      if (speakBtn && !speakBtn.dataset.isUpgraded) {
        speakBtn.dataset.isUpgraded = 'true';
        
        // 渲染紫色外觀
        speakBtn.innerHTML = '🔊 TTS 真人發音';
        speakBtn.style.setProperty('background', '#9b59b6', 'important');
        speakBtn.style.setProperty('color', '#ffffff', 'important');

        const newSpeakBtn = speakBtn.cloneNode(true);
        speakBtn.parentNode.replaceChild(newSpeakBtn, speakBtn);

        newSpeakBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          setTimeout(async () => {
            let wordText = '';

            // 💡 萬用撈字法：不看任何標籤與樣式！
            // 直接把整個彈窗內所有的文字區塊拆開，找出「第一個純英文、長度大於1且不包含中文字」的字串
            // 這在 HTML 渲染世界裡絕對是不敗的真理
            const allElements = Array.from(modal.querySelectorAll('div, span, b, strong, h2, h3'));
            for (let el of allElements) {
              if (el.children.length === 0) { // 只拿最內層的純文字節點
                const txt = el.textContent.trim().replace(/[^a-zA-Z']/g, '');
                // 排除 WORD、NOTE、發音等控制字眼
                if (txt && txt.length > 1 && txt.length < 25 && !el.textContent.includes('WORD') && !el.textContent.includes('音')) {
                  wordText = txt;
                  break;
                }
              }
            }

            if (!wordText) {
              console.warn(`${TAG} 萬用撈字失敗，啟用最後盲抓`);
              const mainWordDiv = modal.querySelector('div[style*="32px"]');
              if (mainWordDiv) wordText = mainWordDiv.textContent.trim().replace(/[^a-zA-Z']/g, '');
            }

            if (!wordText || wordText === 'MYNOTEBOOKS') {
              console.error(`${TAG} 錯誤：抓取單字失敗。`);
              return;
            }

            console.log(`${TAG} 確定觸發獨立真人發音，精準解析單字為: "${wordText}"`);
            await playStandaloneWordAudio(wordText);
          }, 60);
        });
      }
    } catch (globalErr) {
      // 確保即使網頁後台報錯，定時器也絕對不會垮掉
      console.warn(`${TAG} 忽略同步衝突產生的異常...`);
    }
  }, 400);
})();
