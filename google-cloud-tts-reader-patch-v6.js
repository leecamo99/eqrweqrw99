(function() {
  // 💡 1. 終極多重偵測：從文字與按鈕特徵直接鎖定語音面板
  let p = document.querySelector('.audio-player-panel') || 
          document.querySelector('[class*="tts-panel"]') ||
          document.querySelector('div[style*="fixed"][style*="bottom"]');

  // 如果上面沒抓到，改用文字內容搜尋（通殺所有版本的外殼）
  if (!p) {
    p = Array.from(document.querySelectorAll('div')).find(el => {
      const text = el.textContent || '';
      return text.includes('Google Cloud TTS') && el.style.position === 'fixed';
    });
  }

  if (!p) {
    console.error('❌ 測試失敗：真的找不到 TTS 面板。請確認網頁最下方的深色語音控制列此時是「看得見」的狀態。');
    return;
  }

  // 2. 清理可能殘留的舊按鈕
  const oldBtn = p.querySelector('.tts-v6-toggle-btn');
  if (oldBtn) oldBtn.remove();

  // 3. 建立並強行掛載控制按鈕
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
      
      btn.innerHTML = '➖ 縮小';
      btn.style.cssText = 'position:absolute!important;top:8px!important;right:12px!important;background:#a68a56!important;color:white!important;border:none!important;padding:6px 12px!important;border-radius:4px!important;font-size:14px!important;cursor:pointer!important;z-index:100005!important;';
      
      children.forEach(el => {
        if (el === btn) return;
        el.style.setProperty('display', '', ''); 
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
        // 隱藏下拉選單與非必要純文字，只留下播放、暫停與進度條
        if (['SELECT', 'BR', 'SPAN'].includes(el.tagName) || el.textContent.includes('Google Cloud') || el.textContent.includes('待命') || el.style.position === 'absolute') {
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
      p.style.setProperty('justify-content', 'center', 'important');
      p.style.setProperty('background', '#34495e', 'important');
      
      children.forEach(el => { if (el !== btn) el.style.setProperty('display', 'none', 'important'); });
      
      btn.innerHTML = '🎧 TTS (點擊展開)';
      btn.style.cssText = 'position:static!important;width:100%!important;height:100%!important;background:transparent!important;color:white!important;border:none!important;font-size:14px!important;cursor:pointer!important;';
      console.log('🔴 模式 3：收合 (32px)');
    }
  });

  console.log('✅ [TTS V6 終極相容測試] 成功找到面板並注入按鈕！');
})();
