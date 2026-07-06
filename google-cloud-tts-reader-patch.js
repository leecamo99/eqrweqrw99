
/* google-cloud-tts-reader-patch.js v20260707-1
   Google Cloud Text-to-Speech reader for English Notebook.
   Uses Cloud Text-to-Speech REST v1 text:synthesize with API key.
   Key is stored in localStorage for personal use only.
   Install:
   <script src="./google-cloud-tts-reader-patch.js?v=20260707-1"></script>
*/
(function(){
  'use strict';
  const KEY='notebook_google_cloud_tts_key_v1';
  const SETTINGS='notebook_google_cloud_tts_settings_v1';
  let audio=null;
  let chunks=[];
  let chunkIndex=0;
  let playing=false;

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
  function esc(s){return String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));}
  function status(t){const el=document.getElementById('gcttsStatus');if(el)el.textContent=t||'';}
  function getArticleText(){
    return Array.from(document.querySelectorAll('.card .en')).map(en=>{
      const c=en.cloneNode(true);
      c.querySelectorAll('button,input,select,textarea,.note,.mynote').forEach(x=>x.remove());
      return (c.innerText||'').replace(/\s+/g,' ').trim();
    }).filter(Boolean).join('\n\n');
  }
  function splitText(text){
    const sentences=(text||'').replace(/\s+/g,' ').match(/[^.!?。！？]+[.!?。！？]?/g)||[];
    const out=[];let buf='';
    for(const s of sentences){
      if((buf+' '+s).length>900){if(buf.trim())out.push(buf.trim());buf=s;}else{buf+=(buf?' ':'')+s;}
    }
    if(buf.trim())out.push(buf.trim());
    return out.length?out:[text].filter(Boolean);
  }
  async function synthesize(text){
    const key=localStorage.getItem(KEY)||'';
    if(!key)throw new Error('請先設定 Google Cloud TTS API Key');
    const s=load();
    const voiceName=s.voice||'en-US-Chirp3-HD-Aoede';
    const languageCode=voiceName.split('-').slice(0,2).join('-')||'en-US';
    const body={
      input:{text},
      voice:{languageCode,name:voiceName},
      audioConfig:{audioEncoding:'MP3',speakingRate:Number(s.rate||0.92)}
    };
    const res=await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key='+encodeURIComponent(key),{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
    });
    const raw=await res.text();
    if(!res.ok)throw new Error('Google Cloud TTS '+res.status+': '+raw.slice(0,240));
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
    playing=true;updateProgress();status('合成中：'+(chunkIndex+1)+' / '+chunks.length);
    try{
      const blob=await synthesize(chunks[chunkIndex]);
      const url=URL.createObjectURL(blob);
      if(audio){audio.pause();audio=null;}
      audio=new Audio(url);
      audio.onended=()=>{URL.revokeObjectURL(url);if(!playing)return;chunkIndex++;if(chunkIndex>=chunks.length){playing=false;status('播放完成');updateProgress();return;}playCurrent();};
      audio.onerror=()=>{URL.revokeObjectURL(url);playing=false;status('播放失敗');};
      status('播放中：'+(chunkIndex+1)+' / '+chunks.length);
      await audio.play();
    }catch(e){playing=false;status('TTS 失敗：'+e.message);console.error(e);}
  }
  function playAll(){
    const t=getArticleText();
    if(!t)return alert('沒有可朗讀的文章。');
    chunks=splitText(t);chunkIndex=0;playCurrent();
  }
  function stop(){playing=false;if(audio){audio.pause();audio.currentTime=0;}status('已停止');}
  function pause(){if(audio){audio.pause();status('已暫停');}}
  function resume(){if(audio){audio.play();status('繼續播放');}}
  function seek(i){if(!chunks.length)return;chunkIndex=Math.max(0,Math.min(chunks.length-1,Number(i)||0));if(audio){audio.pause();}playCurrent();}
  function setKey(){const old=localStorage.getItem(KEY)||'';const k=prompt('貼上 Google Cloud Text-to-Speech API Key（只存本機 localStorage）',old);if(k===null)return;if(k.trim())localStorage.setItem(KEY,k.trim());else localStorage.removeItem(KEY);alert(k.trim()?'Google Cloud TTS Key 已儲存':'Google Cloud TTS Key 已清除');}
  function inject(){
    if(document.getElementById('gcttsPanel'))return;
    const p=document.createElement('div');p.id='gcttsPanel';
    p.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99989;background:#1f2937;color:#fff8e8;border-top:1px solid rgba(255,255,255,.18);padding:8px 10px;font:13px/1.45 Microsoft JhengHei,system-ui,sans-serif;box-shadow:0 -8px 28px rgba(0,0,0,.28)';
    const s=load();
    p.innerHTML=`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="color:#f4d27a">Google Cloud TTS 真人朗讀</b><span id="gcttsStatus" style="flex:1;color:#d8cfbb;min-width:120px">待命</span><button id="gcttsKey">Key</button><button id="gcttsPlay">▶ 全文</button><button id="gcttsPause">暫停</button><button id="gcttsResume">繼續</button><button id="gcttsStop">停止</button></div><div style="display:flex;gap:8px;align-items:center;margin-top:6px"><input id="gcttsProgress" type="range" min="0" max="0" value="0" step="1" style="flex:1"><span id="gcttsProgressLabel">0 / 0</span></div><div style="display:flex;gap:8px;margin-top:6px"><select id="gcttsVoice" style="flex:1">${VOICES.map(v=>`<option value="${v[0]}" ${(s.voice||'en-US-Chirp3-HD-Aoede')===v[0]?'selected':''}>${v[1]} — ${v[0]}</option>`).join('')}</select><select id="gcttsRate"><option value="0.82" ${String(s.rate||0.92)==='0.82'?'selected':''}>慢</option><option value="0.92" ${String(s.rate||0.92)==='0.92'?'selected':''}>自然慢</option><option value="1" ${String(s.rate||0.92)==='1'?'selected':''}>正常</option><option value="1.12" ${String(s.rate||0.92)==='1.12'?'selected':''}>快</option></select></div>`;
    document.body.appendChild(p);document.body.style.paddingBottom='132px';
    document.getElementById('gcttsKey').onclick=setKey;
    document.getElementById('gcttsPlay').onclick=playAll;
    document.getElementById('gcttsPause').onclick=pause;
    document.getElementById('gcttsResume').onclick=resume;
    document.getElementById('gcttsStop').onclick=stop;
    document.getElementById('gcttsProgress').onchange=e=>seek(e.target.value);
    document.getElementById('gcttsVoice').onchange=e=>{const s=load();s.voice=e.target.value;save(s);};
    document.getElementById('gcttsRate').onchange=e=>{const s=load();s.rate=Number(e.target.value);save(s);};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
  window.openGoogleCloudTTSKey=setKey;
  window.googleCloudTTSPlayAll=playAll;
})();
