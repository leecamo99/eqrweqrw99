
/* google-cloud-tts-reader-patch-v5.js v20260707-5
   Google Cloud TTS + approximate dynamic cursor + continuous progress bar.
   Fix from v4: progress bar now moves while audio is playing.
   - Progress max = total article words, not chunk count.
   - During playback, progress value follows estimated current word.
   - Dragging progress seeks to the chunk containing that word.
   Note: Google Cloud TTS REST returns audioContent only, no word timestamps; cursor is approximate.
   Install:
   <script src="./google-cloud-tts-reader-patch-v5.js?v=20260707-5"></script>
*/
(function(){
  'use strict';
  const KEY='notebook_google_cloud_tts_key_v1';
  const SETTINGS='notebook_google_cloud_tts_settings_v1';
  const MAX_REQUEST_BYTES=1800;
  const MAX_SENTENCE_BYTES=420;
  const enc=new TextEncoder();
  let audio=null, chunks=[], chunkIndex=0, playing=false, rafId=0;
  let words=[];

  const VOICES=[
    ['en-US-Chirp3-HD-Aoede','Chirp3 HD Aoede / Female'],
    ['en-US-Chirp3-HD-Charon','Chirp3 HD Charon / Male'],
    ['en-US-Chirp3-HD-Kore','Chirp3 HD Kore / Female'],
    ['en-US-Chirp3-HD-Puck','Chirp3 HD Puck / Male'],
    ['en-US-Chirp3-HD-Zephyr','Chirp3 HD Zephyr / Female'],
    ['en-US-Neural2-A','Neural2 A'],['en-US-Neural2-C','Neural2 C'],['en-US-Neural2-D','Neural2 D'],['en-US-Neural2-F','Neural2 F'],['en-US-Wavenet-D','WaveNet D'],['en-US-Wavenet-F','WaveNet F']
  ];
  function load(){try{return JSON.parse(localStorage.getItem(SETTINGS)||'{}')}catch(e){return {}}}
  function save(s){localStorage.setItem(SETTINGS,JSON.stringify(s||{}));}
  function byteLen(s){return enc.encode(String(s||'')).length;}
  function status(t){const el=document.getElementById('gcttsStatus');if(el)el.textContent=t||'';}
  function endsWithPunc(s){return /[.!?。！？]$/.test(String(s||'').trim());}
  function asSentence(s){s=String(s||'').replace(/\s+/g,' ').trim(); if(!s)return ''; return endsWithPunc(s)?s:s+'.';}

  function injectStyle(){
    if(document.getElementById('gcttsCursorStyle'))return;
    const s=document.createElement('style');
    s.id='gcttsCursorStyle';
    s.textContent=`
      .gctts-word{border-radius:3px;padding:0 1px;transition:background .08s,color .08s,box-shadow .08s;}
      .gctts-word.gctts-current{background:#f4d27a!important;color:#1f2937!important;box-shadow:0 0 0 2px rgba(244,210,122,.35);}
      .gctts-word.gctts-read{background:rgba(166,138,86,.12)!important;}
    `;
    document.head.appendChild(s);
  }
  function unwrapOld(root){
    root.querySelectorAll('.gctts-word').forEach(sp=>sp.replaceWith(document.createTextNode(sp.textContent)));
    root.normalize();
  }
  function wrapArticleWords(){
    words=[];
    document.querySelectorAll('.card .en').forEach(en=>{
      unwrapOld(en);
      const walker=document.createTreeWalker(en,NodeFilter.SHOW_TEXT,{acceptNode(node){
        if(!node.nodeValue||!node.nodeValue.trim())return NodeFilter.FILTER_REJECT;
        const p=node.parentElement;
        if(p&&p.closest('script,style,textarea,input,select,button,.note,.mynote,.study,.study-notes,#dock,#capBody'))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }});
      const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(node=>{
        const text=node.nodeValue;
        const frag=document.createDocumentFragment();
        let last=0; const re=/[A-Za-z]+(?:[’'][A-Za-z]+)?/g; let m;
        while((m=re.exec(text))){
          if(m.index>last)frag.appendChild(document.createTextNode(text.slice(last,m.index)));
          const sp=document.createElement('span');
          sp.className='gctts-word';
          sp.dataset.gcttsIndex=String(words.length);
          sp.textContent=m[0];
          frag.appendChild(sp);
          words.push({text:m[0],el:sp,index:words.length});
          last=re.lastIndex;
        }
        if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag,node);
      });
    });
  }
  function clearHighlight(){document.querySelectorAll('.gctts-current').forEach(x=>x.classList.remove('gctts-current'));}
  function updateProgressWord(idx){
    const p=document.getElementById('gcttsProgress');
    const l=document.getElementById('gcttsProgressLabel');
    if(p){p.max=Math.max(0,words.length-1);p.value=Math.max(0,Math.min(words.length-1,idx||0));}
    if(l)l.textContent=(words.length?Math.min(words.length,(idx||0)+1):0)+' / '+words.length;
  }
  function highlightWord(idx,scroll){
    if(!words.length)return;
    idx=Math.max(0,Math.min(words.length-1,idx));
    clearHighlight();
    for(let i=0;i<idx;i++)words[i]?.el?.classList.add('gctts-read');
    for(let i=idx;i<words.length;i++)words[i]?.el?.classList.remove('gctts-read');
    const el=words[idx]?.el;
    if(el){el.classList.add('gctts-current'); if(scroll)el.scrollIntoView({behavior:'smooth',block:'center'});}
    updateProgressWord(idx);
  }

  function splitLongLineToSentencesWithWords(line,startWordIndex){
    line=String(line||'').replace(/\s+/g,' ').trim(); if(!line)return [];
    const raw=line.match(/[^.!?。！？]+[.!?。！？]?/g)||[line];
    const result=[]; let cursor=startWordIndex;
    for(const piece0 of raw){
      let piece=String(piece0||'').trim(); if(!piece)continue;
      const pieceWords=piece.match(/[A-Za-z]+(?:[’'][A-Za-z]+)?/g)||[];
      if(byteLen(piece)<=MAX_SENTENCE_BYTES){result.push({text:asSentence(piece),start:cursor,end:cursor+pieceWords.length}); cursor+=pieceWords.length; continue;}
      let buf='', localStart=cursor, localCount=0;
      for(const w of piece.split(/\s+/)){
        const hasWord=/[A-Za-z]/.test(w); const candidate=(buf?buf+' ':'')+w;
        if(byteLen(candidate)<=MAX_SENTENCE_BYTES){buf=candidate;if(hasWord)localCount++;}
        else{if(buf)result.push({text:asSentence(buf),start:localStart,end:localStart+localCount}); localStart+=localCount; localCount=hasWord?1:0; buf=w;}
      }
      if(buf){result.push({text:asSentence(buf),start:localStart,end:localStart+localCount}); cursor=localStart+localCount;}
    }
    return result;
  }
  function buildSentencesFromDOM(){
    wrapArticleWords();
    const out=[]; let globalWord=0;
    document.querySelectorAll('.card .en').forEach(en=>{
      const c=en.cloneNode(true);
      c.querySelectorAll('button,input,select,textarea,.note,.mynote,.study,.study-notes,#dock,#capBody').forEach(x=>x.remove());
      const lines=(c.innerText||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
      for(const line of lines){
        const sentenceObjs=splitLongLineToSentencesWithWords(line,globalWord);
        out.push(...sentenceObjs);
        const lineWords=line.match(/[A-Za-z]+(?:[’'][A-Za-z]+)?/g)||[];
        globalWord+=lineWords.length;
      }
    });
    return out;
  }
  function buildChunks(){
    const sentences=buildSentencesFromDOM();
    const out=[]; let buf='', start=null, end=null;
    function flush(){if(buf.trim()){out.push({text:buf.trim(),start:start??0,end:end??start??0});buf='';start=null;end=null;}}
    for(const s of sentences){
      const candidate=(buf?buf+' ':'')+s.text;
      if(byteLen(candidate)<=MAX_REQUEST_BYTES){if(start===null)start=s.start; end=s.end; buf=candidate;}
      else{flush(); start=s.start; end=s.end; buf=s.text;}
    }
    flush(); return out.filter(x=>x.text);
  }
  function findChunkByWord(idx){
    if(!chunks.length)return 0;
    for(let i=0;i<chunks.length;i++){if(idx>=chunks[i].start && idx<chunks[i].end)return i;}
    return idx>=chunks[chunks.length-1].end ? chunks.length-1 : 0;
  }
  async function synthesize(text){
    const key=localStorage.getItem(KEY)||''; if(!key)throw new Error('請先設定 Google Cloud TTS API Key');
    const s=load(); const voiceName=s.voice||'en-US-Chirp3-HD-Aoede'; const languageCode=voiceName.split('-').slice(0,2).join('-')||'en-US';
    const body={input:{text},voice:{languageCode,name:voiceName},audioConfig:{audioEncoding:'MP3',speakingRate:Number(s.rate||0.92)}};
    const res=await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const raw=await res.text(); if(!res.ok)throw new Error('Google Cloud TTS '+res.status+': '+raw.slice(0,320));
    const data=JSON.parse(raw); if(!data.audioContent)throw new Error('Google Cloud TTS 回傳沒有 audioContent');
    const bin=atob(data.audioContent); const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new Blob([bytes],{type:'audio/mpeg'});
  }
  function cursorLoop(){
    if(!audio||!playing)return;
    const c=chunks[chunkIndex];
    if(c&&isFinite(audio.duration)&&audio.duration>0){
      const ratio=Math.max(0,Math.min(1,audio.currentTime/audio.duration));
      const count=Math.max(1,(c.end||c.start)-(c.start||0));
      const idx=(c.start||0)+Math.floor(ratio*count);
      highlightWord(idx,false);
    }
    rafId=requestAnimationFrame(cursorLoop);
  }
  function stopCursor(){if(rafId){cancelAnimationFrame(rafId);rafId=0;}}
  async function playCurrent(){
    if(!chunks.length)return;
    playing=true;
    const c=chunks[chunkIndex];
    highlightWord(c.start||0,true);
    status('合成中：'+(chunkIndex+1)+' / '+chunks.length+' · '+byteLen(c.text)+' bytes');
    try{
      const blob=await synthesize(c.text); const url=URL.createObjectURL(blob);
      if(audio){audio.pause();audio=null;}
      audio=new Audio(url);
      audio.onloadedmetadata=()=>{highlightWord(c.start||0,true);};
      audio.onplay=()=>{stopCursor();cursorLoop();}; audio.onpause=()=>stopCursor();
      audio.onended=()=>{URL.revokeObjectURL(url);stopCursor();if(!playing)return;highlightWord(Math.max(c.start,(c.end||c.start)-1),false);chunkIndex++;if(chunkIndex>=chunks.length){playing=false;status('播放完成');return;}playCurrent();};
      audio.onerror=()=>{URL.revokeObjectURL(url);stopCursor();playing=false;status('播放失敗');};
      status('播放中：'+(chunkIndex+1)+' / '+chunks.length+' · '+byteLen(c.text)+' bytes');
      await audio.play();
    }catch(e){playing=false;stopCursor();status('TTS 失敗：'+e.message);console.error(e);}
  }
  function playAll(){
    chunks=buildChunks(); chunkIndex=0;
    if(!chunks.length)return alert('沒有可朗讀的文章。');
    updateProgressWord(0);
    console.log('Google Cloud TTS v5 chunks:',chunks.map((c,i)=>({i:i+1,bytes:byteLen(c.text),start:c.start,end:c.end,preview:c.text.slice(0,100)})));
    playCurrent();
  }
  function stop(){playing=false;stopCursor();if(audio){audio.pause();audio.currentTime=0;}status('已停止');clearHighlight();updateProgressWord(0);}
  function pause(){if(audio){audio.pause();status('已暫停');}}
  function resume(){if(audio){audio.play();status('繼續播放');}}
  function seekWord(idx){
    idx=Math.max(0,Math.min(words.length-1,Number(idx)||0));
    if(!chunks.length)chunks=buildChunks();
    chunkIndex=findChunkByWord(idx);
    if(audio)audio.pause();
    highlightWord(idx,true);
    playCurrent();
  }
  function setKey(){const old=localStorage.getItem(KEY)||'';const k=prompt('貼上 Google Cloud Text-to-Speech API Key（只存本機 localStorage）',old);if(k===null)return;if(k.trim())localStorage.setItem(KEY,k.trim());else localStorage.removeItem(KEY);alert(k.trim()?'Google Cloud TTS Key 已儲存':'Google Cloud TTS Key 已清除');}
  function inject(){
    injectStyle(); const old=document.getElementById('gcttsPanel'); if(old)old.remove();
    const p=document.createElement('div'); p.id='gcttsPanel';
    p.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99989;background:#1f2937;color:#fff8e8;border-top:1px solid rgba(255,255,255,.18);padding:8px 10px;font:13px/1.45 Microsoft JhengHei,system-ui,sans-serif;box-shadow:0 -8px 28px rgba(0,0,0,.28)';
    const s=load();
    p.innerHTML=`
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <b style="color:#f4d27a;min-width:50px;">TTS v5</b>
        
        <!-- 中間區塊：語音選單、速度、進度條 -->
        <select id="gcttsVoice" style="max-width:150px;">${VOICES.map(v=>`<option value="${v[0]}" ${(s.voice||'en-US-Chirp3-HD-Aoede')===v[0]?'selected':''}>${v[1]}</option>`).join('')}</select>
        <select id="gcttsRate">
          <option value="0.82" ${String(s.rate||0.92)==='0.82'?'selected':''}>慢</option>
          <option value="0.92" ${String(s.rate||0.92)==='0.92'?'selected':''}>自然</option>
          <option value="1" ${String(s.rate||0.92)==='1'?'selected':''}>正常</option>
          <option value="1.12" ${String(s.rate||0.92)==='1.12'?'selected':''}>快</option>
        </select>
        <input id="gcttsProgress" type="range" min="0" max="0" value="0" step="1" style="flex:1">
        <span id="gcttsProgressLabel" style="min-width:60px;">0 / 0</span>

        <!-- 最後面區塊：狀態與操作按鈕 -->
        <div style="display:flex;gap:4px;margin-left:auto;align-items:center;">
          <span id="gcttsStatus" style="color:#d8cfbb;margin-right:10px;min-width:80px;text-align:right;">待命</span>
          <button id="gcttsKey">Key</button>
          <button id="gcttsPlay">▶ 全文</button>
          <button id="gcttsPause">暫停</button>
          <button id="gcttsResume">繼續</button>
          <button id="gcttsStop">停止</button>
        </div>
      </div>
    `;
    document.body.appendChild(p); document.body.style.paddingBottom='132px';
    document.getElementById('gcttsKey').onclick=setKey; document.getElementById('gcttsPlay').onclick=playAll; document.getElementById('gcttsPause').onclick=pause; document.getElementById('gcttsResume').onclick=resume; document.getElementById('gcttsStop').onclick=stop;
    const prog=document.getElementById('gcttsProgress');
    prog.oninput=e=>{if(!words.length)chunks=buildChunks(); const idx=Number(e.target.value)||0; highlightWord(idx,true);};
    prog.onchange=e=>seekWord(e.target.value);
    document.getElementById('gcttsVoice').onchange=e=>{const s=load();s.voice=e.target.value;save(s);};
    document.getElementById('gcttsRate').onchange=e=>{const s=load();s.rate=Number(e.target.value);save(s);};
    console.log('Google Cloud TTS reader patch v5 loaded');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
  window.openGoogleCloudTTSKey=setKey;
  window.googleCloudTTSPlayAll=playAll;
  window.googleCloudTTSSplitDebug=()=>{const cs=buildChunks();return cs.map((c,i)=>({i:i+1,bytes:byteLen(c.text),start:c.start,end:c.end,text:c.text}));};
})();
