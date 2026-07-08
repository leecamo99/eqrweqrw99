/* Google Cloud TTS Reader Patch V6: 純 JS 三段縮放控制器 (自動延遲偵測版 - 預設模式3) */
(function() {
  let currentMode = 3; // 🟢 已改為預設模式 3：收合
  let ttsPanel = null;
  let toggleBtn = null;
  let originalStyles = { height: '', padding: '', display: '', background: '' };
  
  let attempts = 0;
  const maxAttempts = 30;

  const checkTTS = setInterval(() => {
    attempts++;
    
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
      
      originalStyles.height = ttsPanel.style.height || '160px';
      originalStyles.padding = ttsPanel.style.padding;
      originalStyles.display = ttsPanel.style.display || 'block';
      originalStyles.background = ttsPanel.style.background;

      ttsPanel.style.position = 'fixed';
      ttsPanel.style.bottom = '0';
      ttsPanel.style.left = '0';
      ttsPanel.style.width = '100%';
      ttsPanel.style.zIndex = '99999';
      ttsPanel.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
      ttsPanel.style.overflow = 'hidden';

      initV6Controller();
      console.log('%c [TTS V6] 成功在第 ' + attempts + ' 次嘗試抓取到語音面板並完美接管！(預設收合模式)', 'color: #28a745; font-weight: bold;');
      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(checkTTS);
    }
  }, 500);

  function initV6Controller() {
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
    ttsPanel.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 循環邏輯：3 -> 1 -> 2 -> 3
      currentMode = currentMode === 3 ? 1 : currentMode + 1;
      applyModeLayout();
    });

    applyModeLayout(); // 初始化時立即應用預設的模式 3 佈局
  }

 function applyModeLayout() {
    const children = Array.from(ttsPanel.children);

    // 修正：補上對應的 if 判斷
    if (currentMode === 1) {
      // 🟢 模式 1：展開
      ttsPanel.style.setProperty('height', '160px', 'important');
      ttsPanel.style.setProperty('padding', '12px 16px', 'important');
      ttsPanel.style.setProperty('display', 'block', 'important');
      toggleBtn.innerHTML = '☰';
      toggleBtn.style.cssText = `position: absolute !important; top: 8px !important; right: 12px !important; background: var(--accent, #a68a56) !important; color: white !important; border: none !important; padding: 6px 12px !important; border-radius: 4px !important; font-size: 14px !important; cursor: pointer !important; z-index: 100005 !important; width: auto !important;`;
      
      children.forEach(el => { 
        if (el === toggleBtn) return;
        
        el.style.setProperty('display', '', ''); 
        
        if (el.id === 'gcttsProgress') {
           el.style.setProperty('display', 'flex', 'important');
           el.style.setProperty('width', '100%', 'important'); 
           el.style.setProperty('flex', '1', 'important');     
        } else if (el.id === 'gcttsProgressLabel') {
           el.style.setProperty('display', 'flex', 'important');
        }
      });

    } else if (currentMode === 2) {
      // 🟡 模式 2：迷你
      ttsPanel.style.setProperty('height', '52px', 'important');
      ttsPanel.style.setProperty('padding', '0 16px', 'important');
      ttsPanel.style.setProperty('display', 'flex', 'important');
      toggleBtn.innerHTML = '＝';
      
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
      // 🔴 模式 3：收合
      ttsPanel.style.setProperty('height', '32px', 'important');
      ttsPanel.style.setProperty('padding', '0', 'important');
      ttsPanel.style.setProperty('display', 'flex', 'important');
      ttsPanel.style.setProperty('background', '#34495e', 'important');
      
      children.forEach(el => { if (el !== toggleBtn) el.style.setProperty('display', 'none', 'important'); });

      toggleBtn.innerHTML = '🎧 全文語音';
      toggleBtn.style.cssText = `position: static !important; width: 100% !important; height: 100% !important; background: transparent !important; color: white !important; border: none !important; font-size: 14px !important; cursor: pointer !important;`;
    }
  }
})();
