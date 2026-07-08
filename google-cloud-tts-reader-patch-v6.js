/* Google Cloud TTS Reader Patch V7: 數值化控制版 (自動延遲偵測版) */
(function() {
  let currentMode = 3; // 🟢 預設模式 3：收合
  let ttsPanel = null;
  let toggleBtn = null;

  // 🛠️ 集中設定區：您可以在這裡修改所有模式的數值進行微調
  const layoutSettings = {
    // 🟢 模式 1：展開
    mode1: {
      panelHeight: '160px',
      panelPadding: '12px 16px',
      btnCss: 'position: absolute !important; top: 8px !important; right: 12px !important; background: var(--accent, #a68a56) !important; color: white !important; border: none !important; padding: 6px 12px !important; border-radius: 4px !important; font-size: 14px !important; cursor: pointer !important; z-index: 100005 !important; width: auto !important;',
      progressBarMargin: '8px 0' // 給進度條上下加一點間距
    },
    // 🟡 模式 2：迷你
    mode2: {
      panelHeight: '52px',
      panelPadding: '0 16px',
      btnCss: 'position: absolute !important; top: 8px !important; right: 12px !important; background: var(--accent, #a68a56) !important; color: white !important; border: none !important; padding: 6px 12px !important; border-radius: 4px !important; font-size: 14px !important; cursor: pointer !important; z-index: 100005 !important; width: auto !important;'
    },
    // 🔴 模式 3：收合
    mode3: {
      panelHeight: '32px',
      panelPadding: '0',
      panelBg: '#34495e',
      btnCss: 'position: static !important; width: 100% !important; height: 100% !important; background: transparent !important; color: white !important; border: none !important; font-size: 14px !important; cursor: pointer !important;'
    }
  };

  let attempts = 0;
  const maxAttempts = 30;

  // [此處省略抓取面板的邏輯，保持不變]
  const checkTTS = setInterval(() => {
    attempts++;
    let panel = document.querySelector('.audio-player-panel') || document.querySelector('[class*="tts-panel"]') || document.querySelector('div[style*="fixed"][style*="bottom"]');
    if (!panel) {
      panel = Array.from(document.querySelectorAll('div')).find(el => {
        const text = el.textContent || ''; return text.includes('Google Cloud TTS') && (el.style.position === 'fixed' || window.getComputedStyle(el).position === 'fixed');
      });
    }
    if (panel && panel.children.length > 0) {
      clearInterval(checkTTS);
      ttsPanel = panel;
      ttsPanel.style.position = 'fixed'; ttsPanel.style.bottom = '0'; ttsPanel.style.left = '0'; ttsPanel.style.width = '100%'; ttsPanel.style.zIndex = '99999'; ttsPanel.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'; ttsPanel.style.overflow = 'hidden';
      initV6Controller();
      console.log('%c [TTS V7] 成功啟動 (微調模式)', 'color: #28a745; font-weight: bold;');
      return;
    }
    if (attempts >= maxAttempts) clearInterval(checkTTS);
  }, 500);

  function initV6Controller() {
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'tts-v6-toggle-btn';
    ttsPanel.appendChild(toggleBtn);
    toggleBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); currentMode = currentMode === 3 ? 1 : currentMode + 1; applyModeLayout(); });
    applyModeLayout();
  }

  // 🛠️ 套用佈局的核心邏輯（已套用您的需求並使用設定物件）
  function applyModeLayout() {
    const children = Array.from(ttsPanel.children);
    const settings = layoutSettings[`mode${currentMode}`]; // 根據目前模式取得對應設定

    // 重置按鈕樣式（先清除可能殘留的樣式，再套用該模式的 CSS）
    toggleBtn.style.cssText = '';

    if (currentMode === 1) {
      // 🟢 模式 1：展開
      ttsPanel.style.setProperty('height', settings.panelHeight, 'important');
      ttsPanel.style.setProperty('padding', settings.panelPadding, 'important');
      ttsPanel.style.setProperty('display', 'block', 'important');
      ttsPanel.style.removeProperty('background'); // 移除收合時的背景色
      toggleBtn.innerHTML = '☰';
      toggleBtn.style.cssText = settings.btnCss;

      children.forEach(el => {
        if (el === toggleBtn) return;
        el.style.setProperty('display', '', '');

        if (el.id === 'gcttsProgress') {
          // 強化顯示：強制填滿整行
          el.style.setProperty('display', 'block', 'important');
          el.style.setProperty('width', 'calc(100% - 32px)', 'important'); // 扣除 padding
          el.style.setProperty('margin', settings.progressBarMargin, 'important');
        } else if (el.id === 'gcttsProgressLabel') {
          el.style.setProperty('display', 'block', 'important');
        }
      });

    } else if (currentMode === 2) {
      // 🟡 模式 2：迷你
      ttsPanel.style.setProperty('height', settings.panelHeight, 'important');
      ttsPanel.style.setProperty('padding', settings.panelPadding, 'important');
      ttsPanel.style.setProperty('display', 'flex', 'important');
      ttsPanel.style.removeProperty('background');
      toggleBtn.innerHTML = '＝';
      toggleBtn.style.cssText = settings.btnCss;

      children.forEach(el => {
        if (el === toggleBtn) return;

        // 強化顯示：強制隱藏進度條
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
      ttsPanel.style.setProperty('height', settings.panelHeight, 'important');
      ttsPanel.style.setProperty('padding', settings.panelPadding, 'important');
      ttsPanel.style.setProperty('display', 'flex', 'important');
      ttsPanel.style.setProperty('background', settings.panelBg, 'important');

      children.forEach(el => {
        if (el !== toggleBtn) el.style.setProperty('display', 'none', 'important');
      });

      toggleBtn.innerHTML = '🎧 全文語音';
      toggleBtn.style.cssText = settings.btnCss;
    }
  }
})();
