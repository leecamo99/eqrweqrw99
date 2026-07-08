/* Google Cloud TTS Reader Patch V9: 強制背景修正版 */
(function() {
  let currentMode = 3; 
  let ttsPanel = null;
  let toggleBtn = null;

  // 🛠️ 集中設定區：背景色已改為強制不透明
  const layoutSettings = {
    mode1: { // 🟢 展開
      panelHeight: '160px',
      panelPadding: '12px 16px',
      panelBg: '#34495e', // 強制設定，避免透明
      progressBarWidth: 'calc(100% - 32px)',
      btnCss: 'position: absolute !important; top: 8px !important; right: 12px !important; background: var(--accent, #a68a56) !important; color: white !important; border: none !important; padding: 6px 12px !important; border-radius: 4px !important; font-size: 14px !important; cursor: pointer !important; z-index: 100005 !important; width: auto !important;'
    },
    mode2: { // 🟡 迷你
      panelHeight: '52px',
      panelPadding: '0 16px',
      panelBg: '#34495e', // 強制設定
      btnCss: 'position: absolute !important; top: 8px !important; right: 12px !important; background: var(--accent, #a68a56) !important; color: white !important; border: none !important; padding: 6px 12px !important; border-radius: 4px !important; font-size: 14px !important; cursor: pointer !important; z-index: 100005 !important; width: auto !important;'
    },
    mode3: { // 🔴 收合
      panelHeight: '32px',
      panelPadding: '0',
      panelBg: '#34495e',
      btnCss: 'position: static !important; width: 100% !important; height: 100% !important; background: transparent !important; color: white !important; border: none !important; font-size: 14px !important; cursor: pointer !important;'
    }
  };

  const checkTTS = setInterval(() => {
    let panel = document.querySelector('.audio-player-panel') || document.querySelector('[class*="tts-panel"]') || document.querySelector('div[style*="fixed"][style*="bottom"]');
    if (panel && panel.children.length > 0) {
      clearInterval(checkTTS);
      ttsPanel = panel;
      ttsPanel.style.position = 'fixed'; ttsPanel.style.bottom = '0'; ttsPanel.style.left = '0'; ttsPanel.style.width = '100%'; ttsPanel.style.zIndex = '99999'; ttsPanel.style.transition = 'all 0.3s'; ttsPanel.style.overflow = 'hidden';
      initV6Controller();
    }
  }, 500);

  function initV6Controller() {
    toggleBtn = document.createElement('button');
    ttsPanel.appendChild(toggleBtn);
    toggleBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); currentMode = currentMode === 3 ? 1 : currentMode + 1; applyModeLayout(); });
    applyModeLayout();
  }

  function applyModeLayout() {
    const children = Array.from(ttsPanel.children);
    const settings = layoutSettings[`mode${currentMode}`];

    // 強制設定不透明度
    ttsPanel.style.setProperty('opacity', '1', 'important');
    ttsPanel.style.setProperty('background-color', settings.panelBg, 'important');
    ttsPanel.style.setProperty('background-image', 'none', 'important');

    if (currentMode === 1) {
      ttsPanel.style.setProperty('height', settings.panelHeight, 'important');
      ttsPanel.style.setProperty('padding', settings.panelPadding, 'important');
      ttsPanel.style.setProperty('display', 'block', 'important');
      toggleBtn.innerHTML = '☰';
      toggleBtn.style.cssText = settings.btnCss;

      children.forEach(el => {
        if (el === toggleBtn) return;
        el.style.setProperty('display', '', '');
        if (el.id === 'gcttsProgress') {
          el.style.setProperty('display', 'block', 'important');
          el.style.setProperty('width', settings.progressBarWidth, 'important');
          el.style.setProperty('margin', '8px 0', 'important');
        } else if (el.id === 'gcttsProgressLabel') {
          el.style.setProperty('display', 'block', 'important');
        }
      });
    } else if (currentMode === 2) {
      ttsPanel.style.setProperty('height', settings.panelHeight, 'important');
      ttsPanel.style.setProperty('padding', settings.panelPadding, 'important');
      ttsPanel.style.setProperty('display', 'flex', 'important');
      toggleBtn.innerHTML = '＝';
      toggleBtn.style.cssText = settings.btnCss;

      children.forEach(el => {
        if (el === toggleBtn) return;
        if (el.id === 'gcttsProgress') {
          el.style.setProperty('display', 'none', 'important');
        } else if (['SELECT', 'BR', 'SPAN'].includes(el.tagName) && el.id !== 'gcttsProgressLabel') {
          el.style.setProperty('display', 'none', 'important');
        } else {
          el.style.setProperty('display', 'flex', 'important');
        }
      });
    } else if (currentMode === 3) {
      ttsPanel.style.setProperty('height', settings.panelHeight, 'important');
      ttsPanel.style.setProperty('padding', settings.panelPadding, 'important');
      ttsPanel.style.setProperty('display', 'flex', 'important');
      toggleBtn.innerHTML = '🎧 全文語音';
      toggleBtn.style.cssText = settings.btnCss;

      children.forEach(el => { if (el !== toggleBtn) el.style.setProperty('display', 'none', 'important'); });
    }
  }
})();
