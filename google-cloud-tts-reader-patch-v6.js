(function() {
  // 1. 配合你目前的網頁，強行抓取 v5 的語音面板外殼
  // 偵測畫面底部固定定位、含有 TTS 或播放控制的 container
  const p = document.querySelector('div[style*="fixed"][style*="bottom"]') || 
            document.querySelector('.audio-player-panel') || 
            Array.from(document.querySelectorAll('div')).find(el => el.textContent.includes('Google Cloud TTS'));
            
  if (!p) {
    console.error('❌ 測試失敗：畫面上找不到任何語音面板，請確認元件是否有出現在最下方。');
    return;
  }

  // 2. 移除可能殘留的舊按鈕，避免重複
  const oldBtn = p.querySelector('.tts-v6-toggle-btn');
  if (oldBtn) oldBtn.remove();

  // 3. 建立測試按鈕 [-]
  const btn = document.createElement('button');
  btn.className = 'tts-v6-toggle-btn';
  btn.style.cssText = 'position:absolute!important;top:8px!important;right:12px!important;background:#a68a56!important;color:white!important;border:none!important;padding:6px 12px!important;border-radius:4px!important;font-size:14px!important;cursor:pointer!important;z-index:100005!important;';
  btn.innerHTML = '➖ 縮小';
  p.appendChild(btn);

  let mode = 1;
  const children = Array.from(p.children);

  btn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    mode = mode === 3 ? 1 : mode + 1;
    
    if (mode === 1) {
      // 🟢 模式 1：展開 (160px)
      p.style.setProperty('height', '160px', 'important');
      p.style.setProperty('padding', '12px 16px', 'important');
      p.style.setProperty('display', 'block', 'important');
      p.style.setProperty('background', '#1a252f', 'important'); // 配合你目前的深色面板
      
      btn.innerHTML = '➖ 縮小';
      btn.style.cssText = 'position:absolute!important;top:8px!important;right:12px!important;background:#a68a56!important;color:white!important;border:none!important;padding:6px 12px!important;border-radius:4px!important;font-size:14px!important;cursor:pointer!important;z-index:100005!important;';
      
      children.forEach(el => {
        if (el === btn) return;
        el.style.setProperty('display', '', ''); // 恢復原本顯示
      });
      console.log('🟢 模式 1：展開 (160px)');
      
    } else if (mode === 2) {
      // 🟡 模式 2：迷你播放器 (52px)
      p.style.setProperty('height', '52px', 'important');
      p.style.setProperty('padding', '0 16px', 'important');
      p.style.setProperty('display', 'flex', 'important');
      p.style.setProperty('align-items', 'center', 'important');
      p.style.setProperty('gap', '12px', 'important');
      
      btn.innerHTML = '⚏ 迷你';
      btn.style.cssText = 'position:absolute!important;top:10px!important;right:12px!important;background:#a68a56!important;color:white!important;border:none!important;padding:6px 12px!important;border-radius:4px!important;font-size:14px!important;cursor:pointer!important;z-index:100005!important;';
      
      children.forEach(el => {
        if (el === btn) return;
        // 隱藏下拉選單、文字標題與換行，只留播放、暫停按鈕與進度條
        if (['SELECT', 'BR', 'SPAN'].includes(el.tagName) || el.textContent.includes('Google Cloud') || el.textContent.includes('待命')) {
          el.style.setProperty('display', 'none', 'important');
        } else {
          el.style.setProperty('display', 'flex', 'important');
          el.style.setProperty('align-items', 'center', 'important');
          el.style.setProperty('margin', '0', 'important');
        }
      });
      console.log('🟡 模式 2：迷你播放器 (52px)');
      
    } else if (mode === 3) {
      // 🔴 模式 3：收合 (32px)
      p.style.setProperty('height', '32px', 'important');
      p.style.setProperty('padding', '0', 'important');
      p.style.setProperty('display', 'flex', 'important');
      p.style.setProperty('align-items', 'center', 'important');
      p.style.setProperty('justifyContent', 'center', 'important');
      p.style.setProperty('background', '#34495e', 'important');
      
      children.forEach(el => { if (el !== btn) el.style.setProperty('display', 'none', 'important'); });
      
      btn.innerHTML = '🎧 TTS (點擊展開)';
      btn.style.cssText = 'position:static!important;width:100%!important;height:100%!important;background:transparent!important;color:white!important;border:none!important;font-size:14px!important;cursor:pointer!important;';
      console.log('🔴 模式 3：收合 (32px)');
    }
  });

  console.log('✅ [TTS V6 本地相容測試] 成功接管現有的 v5 面板！現在可以去點擊右上角的按鈕了。');
})();
