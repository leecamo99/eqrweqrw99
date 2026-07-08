/* Google Cloud TTS Reader Patch V7: 合併版 (Core Engine + V6 Controller) */
(function(){
  'use strict';
  
  // --- [CORE ENGINE - v5] ---
  const KEY='notebook_google_cloud_tts_key_v1';
  const SETTINGS='notebook_google_cloud_tts_settings_v1';
  const MAX_REQUEST_BYTES=1800;
  const MAX_SENTENCE_BYTES=420;
  const enc=new TextEncoder();
  let audio=null, chunks=[], chunkIndex=0, playing=false, rafId=0;
  let words=[];

  const VOICES=[
    ['en-US-Chirp3-HD-Aoede','Chirp3 HD Aoede'],['en-US-Chirp3-HD-Charon','Chirp3 HD Charon'],
    ['en-US-Chirp3-HD-Kore','Chirp3 HD Kore'],['en-US-Chirp3-HD-Puck','Chirp3 HD Puck'],
    ['en-US-Chirp3-HD-Zephyr','Chirp3 HD Zephyr'],['en-US-Neural2-A','Neural2 A'],
    ['en-US-Neural2-F','Neural2 F'],['en-US-Wavenet-F','WaveNet F']
  ];
  
  function load(){try{return JSON.parse(localStorage.getItem(SETTINGS)||'{}')}catch(e){return {}}}
  function save(s){localStorage.setItem(SETTINGS,JSON.stringify(s||{}));}
  function byteLen(s){return enc.encode(String(s||'')).length;}
  
  function injectStyle(){
    if(document.getElementById('gcttsStyle'))return;
    const s=document.createElement('style');
    s.id='gcttsStyle';
    s.textContent=`
      .gctts-word{border-radius:3px;transition:background .08s;}
      .gctts-word.gctts-current{background:#f4d27a!important;color:#1f2937!important;}
      .gctts-word.gctts-read{background:rgba(166,138,86,.12)!important;}
    `;
    document.head.appendChild(s);
  }

  // --- [CONTROLLER INTEGRATION - v6 調整版] ---
  function initV7() {
    injectStyle();
    const p = document.createElement('div');
    p.id = 'gcttsPanel'; 
    p.className = 'gctts-panel'; 
    p.style.cssText = 'position:fixed; bottom:0; width:100%; z-index:99999; background:#1f2937; color:#fff8e8; transition: height 0.3s ease; overflow: hidden;';
    document.body.appendChild(p);

    setupV6Controller(p);
  }

  function setupV6Controller(ttsPanel) {
    // 預設模式改為 3 (收合)
    let currentMode = 3; 
    
    const toggleBtn = document.createElement('button');
    toggleBtn.style.cssText = "position:absolute; top:8px; right:12px; cursor:pointer; z-index:100005;";
    ttsPanel.appendChild(toggleBtn);

    // 初始化時立即應用樣式
    applyLayout(ttsPanel, toggleBtn, currentMode);

    toggleBtn.addEventListener('click', () => {
      currentMode = currentMode === 3 ? 1 : currentMode + 1;
      applyLayout(ttsPanel, toggleBtn, currentMode);
    });
  }

  function applyLayout(panel, btn, mode) {
    if (mode === 1) { // 展開
      panel.style.height = '160px';
      btn.innerHTML = '➖ 縮小';
      Array.from(panel.children).forEach(el => { if(el !== btn) el.style.display = ''; });
    } else if (mode === 2) { // 迷你
      panel.style.height = '52px';
      btn.innerHTML = '⚏ 迷你';
      Array.from(panel.children).forEach(el => { if(el !== btn) el.style.display = 'none'; });
    } else if (mode === 3) { // 收合
      panel.style.height = '32px';
      btn.innerHTML = '🎧 TTS (點擊展開)';
      Array.from(panel.children).forEach(el => { if(el !== btn) el.style.display = 'none'; });
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initV7);else initV7();
})();
