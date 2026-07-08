/* Google Cloud TTS Reader Patch V10: 穩定版 */
(function() {
  'use strict';
  let currentMode = 3; 
  let ttsPanel = null;
  let toggleBtn = null;

  // 1. 初始化 CSS：處理永久性的樣式與強制隱藏需求
  const style = document.createElement('style');
  style.textContent = `
    /* 強制隱藏 v5 的標題，但保留 Key 按鈕 */
    #gcttsPanel b { display: none !important; }
    #gcttsKey { display: inline-block !important; }
  `;
  document.head.appendChild(style);

  // 2. 集中設定區
  const layoutSettings = {
    mode1: { panelHeight: '160px', panelPadding: '12px 16px', panelBg: '#34495e', btnCss: 'position: absolute !important; top: 8px !important; right: 12px !important; background: var(--accent, #a68a56) !important; color: white !important; border: none !important; padding: 6px 12px !important; border-radius: 4px !important; font-size: 14px !important; cursor: pointer !important; z-index: 100005 !important; width: auto !important;' },
    mode2: { panelHeight: '52px', panelPadding: '0 16px', panelBg: '#34495e', btnCss: 'position: absolute !important; top: 8px !important; right: 12px !important; background: var(--accent, #a68a56) !important; color: white !important; border: none !important; padding: 6px 12px !important; border-radius: 4px !important; font-size: 14px !important; cursor: pointer !important; z-index: 100005 !important; width: auto !important;' },
    mode3: { panelHeight: '32px', panelPadding: '0', panelBg: '#34495e', btnCss: 'position: static !important; width: 100% !important; height: 100% !important; background: transparent !important; color: white !important; border: none !important; font-size: 14px !important; cursor: pointer !important;' }
  };

  // 3. 面板偵測與初始化
  const checkTTS = setInterval(() => {
    let panel = document.getElementById('gcttsPanel') || document.querySelector('.audio-player-panel');
    if (panel) {
      clearInterval(checkTTS);
      ttsPanel = panel;
      // 初始化容器樣式
      Object.assign(ttsPanel.style, { position: 'fixed', bottom: '0', left: '0', width: '100%', zIndex: '99999', transition: 'all 0.3s', overflow: 'hidden' });
      initV6Controller();
    }
  }, 500);

  function initV6Controller() {
    toggleBtn = document.createElement('button');
    ttsPanel.appendChild(toggleBtn);
    toggleBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); currentMode = (currentMode % 3) + 1; applyModeLayout(); });
    applyModeLayout();
  }

  // 4. 版面切換邏輯
  function applyModeLayout() {
    const settings = layoutSettings[`mode${currentMode}`];
    const children = Array.from(ttsPanel.children);

    // 強制設定背景
    ttsPanel.style.setProperty('opacity', '1', 'important');
    ttsPanel.style.setProperty('background-color', settings.panelBg, 'important');
    ttsPanel.style.setProperty('background-image', 'none', 'important');
    ttsPanel.style.setProperty('height', settings.panelHeight, 'important');
    ttsPanel.style.setProperty('padding', settings.panelPadding, 'important');

    toggleBtn.style.cssText = settings.btnCss;

    if (currentMode === 1) { // 展開
      toggleBtn.innerHTML = '☰';
      ttsPanel.style.setProperty('display', 'block', 'important');
      children.forEach(el => {
        el.style.setProperty('display', '', '');
        if (el.id === 'gcttsProgress') {
          Object.assign(el.style, { display: 'block', width: '100%', maxWidth: '100%', margin: '8px 0', boxSizing: 'border-box' });
          el.style.setProperty('display', 'block', 'important');
        }
      });
    } else if (currentMode === 2) { // 迷你
      toggleBtn.innerHTML = '＝';
      ttsPanel.style.setProperty('display', 'flex', 'important');
      children.forEach(el => {
        if (el === toggleBtn) return;
        const isHidden = (el.id === 'gcttsProgress' || ['SELECT', 'BR', 'SPAN'].includes(el.tagName));
        el.style.setProperty('display', isHidden ? 'none' : 'flex', 'important');
      });
    } else if (currentMode === 3) { // 收合
      toggleBtn.innerHTML = '🎧 全文語音';
      ttsPanel.style.setProperty('display', 'flex', 'important');
      children.forEach(el => { if (el !== toggleBtn) el.style.setProperty('display', 'none', 'important'); });
    }
  }
})();
