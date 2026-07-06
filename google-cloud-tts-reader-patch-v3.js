
/* google-cloud-tts-reader-patch-v3.js v20260707-3
   Fixes Google Cloud TTS "sentences too long" for OCR-style articles with line breaks and little punctuation.
   Strategy:
   1) Preserve OCR line breaks from .card .en
   2) Convert each line into a short sentence by adding period if needed
   3) Split by UTF-8 bytes under 1800 bytes per request
   4) Also split long lines by words and add sentence-ending punctuation
   Install:
   <script src="./google-cloud-tts-reader-patch-v3.js?v=20260707-3"></script>
*/
(function(){
  'use strict';
  const KEY='notebook_google_cloud_tts_key_v1';
  const SETTINGS='notebook_google_cloud_tts_settings_v1';
  const MAX_REQUEST_BYTES=1800;     // much lower than 5000 to avoid internal sentence parser errors
  const MAX_SENTENCE_BYTES=420;     // force short sentences, especially for OCR text without punctuation
  const enc=new TextEncoder();
  let audio=null, chunks=[], chunkIndex=0, playing=false;

  const VOICES=[
    ['en-US-Chirp3-HD-Aoede','Chirp3 HD Aoede / Female'],
    ['en-US-Chirp3-HD-Charon','Chirp3 HD Charon / Male'],
    ['en-US-Chirp3-HD-Kore','Chirp3 HD Kore / Female'],
    ['en-US-Chirp3-HD-Puck','Chirp3 HD Puck / Male'],
    ['en-US-Chirp3-HD-Zephyr','Chirp3 HD Zephyr / Female'],
    ['en-US-Neural2-A','Neural2 A'],
    ['en-US-Neural2-C','Neural2 C'],
    ['en-US-Neural2-D','Neural2 D'],
    ['en-US-Neural2-F','Neural2 F'],
    ['en-US-Wavenet-D','WaveNet D'],
    ['en-US-Wavenet-F','WaveNet F']
  ];
  function load(){try{return JSON.parse(localStorage.getItem(SETTINGS)||'{}')}catch(e){return {}}}
  function save(s){localStorage.setItem(SETTINGS,JSON.stringify(s||{}));}
  function byteLen(s){return enc.encode(String(s||'')).length;}
  function status(t){const el=document.getElementById('gcttsStatus');if(el)el.textContent=t||'';}
  function endsWithPunc(s){return /[.!?。！？]$/.test(String(s||'').trim());}
  function asSentence(s){s=String(s||'').replace(/\s+/g,' ').trim(); if(!s)return ''; return endsWithPunc(s)?s:s+'.';}

  function splitLongLineToSentences(line){
    line=String(line||'').replace(/\s+/g,' ').trim();
    if(!line)return [];
    // If line already has punctuation, split by punctuation first.
    const raw=line.match(/[^.!?。！？]+[.!?。！？]?/g)||[line];
    const result=[];
    for(const piece0 of raw){
      let piece=String(piece0||'').trim();
      if(!piece)continue;
      if(byteLen(piece)<=MAX_SENTENCE_BYTES){result.push(asSentence(piece));continue;}
      // Too long: split by words and force periods.
      let buf='';
      for(const w of piece.split(/\s+/)){
        const candidate=(buf?buf+' ':'')+w;
        if(byteLen(candidate)<=MAX_SENTENCE_BYTES){buf=candidate;}
        else{if(buf)result.push(asSentence(buf));buf=w;}
      }
      if(buf)result.push(asSentence(buf));
    }
    return result;
  }

  function getArticleSentences(){
    const all=[];
    document.querySelectorAll('.card .en').forEach(en=>{
      const c=en.cloneNode(true);
      c.querySelectorAll('button,input,select,textarea,.note,.mynote,.study,.study-notes,#dock,#capBody').forEach(x=>x.remove());
      const lines=(c.innerText||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
      for(const line of lines){
        // OCR articles often have one phrase per line and no punctuation. Treat each line as a sentence.
        const sentences=splitLongLineToSentences(line);
        all.push(...sentences);
      }
    });
    return all;
  }

  function buildRequestChunks(){
    const sentences=getArticleSentences();
    const out=[]; let buf='';
    function flush(){if(buf.trim()){out.push(buf.trim());buf='';}}
    for(const s of sentences){
      if(byteLen(s)>MAX_REQUEST_BYTES){
        flush();
        // Should rarely happen because sentence splitting is conservative.
        for(const ss of splitLongLineToSentences(s)){out.push(ss);}
        continue;
      }
      const candidate=(buf?buf+' ': '')+s;
      if(byteLen(candidate)<=MAX_REQUEST_BYTES){buf=candidate;}
      else{flush();buf=s;}
    }
    flush();
    return out.filter(Boolean);
  }

  async function synthesize(text){
    const key=localStorage.getItem(KEY)||'';
    if(!key)throw new Error('請先設定 Google Cloud TTS API Key');
    if(byteLen(text)>5000)throw new Error('內部分段失敗：本段 '+byteLen(text)+' bytes，仍超過 5000 bytes');
    const s=load();
    const voiceName=s.voice||'en-US-Chirp3-HD-Aoede';
    const languageCode=voiceName.split('-').slice(0,2).join('-')||'en-US';
    const body={input:{text},voice:{languageCode,name:voiceName},audioConfig:{audioEncoding:'MP3',speakingRate:Number(s.rate||0.92)}};
    const res=await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const raw=await res.text();
    if(!res.ok)throw new Error('Google Cloud TTS '+res.status+': '+raw.slice(0,320));
    const data=JSON.parse(raw);
    if(!data.audioContent)throw new Error('Google Cloud TTS 回傳沒有 audioContent');
    const bin=atob(data.audioContent);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new Blob([bytes],{type:'audio/mpeg'});
  }

  function updateProgress(){
    const p=document.getElementById('gcttsProgress');
    const l=document.getElementById('gcttsProgressLabel');
    if(p){p.max=Math.max(0,chunks.length-1);p.value=chunkIndex;}
    if(l)l.textContent=(chunks.length?chunkIndex+1:0)+' / '+chunks.length;
  }
  async function playCurrent(){
    if(!chunks.length)return;
    playing=true;updateProgress();
    const b=byteLen(chunks[chunkIndex]);
    status('合成中：'+(chunkIndex+1)+' / '+chunks.length+' · '+b+' bytes');
    try{
      const blob=await synthesize(chunks[chunkIndex]);
      const url=URL.createObjectURL(blob);
      if(audio){audio.pause();audio=null;}
      audio=new Audio(url);
      audio.onended=()=>{URL.revokeObjectURL(url);if(!playing)return;chunkIndex++;if(chunkIndex>=chunks.length){playing=false;status('播放完成');updateProgress();return;}playCurrent();};
      audio.onerror=()=>{URL.revokeObjectURL(url);playing=false;status('播放失敗');};
      status('播放中：'+(chunkIndex+1)+' / '+chunks.length+' · '+b+' bytes');
      await audio.play();
    }catch(e){playing=false;status('TTS 失敗：'+e.message);console.error(e);}
  }
  function playAll(){
    chunks=buildRequestChunks();
    chunkIndex=0;
    if(!chunks.length)return alert('沒有可朗讀的文章。');
    console.log('Google Cloud TTS v3 chunks:',chunks.map((c,i)=>({i:i+1,bytes:byteLen(c),preview:c.slice(0,120)})));
    playCurrent();
  }
  function stop(){playing=false;if(audio){audio.pause();audio.currentTime=0;}status('已停止');}
  function pause(){if(audio){audio.pause();status('已暫停');}}
  function resume(){if(audio){audio.play();status('繼續播放');}}
  function seek(i){if(!chunks.length)return;chunkIndex=Math.max(0,Math.min(chunks.length-1,Number(i)||0));if(audio){audio.pause();}playCurrent();}
  function setKey(){const old=localStorage.getItem(KEY)||'';const k=prompt('貼上 Google Cloud Text-to-Speech API Key（只存本機 localStorage）',old);if(k===null)return;if(k.trim())localStorage.setItem(KEY,k.trim());else localStorage.removeItem(KEY);alert(k.trim()?'Google Cloud TTS Key 已儲存':'Google Cloud TTS Key 已清除');}
  function inject(){
    const old=document.getElementById('gcttsPanel'); if(old)old.remove();
    const p=document.createElement('div');p.id='gcttsPanel';
    p.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99989;background:#1f2937;color:#fff8e8;border-top:1px solid rgba(255,255,255,.18);padding:8px 10px;font:13px/1.45 Microsoft JhengHei,system-ui,sans-serif;box-shadow:0 -8px 28px rgba(0,0,0,.28)';
    const s=load();
    p.innerHTML=`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="color:#f4d27a">Google Cloud TTS 真人朗讀 v3</b><span id="gcttsStatus" style="flex:1;color:#d8cfbb;min-width:120px">待命</span><button id="gcttsKey">Key</button><button id="gcttsPlay">▶ 全文</button><button id="gcttsPause">暫停</button><button id="gcttsResume">繼續</button><button id="gcttsStop">停止</button></div><div style="display:flex;gap:8px;align-items:center;margin-top:6px"><input id="gcttsProgress" type="range" min="0" max="0" value="0" step="1" style="flex:1"><span id="gcttsProgressLabel">0 / 0</span></div><div style="display:flex;gap:8px;margin-top:6px"><select id="gcttsVoice" style="flex:1">${VOICES.map(v=>`<option value="${v[0]}" ${(s.voice||'en-US-Chirp3-HD-Aoede')===v[0]?'selected':''}>${v[1]} — ${v[0]}</option>`).join('')}</select><select id="gcttsRate"><option value="0.82" ${String(s.rate||0.92)==='0.82'?'selected':''}>慢</option><option value="0.92" ${String(s.rate||0.92)==='0.92'?'selected':''}>自然慢</option><option value="1" ${String(s.rate||0.92)==='1'?'selected':''}>正常</option><option value="1.12" ${String(s.rate||0.92)==='1.12'?'selected':''}>快</option></select></div>`;
    document.body.appendChild(p);document.body.style.paddingBottom='132px';
    document.getElementById('gcttsKey').onclick=setKey;
    document.getElementById('gcttsPlay').onclick=playAll;
    document.getElementById('gcttsPause').onclick=pause;
    document.getElementById('gcttsResume').onclick=resume;
    document.getElementById('gcttsStop').onclick=stop;
    document.getElementById('gcttsProgress').onchange=e=>seek(e.target.value);
    document.getElementById('gcttsVoice').onchange=e=>{const s=load();s.voice=e.target.value;save(s);};
    document.getElementById('gcttsRate').onchange=e=>{const s=load();s.rate=Number(e.target.value);save(s);};
    console.log('Google Cloud TTS reader patch v3 loaded');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
  window.openGoogleCloudTTSKey=setKey;
  window.googleCloudTTSPlayAll=playAll;
  window.googleCloudTTSSplitDebug=()=>buildRequestChunks().map((c,i)=>({i:i+1,bytes:byteLen(c),text:c}));
})();
