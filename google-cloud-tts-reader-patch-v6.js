/* Google Cloud TTS Reader Patch V12: 穩定版 */
(function() {
  'use strict';
  let currentMode = 3; 
  let ttsPanel = null;
  let toggleBtn = null;

  // 1. 初始化 CSS：強制隱藏 v5 標題，保證永不穿幫
  const style = document.createElement('style');
  style.textContent = `
    #gcttsPanel b { display: none !important; }
  `;
  document.head.appendChild(style);

  // 2. 集中設定區
  const layoutSettings = {
    mode1: { panelHeight: '160px', panelPadding: '12px 16px', panelBg: '#34495e' },
    mode2: { panelHeight: '52px', panelPadding: '0 16px', panelBg: '#34495e' },
    mode3: { panelHeight: '30px', panelPadding: '0', panelBg: '#34495e' }
  };

  // 3. 面板偵測與初始化
  const checkTTS = setInterval(() => {
    let panel = document.getElementById('gcttsPanel') || document.querySelector('.audio-player-panel');
    if (panel) {
      clearInterval(checkTTS);
      ttsPanel = panel;
      // 初始化容器樣式，加入 flex-wrap 讓進度條能換行
      Object.assign(ttsPanel.style, { position: 'fixed', bottom: '0', left: '0', width: '100%', zIndex: '99999', transition: 'all 0.3s', overflow: 'hidden', display: 'flex', flexWrap: 'wrap' });
      initV6Controller();
    }
  }, 500);

  function initV6Controller() {
    toggleBtn = document.createElement('button');
    // 設定按鈕樣式
    toggleBtn.style.cssText = 'position: absolute !important; top: 8px !important; right: 12px !important; background: #a68a56 !important; color: white !important; border: none !important; padding: 6px 12px !important; border-radius: 4px !important; z-index: 100005 !important;';
    ttsPanel.appendChild(toggleBtn);
    toggleBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); currentMode = (currentMode % 3) + 1; applyModeLayout(); });
    applyModeLayout();
  }

  // 4. 版面切換邏輯
  function applyModeLayout() {
    const settings = layoutSettings[`mode${currentMode}`];
    const prog = document.getElementById('gcttsProgress');
    const label = document.getElementById('gcttsProgressLabel');

    ttsPanel.style.setProperty('height', settings.panelHeight, 'important');
    ttsPanel.style.setProperty('padding', settings.panelPadding, 'important');
    ttsPanel.style.setProperty('background-color', settings.panelBg, 'important');

    if (currentMode === 1) { // 展開：進度條獨佔一行
      toggleBtn.innerHTML = '☰';
      Array.from(ttsPanel.children).forEach(el => el.style.setProperty('display', '', ''));
      if (prog && label) {
        prog.parentElement.style.setProperty('width', '100%', 'important');
        prog.style.setProperty('width', 'calc(100% - 150px)', 'important');
        prog.style.display = 'inline-block';
      }
    } else if (currentMode === 2) { // 迷你：隱藏進度條與 Key
      toggleBtn.innerHTML = '＝';
      Array.from(ttsPanel.children).forEach(el => {
        const isHidden = (el.id === 'gcttsProgress' || el.id === 'gcttsProgressLabel' || el.id === 'gcttsKey' || el.tagName === 'BR');
        el.style.setProperty('display', isHidden ? 'none' : 'flex', 'important');
      });
    } else if (currentMode === 3) { // 收合
      toggleBtn.innerHTML = '🎧 全文語音';
      Array.from(ttsPanel.children).forEach(el => { if (el !== toggleBtn) el.style.setProperty('display', 'none', 'important'); });
    }
  }
})();
