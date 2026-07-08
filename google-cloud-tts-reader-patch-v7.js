/* Google Cloud TTS Reader Patch V7: 修正版 (修復 setKey 定義錯誤) */
(function(){
  'use strict';
  
  // --- [CORE ENGINE - 前置定義] ---
  const KEY='notebook_google_cloud_tts_key_v1';
  const SETTINGS='notebook_google_cloud_tts_settings_v1';
  // ... (其他常數與 VOICES 定義保持不變) ...
  const VOICES=[['en-US-Chirp3-HD-Aoede','Chirp3 HD Aoede'],['en-US-Neural2-A','Neural2 A'],['en-US-Wavenet-F','WaveNet F']];
  
  let audio=null, chunks=[], chunkIndex=0, playing=false, rafId=0, words=[];

  // --- [功能函數定義區 (確保在 initV7 前已存在)] ---
  function load(){try{return JSON.parse(localStorage.getItem(SETTINGS)||'{}')}catch(e){return {}}}
  function save(s){localStorage.setItem(SETTINGS,JSON.stringify(s||{}));}
  function setKey(){
    const old=localStorage.getItem(KEY)||'';
    const k=prompt('貼上 Google Cloud TTS API Key',old);
    if(k===null)return;
    if(k.trim())localStorage.setItem(KEY,k.trim());
    else localStorage.removeItem(KEY);
    alert('已更新 Key');
  }
  function playAll(){ chunks=buildChunks(); chunkIndex=0; playCurrent(); }
  function pause(){ if(audio)audio.pause(); }
  function stop(){ playing=false; if(audio){audio.pause();audio.currentTime=0;} }
  function seekWord(idx){
    idx=Math.max(0,Math.min(words.length-1,Number(idx)||0));
    if(!chunks.length)chunks=buildChunks();
    chunkIndex=findChunkByWord(idx);
    if(audio)audio.pause();
    highlightWord(idx,true);
    playCurrent();
  }
  
  // ... (這裡補上你原版 v5 的其他完整函數: synthesize, buildChunks, highlightWord, cursorLoop 等) ...

  // --- [UI 初始化 - 修正綁定順序] ---
  function initV7() {
    const p=document.createElement('div'); 
    p.id='gcttsPanel'; 
    p.style.cssText='position:fixed;bottom:0;width:100%;z-index:99999;background:#1f2937;color:#fff;transition:height 0.3s;overflow:hidden;';
    
    p.innerHTML = `
      <div id="gcttsContent" style="padding:10px;">
        <div style="display:flex;gap:5px;">
          <button id="btnKey">Key</button>
          <button id="btnPlay">播放</button>
          <button id="btnPause">暫停</button>
          <button id="btnStop">停止</button>
        </div>
        <input id="gcttsProgress" type="range" min="0" max="100" value="0" style="width:100%;margin:10px 0;">
      </div>
      <button id="btnToggle" style="position:absolute;top:5px;right:5px;background:#f4d27a;border:none;padding:2px 8px;border-radius:4px;">收合</button>
    `;
    document.body.appendChild(p);

    // 嚴格綁定
    document.getElementById('btnKey').onclick = setKey;
    document.getElementById('btnPlay').onclick = playAll;
    document.getElementById('btnPause').onclick = pause;
    document.getElementById('btnStop').onclick = stop;
    
    // 進度條綁定
    const prog = document.getElementById('gcttsProgress');
    prog.onchange = e => seekWord(e.target.value);

    // 三段式控制器邏輯
    let mode = 1; // 1:展開, 2:迷你, 3:收合
    const toggle = document.getElementById('btnToggle');
    toggle.onclick = () => {
      mode = mode === 3 ? 1 : mode + 1;
      if(mode === 1) { p.style.height='120px'; toggle.innerText='收合'; document.getElementById('gcttsContent').style.display='block'; }
      else if(mode === 2) { p.style.height='40px'; toggle.innerText='展開'; document.getElementById('gcttsContent').style.display='none'; }
      else { p.style.height='0px'; toggle.innerText='顯示'; }
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initV7); else initV7();
})();
