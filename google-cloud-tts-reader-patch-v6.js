/* Google Cloud TTS Reader Patch V6: 純 JS 三段縮放控制器 (預設收合版) */
(function() {
  let currentMode = 3; // 🟢 預設為模式 3：收合
  let ttsPanel = null;
  let toggleBtn = null;
  
  let attempts = 0;
  const maxAttempts = 30;

  const checkTTS = setInterval(() => {
    attempts++;
    // 尋找面板的邏輯維持不變
    let panel = document.querySelector('.audio-player-panel') || 
                document.querySelector('[class*="tts-panel"]') ||
                document.querySelector('div[style*="fixed"][style*="bottom"]');

    if (!panel) {
      panel = Array.from(document.querySelectorAll('div')).find(el => {
        const text = el.textContent || '';
        return text.includes('Google Cloud TTS') && (el.style.position === 'fixed' || window.getComputedStyle(el).position === 'fixed');
      });
    }

    if (panel && panel.children.length > 0) {
      clearInterval(checkTTS);
      ttsPanel = panel;
      initV6Controller();
      return;
    }

    if (attempts >= maxAttempts) clearInterval(checkTTS);
  }, 500);

  function initV6Controller() {
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'tts-v6-toggle-btn';
    ttsPanel.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentMode = currentMode === 3 ? 1 : currentMode + 1;
      applyModeLayout();
    });

    // 🟢 執行一次應用佈局，此時 currentMode 為 3，會自動變成收合模式
    applyModeLayout();
  }

  function applyModeLayout() {
    const children = Array.from(ttsPanel.children);

    if (currentMode === 1) {
      // 模式 1：展開
      ttsPanel.style.setProperty('height', '160px', 'important');
      ttsPanel.style.setProperty('padding', '12px 16px', 'important');
      ttsPanel.style.setProperty('background', '', 'important');
      toggleBtn.innerHTML = '➖ 縮小';
      toggleBtn.style.cssText = `position: absolute; top: 8px; right: 12px; background: #a68a56; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; z-index: 100005;`;
      children.forEach(el => { if (el !== toggleBtn) el.style.setProperty('display', '', 'important'); });

    } else if (currentMode === 2) {
      // 模式 2：迷你
      ttsPanel.style.setProperty('height', '52px', 'important');
      ttsPanel.style.setProperty('padding', '0 16px', 'important');
      toggleBtn.innerHTML = '⚏ 迷你';
      children.forEach(el => {
        if (el === toggleBtn) return;
        el.style.setProperty('display', ['SELECT', 'BUTTON', 'INPUT'].includes(el.tagName) ? 'flex' : 'none', 'important');
      });

    } else if (currentMode === 3) {
      // 模式 3：收合
      ttsPanel.style.setProperty('height', '32px', 'important');
      ttsPanel.style.setProperty('padding', '0', 'important');
      ttsPanel.style.setProperty('background', '#34495e', 'important');
      toggleBtn.innerHTML = '🎧 TTS (展開)';
      toggleBtn.style.cssText = `width: 100%; height: 100%; background: transparent; color: white; border: none; cursor: pointer; font-size: 14px;`;
      children.forEach(el => { if (el !== toggleBtn) el.style.setProperty('display', 'none', 'important'); });
    }
  }
})();
