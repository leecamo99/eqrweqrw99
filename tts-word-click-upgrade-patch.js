/* Google Cloud TTS: 單字發音按鈕全面真人升級補丁 (精準 DOM 定位版) */
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
    // 💡 精準鎖定：只抓取真正的 WORD NOTE 彈窗容器
    const modal = Array.from(document.querySelectorAll('div')).find(div => {
      return div.textContent.includes('WORD NOTE') && div.style.position === 'fixed';
    });
    
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

      newSpeakBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 💡 終極精準抓字：直接去 WORD NOTE 內文裡找第一個出現的加粗單字
        // 排除掉包含 "WORD NOTE"、"原形" 等中文字的行，只拿純英文字
        let wordText = '';
        const boldTags = modal.querySelectorAll('b, strong');
        for (let b of boldTags) {
          const txt = b.textContent.trim().replace(/[^a-zA-Z']/g, '');
          if (txt && txt.length > 0 && !b.textContent.includes('WORD') && b.textContent.toLowerCase() !== 'key') {
            wordText = txt;
            break;
          }
        }

        if (!wordText) {
          console.warn(`${TAG} 警告：在彈窗內找不到任何有效單字。`);
          return;
        }

        console.log(`${TAG} 確定觸發獨立真人發音，精準解析單字為: "${wordText}"`);
        await playStandaloneWordAudio(wordText);
      });
    }
  }, 400);
})();
