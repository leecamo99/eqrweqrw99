/* Google Cloud TTS Reader Patch V6: 純 JS 三段縮放控制器 (修復版) */
(function() {
  let currentMode = 1; // 1: 展開, 2: 迷你, 3: 收合
  let ttsPanel = null;
  let toggleBtn = null;
  let originalStyles = { height: '', padding: '', display: '', background: '' };

  // 強力輪詢：確保抓到面板，且 v7 已經把播放器界面畫好了
  const checkTTS = setInterval(() => {
    const panel = document.querySelector('.audio-player-panel') || 
                  document.querySelector('[class*="tts-panel"]') || 
                  document.querySelector('[id*="tts"]');
    
    if (panel && panel.children.length > 0) {
      clearInterval(checkTTS);
      ttsPanel = panel;
      
      // 紀錄最原始的 CSS 樣式
      originalStyles.height = ttsPanel.style.height || '160px';
      originalStyles.padding = ttsPanel.style.padding;
      originalStyles.display = ttsPanel.style.display;
      originalStyles.background = ttsPanel.style.background;

      // 強制基本定位在螢幕最下方
      ttsPanel.style.position = 'fixed';
      ttsPanel.style.bottom = '0';
      ttsPanel.style.left = '0';
      ttsPanel.style.width = '100%';
      ttsPanel.style.zIndex = '99999';
      ttsPanel.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
      ttsPanel.style.overflow = 'hidden';

      initV6Controller();
    }
  }, 300);

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
      ttsPanel.style.height = '160px';
      ttsPanel.style.padding = '12px 16px';
      ttsPanel.style.display = 'block';
      ttsPanel.style.background = originalStyles.background || 'var(--paper, #ffffff)';
      
      toggleBtn.innerHTML = '➖ 縮小';
      toggleBtn.style.position = 'absolute';
      toggleBtn.style.top = '8px';
      toggleBtn.style.right = '12px';
      toggleBtn.style.width = 'auto';
      toggleBtn.style.height = 'auto';
      toggleBtn.style.background = 'var(--accent, #a68a56)';

      // 💡 強制將所有元件的 display 喚醒還原為 block 或 flex
      children.forEach(el => {
        if (el === toggleBtn) return;
        if (el.tagName === 'DIV' || el.classList.contains('controls-row')) {
          el.style.setProperty('display', 'flex', 'important');
        } else {
          el.style.setProperty('display', 'inline-block', 'important');
        }
      });

    } else if (currentMode === 2) {
      // 🟡 模式 2：迷你播放器 (52px)
      ttsPanel.style.height = '52px';
      ttsPanel.style.padding = '0 16px';
      ttsPanel.style.display = 'flex';
      ttsPanel.style.alignItems = 'center';
      ttsPanel.style.gap = '12px';
      ttsPanel.style.background = 'var(--paper, #ffffff)';

      toggleBtn.innerHTML = '⚏ 迷你';
      toggleBtn.style.position = 'absolute';
      toggleBtn.style.top = '10px';
      toggleBtn.style.right = '12px';
      toggleBtn.style.width = 'auto';
      toggleBtn.style.height = 'auto';

      children.forEach(el => {
        if (el === toggleBtn) return;
        // 隱藏下拉選單與雜項
        if (el.tagName === 'SELECT' || el.tagName === 'BR' || el.tagName === 'H3' || el.tagName === 'TEXTAREA' || el.classList.contains('voice-select') || el.classList.contains('speed-control')) {
          el.style.setProperty('display', 'none', 'important');
        } else {
          // 留下的播放核心排成一橫列
          el.style.setProperty('display', 'flex', 'important');
          el.style.setProperty('align-items', 'center', 'important');
          el.style.setProperty('margin', '0', 'important');
        }
      });

    } else if (currentMode === 3) {
      // 🔴 模式 3：收合 (32px)
      ttsPanel.style.height = '32px';
      ttsPanel.style.padding = '0';
      ttsPanel.style.display = 'flex';
      ttsPanel.style.alignItems = 'center';
      ttsPanel.style.justifyContent = 'center';
      ttsPanel.style.background = 'var(--primary, #34495e)';

      // 隱藏除了切換鈕以外的所有東西
      children.forEach(el => {
        if (el !== toggleBtn) el.style.setProperty('display', 'none', 'important');
      });

      // 讓按鈕鋪滿變長條狀態，變成一整條都可以點擊
      toggleBtn.innerHTML = '🎧 TTS (點擊展開)';
      toggleBtn.style.position = 'static';
      toggleBtn.style.width = '100%';
      toggleBtn.style.height = '100%';
      toggleBtn.style.background = 'transparent';
    }
  }
})();
