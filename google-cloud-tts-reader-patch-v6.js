/* Google Cloud TTS Reader Patch V6: 純 JS 三段縮放控制器 (自動延遲偵測版) */
(function() {
  let currentMode = 1; // 1: 展開, 2: 迷你, 3: 收合
  let ttsPanel = null;
  let toggleBtn = null;
  let originalStyles = { height: '', padding: '', display: '', background: '' };
  
  let attempts = 0;
  const maxAttempts = 30; // 最多連續尋找 15 秒，確保面板一定出生了

  const checkTTS = setInterval(() => {
    attempts++;
    
    // 配合當前畫面的多重精準特徵搜尋
    let panel = document.querySelector('.audio-player-panel') || 
                document.querySelector('[class*="tts-panel"]') ||
                document.querySelector('div[style*="fixed"][style*="bottom"]');

    // 如果沒抓到，改用語音面板特有的文字特徵深層搜索
    if (!panel) {
      panel = Array.from(document.querySelectorAll('div')).find(el => {
        const text = el.textContent || '';
        return text.includes('Google Cloud TTS') && (el.style.position === 'fixed' || window.getComputedStyle(el).position === 'fixed');
      });
    }

    // 找到了，且面板內部已經有按鈕元素渲染進去了
    if (panel && panel.children.length > 0) {
      clearInterval(checkTTS);
      ttsPanel = panel;
      
      // 紀錄最原始的 CSS 樣式
      originalStyles.height = ttsPanel.style.height || '160px';
      originalStyles.padding = ttsPanel.style.padding;
      originalStyles.display = ttsPanel.style.display || 'block';
      originalStyles.background = ttsPanel.style.background;

      // 強制將面板基本樣式固定在最底部
      ttsPanel.style.position = 'fixed';
      ttsPanel.style.bottom = '0';
      ttsPanel.style.left = '0';
      ttsPanel.style.width = '100%';
      ttsPanel.style.zIndex = '99999';
      ttsPanel.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
      ttsPanel.style.overflow = 'hidden';

      initV6Controller();
      console.log('%c [TTS V6] 成功在第 ' + attempts + ' 次嘗試抓取到語音面板並完美接管！', 'color: #28a745; font-weight: bold;');
      return;
    }

    // 超時防呆
    if (attempts >= maxAttempts) {
      clearInterval(checkTTS);
      console.warn('%c [TTS V6] 尋找語音面板超時，請確認面板是否有正常渲染在最下方。', 'color: #ffc107;');
    }
  }, 500); // 每 0.5 秒搜捕一次

  function initV6Controller() {
    // 1. 建立控制按鈕 [-]
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'tts-v6-toggle-btn';
    toggleBtn.style.cssText = `
      position: absolute !important;
      top: 8px !important;
      right: 12px !important;
      background: var(--accent, #a68a56) !important;
      color: white !important;
      border: none !important;
      padding: 6px 12px !important;
      border-radius: 4px !important;
      font-size: 14px !important;
      cursor: pointer !important;
      z-index: 100005 !important;
    `;
    toggleBtn.innerHTML = '➖ 縮小';
    ttsPanel.appendChild(toggleBtn);

    // 2. 綁定循環點擊事件
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      currentMode = currentMode === 3 ? 1 : currentMode + 1;
      applyModeLayout();
    });

    applyModeLayout();
  }

  function applyModeLayout() {
    const children = Array.from(ttsPanel.children);

    if (currentMode === 1) {
      // 🟢 模式 1：展開 (160px)
      ttsPanel.style.setProperty('height', '160px', 'important');
      ttsPanel.style.setProperty('padding', '12px 16px', 'important');
      ttsPanel.style.setProperty('display', 'block', 'important');
      
      toggleBtn.innerHTML = '➖ 縮小';
      toggleBtn.style.cssText = `
        position: absolute !important; top: 8px !important; right: 12px !important;
        background: var(--accent, #a68a56) !important; color: white !important;
        border: none !important; padding: 6px 12px !important; border-radius: 4px !important;
        font-size: 14px !important; cursor: pointer !important; z-index: 100005 !important;
        width: auto !important; height: auto !important;
      `;

      // 強制讓所有子元素醒過來
      children.forEach(el => {
        if (el === toggleBtn) return;
        el.style.setProperty('display', '', ''); 
      });

    } else if (currentMode === 2) {
      // 🟡 模式 2：迷你播放器 (52px)
      ttsPanel.style.setProperty('height', '52px', 'important');
      ttsPanel.style.setProperty('padding', '0 16px', 'important');
      ttsPanel.style.setProperty('display', 'flex', 'important');
      ttsPanel.style.setProperty('align-items', 'center', 'important');
      ttsPanel.style.setProperty('gap', '12px', 'important');

      toggleBtn.innerHTML = '⚏ 迷你';
      toggleBtn.style.cssText = `
        position: absolute !important; top: 10px !important; right: 12px !important;
        background: var(--accent, #a68a56) !important; color: white !important;
        border: none !important; padding: 6px 12px !important; border-radius: 4px !important;
        font-size: 14px !important; cursor: pointer !important; z-index: 100005 !important;
        width: auto !important; height: auto !important;
      `;

      children.forEach(el => {
        if (el === toggleBtn) return;
        // 隱藏下拉選單與非必要純文字，只留下播放、暫停與進度條
        if (['SELECT', 'BR', 'SPAN'].includes(el.tagName) || el.textContent.includes('Google Cloud') || el.textContent.includes('待命') || el.style.position === 'absolute') {
          el.style.setProperty('display', 'none', 'important');
        } else {
          el.style.setProperty('display', 'flex', 'important');
          el.style.setProperty('align-items', 'center', 'important');
          el.style.setProperty('margin', '0', 'important');
        }
      });

    } else if (currentMode === 3) {
      // 🔴 模式 3：收合 (32px)
      ttsPanel.style.setProperty('height', '32px', 'important');
      ttsPanel.style.setProperty('padding', '0', 'important');
      ttsPanel.style.setProperty('display', 'flex', 'important');
      ttsPanel.style.setProperty('align-items', 'center', 'important');
      ttsPanel.style.setProperty('justify-content', 'center', 'important');
      ttsPanel.style.setProperty('background', '#34495e', 'important');

      // 隱藏除了切換鈕以外的所有東西
      children.forEach(el => {
        if (el !== toggleBtn) el.style.setProperty('display', 'none', 'important');
      });

      // 讓按鈕變大鋪滿整條橫槓
      toggleBtn.innerHTML = '🎧 TTS (點擊展開)';
      toggleBtn.style.cssText = `
        position: static !important; width: 100% !important; height: 100% !important;
        background: transparent !important; color: white !important; border: none !important;
        font-size: 14px !important; cursor: pointer !important;
      `;
    }
  }
})();
