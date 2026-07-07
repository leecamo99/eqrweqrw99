/* Google Cloud TTS Reader Patch V6: 純 JS 三段縮放控制器
   - 模式 1：展開 (160px) -> 顯示完整元件
   - 模式 2：迷你 (52px)  -> Spotify Mini Player 橫向排版
   - 模式 3：收合 (32px)  -> 轉為最底部的單行狀態橫槓
*/
(function() {
  let currentMode = 1; // 1: 展開, 2: 迷你, 3: 收合
  let ttsPanel = null;
  let toggleBtn = null;

  // 儲存原本面板的原始樣式，以便在模式 1 還原
  let originalStyles = {
    height: '', padding: '', display: '', background: ''
  };

  // 定時輪詢抓取動態生成的 TTS 面板
  const checkTTS = setInterval(() => {
    ttsPanel = document.querySelector('.audio-player-panel') || 
               document.querySelector('[class*="tts-panel"]') || 
               document.querySelector('[id*="tts"]');

    if (ttsPanel) {
      clearInterval(checkTTS);
      
      // 紀錄最原始的 CSS 樣式
      originalStyles.height = ttsPanel.style.height;
      originalStyles.padding = ttsPanel.style.padding;
      originalStyles.display = ttsPanel.style.display;
      originalStyles.background = ttsPanel.style.background;

      // 強制將面板基本樣式固定在螢幕最底部
      ttsPanel.style.position = 'fixed';
      ttsPanel.style.bottom = '0';
      ttsPanel.style.left = '0';
      ttsPanel.style.width = '100%';
      ttsPanel.style.zIndex = '99999';
      ttsPanel.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
      ttsPanel.style.overflow = 'hidden';

      initV6Controller();
    }
  }, 500);

  function initV6Controller() {
    // 1. 建立控制按鈕
    toggleBtn = document.createElement('button');
    toggleBtn.style.cssText = `
      position: absolute !important;
      top: 8px !important;
      right: 12px !important;
      background: var(--accent, #a68a56) !important;
      color: white !important;
      border: none !important;
      padding: 4px 10px !important;
      border-radius: 4px !important;
      font-size: 12px !important;
      cursor: pointer !important;
      z-index: 100000 !important;
    `;
    toggleBtn.innerHTML = '➖';
    ttsPanel.appendChild(toggleBtn);

    // 2. 綁定循環點擊事件
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 1 -> 2 -> 3 -> 1 循環
      currentMode = currentMode === 3 ? 1 : currentMode + 1;
      applyModeLayout();
    });

    // 初始執行一次
    applyModeLayout();
  }

  function applyModeLayout() {
    const children = Array.from(ttsPanel.children);

    if (currentMode === 1) {
      // 🟢 模式 1：展開 (160px)
      ttsPanel.style.height = '160px';
      ttsPanel.style.padding = '12px 16px';
      ttsPanel.style.display = originalStyles.display || 'block';
      ttsPanel.style.background = originalStyles.background || 'var(--paper, #ffffff)';
      
      toggleBtn.innerHTML = '➖';
      toggleBtn.style.position = 'absolute';
      toggleBtn.style.top = '8px';
      toggleBtn.style.right = '12px';
      toggleBtn.style.width = 'auto';
      toggleBtn.style.height = 'auto';
      toggleBtn.style.background = 'var(--accent, #a68a56)';

      // 顯示所有元件
      children.forEach(el => el.style.display = '');

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
      toggleBtn.style.top = '13px';
      toggleBtn.style.right = '12px';
      toggleBtn.style.width = 'auto';
      toggleBtn.style.height = 'auto';

      // 只保留核心控制，隱藏選單
      children.forEach(el => {
        if (el === toggleBtn) return;
        
        if (el.tagName === 'SELECT' || el.tagName === 'BR' || el.tagName === 'H3' || el.tagName === 'TEXTAREA' || el.classList.contains('voice-select') || el.classList.contains('speed-control')) {
          el.style.setProperty('display', 'none', 'important');
        } else {
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

      // 讓按鈕鋪滿變長條狀態
      toggleBtn.innerHTML = '🎧 TTS (點擊展開)';
      toggleBtn.style.position = 'static';
      toggleBtn.style.width = '100%';
      toggleBtn.style.height = '100%';
      toggleBtn.style.background = 'transparent';
    }
  }
})();