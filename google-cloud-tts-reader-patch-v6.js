/* Google Cloud TTS Reader Patch V6: 修正透明顯示與樣式版 */
(function() {
  let currentMode = 3; 
  let ttsPanel = null;
  let toggleBtn = null;
  
  // ... (保留原有的尋找面板邏輯，直到執行到 initV6Controller)

  function applyModeLayout() {
    const children = Array.from(ttsPanel.children);

    if (currentMode === 1) {
      // 展開模式
      ttsPanel.style.setProperty('height', '160px', 'important');
      ttsPanel.style.setProperty('background', '#1f2937', 'important'); // 明確設定背景
      toggleBtn.innerHTML = '➖ 縮小';
      children.forEach(el => { if (el !== toggleBtn) el.style.setProperty('display', '', 'important'); });

    } else if (currentMode === 2) {
      // 迷你模式
      ttsPanel.style.setProperty('height', '52px', 'important');
      ttsPanel.style.setProperty('background', '#1f2937', 'important');
      toggleBtn.innerHTML = '⚏ 迷你';
      children.forEach(el => {
        if (el === toggleBtn) return;
        el.style.setProperty('display', ['SELECT', 'BUTTON', 'INPUT'].includes(el.tagName) ? 'flex' : 'none', 'important');
      });

    } else if (currentMode === 3) {
      // 🟢 收合模式 (修正透明問題)
      ttsPanel.style.setProperty('height', '32px', 'important');
      ttsPanel.style.setProperty('padding', '0', 'important');
      // 關鍵修正：確保背景色明確，非透明
      ttsPanel.style.setProperty('background', '#34495e', 'important'); 
      ttsPanel.style.setProperty('opacity', '1', 'important');
      
      toggleBtn.innerHTML = '🎧 TTS (點擊展開)';
      toggleBtn.style.cssText = `
        width: 100%; height: 100%; 
        background: transparent !important; 
        color: white !important; 
        border: none !important; 
        cursor: pointer; 
        font-size: 14px;
      `;
      children.forEach(el => { if (el !== toggleBtn) el.style.setProperty('display', 'none', 'important'); });
    }
  }
})();
