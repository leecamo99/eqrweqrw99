
/* full-article-reader-patch.js v20260706-1
   One-button full article reader with dynamic word highlight + progress seek.
   Free: uses browser SpeechSynthesis / SpeechSynthesisUtterance.
   Features:
   - Play whole article from one button
   - Pause / resume / stop
   - Previous / next sentence-ish chunk
   - Progress slider: drag to any word position, release to continue from there
   - Dynamic highlight in article while reading via utterance boundary event
   - Keeps existing .mark click vocabulary behavior: nested tts spans still bubble clicks
   Install before </body> after your main app and vocabulary patches:
   <script src="./full-article-reader-patch.js?v=20260706-1"></script>
*/
(function(){
  'use strict';
  const SETTINGS='notebook_full_reader_settings_v1';
  let words=[];
  let chunks=[];
  let chunkIndex=0;
  let currentWordIndex=0;
  let reading=false;
  let paused=false;
  let currentUtterance=null;
  let voices=[];

  function loadSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS)||'{}')}catch(e){return {}}}
  function saveSettings(s){localStorage.setItem(SETTINGS,JSON.stringify(s||{}));}
  function esc(s){return String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));}
  function supported(){return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;}
  function status(t){const el=document.getElementById('readerStatus'); if(el)el.textContent=t||'';}

  function injectStyle(){
    if(document.getElementById('fullReaderStyle'))return;
    const s=document.createElement('style');
    s.id='fullReaderStyle';
    s.textContent=`
      .tts-word{border-radius:3px;padding:0 1px;transition:background .08s,color .08s,box-shadow .08s;}
      .tts-word.tts-current{background:#f4d27a!important;color:#1f2937!important;box-shadow:0 0 0 2px rgba(244,210,122,.35);}
      .tts-word.tts-read{background:rgba(166,138,86,.12)!important;}
      #readerProgress{width:100%;}
      #readerPanel .minirow{display:flex;gap:4px;align-items:center;}
      #readerPanel .minirow button{flex:1;}
    `;
    document.head.appendChild(s);
  }

  function getBestVoice(){
    const set=loadSettings();
    const list=voices.length?voices:speechSynthesis.getVoices();
    if(set.voiceURI){
      const v=list.find(x=>(x.voiceURI||x.name)===set.voiceURI);
      if(v)return v;
    }
    const preferred=['Jenny','Aria','Guy','Christopher','Michelle','Natural','Neural','Emma','Brian','Libby','Sonia','Ava','Samantha','Google US English','Microsoft'];
    for(const p of preferred){
      const v=list.find(x=>/^en[-_]/i.test(x.lang||'') && String(x.name||'').toLowerCase().includes(p.toLowerCase()));
      if(v)return v;
    }
    return list.find(x=>/^en[-_]/i.test(x.lang||'')) || list[0] || null;
  }

  function loadVoices(){
    if(!supported())return;
    voices=speechSynthesis.getVoices()||[];
    const sel=document.getElementById('readerVoice');
    if(!sel)return;
    const set=loadSettings();
    sel.innerHTML='<option value="">自動選擇英文聲音</option>'+voices.map(v=>{
      const id=v.voiceURI||v.name;
      return `<option value="${esc(id)}" ${set.voiceURI===id?'selected':''}>${esc(v.name)} (${esc(v.lang)})${v.default?' — default':''}</option>`;
    }).join('');
  }

  function injectUI(){
    if(document.getElementById('readerPanel'))return;
    const side=document.getElementById('side');
    if(!side)return;
    const set=loadSettings();
    const p=document.createElement('div');
    p.id='readerPanel';
    p.style.cssText='border:1px solid rgba(255,255,255,.15);padding:8px;margin:10px 0;font-size:12px;color:#e8e0cc';
    p.innerHTML=`
      <div style="color:var(--accent,#a68a56);letter-spacing:1px;margin-bottom:6px">全文動態朗讀</div>
      <button class="sidebtn hi" id="readerPlay">▶ 朗讀整篇文章</button>
      <div class="minirow">
        <button class="sidebtn" id="readerPause">暫停</button>
        <button class="sidebtn" id="readerResume">繼續</button>
        <button class="sidebtn" id="readerStop">停止</button>
      </div>
      <div class="minirow">
        <button class="sidebtn" id="readerPrev">上一段</button>
        <button class="sidebtn" id="readerNext">下一段</button>
      </div>
      <label style="display:block;margin-top:8px">進度：<span id="readerProgressLabel">0 / 0</span></label>
      <input id="readerProgress" type="range" min="0" max="0" value="0" step="1">
      <label style="display:block;margin-top:8px">聲音</label>
      <select id="readerVoice" style="width:100%;font-size:12px"></select>
      <label style="display:block;margin-top:8px">語速 <span id="readerRateVal"></span></label>
      <input id="readerRate" type="range" min="0.55" max="1.35" step="0.05" style="width:100%">
      <div id="readerStatus" style="margin-top:8px;color:#cfc6b2">待命</div>`;
    const hr=side.querySelector('hr');
    side.insertBefore(p,hr?hr.nextSibling:side.firstChild);
    document.getElementById('readerPlay').onclick=()=>startFrom(currentWordIndex||0);
    document.getElementById('readerPause').onclick=pause;
    document.getElementById('readerResume').onclick=resume;
    document.getElementById('readerStop').onclick=stop;
    document.getElementById('readerPrev').onclick=prevChunk;
    document.getElementById('readerNext').onclick=nextChunk;
    const rate=document.getElementById('readerRate');
    rate.value=set.rate||0.88;
    document.getElementById('readerRateVal').textContent=rate.value;
    rate.oninput=e=>{const s=loadSettings();s.rate=Number(e.target.value);saveSettings(s);document.getElementById('readerRateVal').textContent=e.target.value;};
    document.getElementById('readerVoice').onchange=e=>{const s=loadSettings();s.voiceURI=e.target.value;saveSettings(s);};
    const prog=document.getElementById('readerProgress');
    prog.oninput=e=>{const idx=Number(e.target.value||0);highlightWord(idx,true);updateProgressLabel(idx);status('定位到第 '+(idx+1)+' 個字，放開後可從此處朗讀');};
    prog.onchange=e=>{const idx=Number(e.target.value||0);seekTo(idx,reading);};
    loadVoices();
  }

  function unwrapOldTTS(root){
    // Avoid nested wrapping when article is re-rendered.
    root.querySelectorAll('.tts-word').forEach(sp=>{
      sp.replaceWith(document.createTextNode(sp.textContent));
    });
    root.normalize();
  }

  function prepareArticle(){
    words=[]; chunks=[]; clearHighlight();
    const ens=Array.from(document.querySelectorAll('.card .en'));
    let global=0;
    ens.forEach(en=>{
      unwrapOldTTS(en);
      const walker=document.createTreeWalker(en,NodeFilter.SHOW_TEXT,{acceptNode(node){
        if(!node.nodeValue || !node.nodeValue.trim())return NodeFilter.FILTER_REJECT;
        const parent=node.parentElement;
        if(parent && parent.closest('script,style,textarea,input,select,button'))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }});
      const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(node=>{
        const text=node.nodeValue;
        const frag=document.createDocumentFragment();
        let last=0;
        // English words + contractions. Keep punctuation as text nodes.
        const re=/[A-Za-z]+(?:[’'][A-Za-z]+)?/g;
        let m;
        while((m=re.exec(text))){
          if(m.index>last)frag.appendChild(document.createTextNode(text.slice(last,m.index)));
          const sp=document.createElement('span');
          sp.className='tts-word';
          sp.dataset.ttsIndex=String(global);
          sp.textContent=m[0];
          frag.appendChild(sp);
          words.push({text:m[0],el:sp,index:global});
          global++;
          last=re.lastIndex;
        }
        if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag,node);
      });
    });
    buildChunks();
    const prog=document.getElementById('readerProgress');
    if(prog){prog.max=Math.max(0,words.length-1);prog.value=Math.min(currentWordIndex,Math.max(0,words.length-1));}
    updateProgressLabel(Number(prog?.value||0));
    return words.length;
  }

  function buildChunks(){
    chunks=[];
    if(!words.length)return;
    let start=0;
    const maxWords=55;
    while(start<words.length){
      let end=Math.min(words.length,start+maxWords);
      // Try to stop near punctuation after at least 25 words.
      for(let i=start+25;i<Math.min(words.length,start+maxWords);i++){
        const after=words[i].el.nextSibling && words[i].el.nextSibling.textContent || '';
        if(/[.!?。！？]/.test(after)){end=i+1;break;}
      }
      const text=words.slice(start,end).map(w=>w.text).join(' ');
      const offsets=[]; let pos=0;
      for(let i=start;i<end;i++){
        offsets.push({char:pos,index:i});
        pos+=words[i].text.length+1;
      }
      chunks.push({start,end,text,offsets});
      start=end;
    }
  }

  function findChunkByWordIndex(idx){
    if(!chunks.length)return 0;
    const c=chunks.findIndex(x=>idx>=x.start && idx<x.end);
    return c>=0?c:Math.max(0,Math.min(chunks.length-1,chunkIndex));
  }

  function updateProgressLabel(idx){
    const label=document.getElementById('readerProgressLabel');
    if(label)label.textContent=`${Math.min(idx+1,words.length)} / ${words.length}`;
  }
  function clearHighlight(){
    document.querySelectorAll('.tts-word.tts-current').forEach(x=>x.classList.remove('tts-current'));
  }
  function highlightWord(idx,scroll){
    if(!words.length)return;
    idx=Math.max(0,Math.min(words.length-1,idx));
    currentWordIndex=idx;
    document.querySelectorAll('.tts-word.tts-current').forEach(x=>x.classList.remove('tts-current'));
    for(let i=0;i<idx;i++)words[i]?.el?.classList.add('tts-read');
    for(let i=idx;i<words.length;i++)words[i]?.el?.classList.remove('tts-read');
    const el=words[idx]&&words[idx].el;
    if(el){
      el.classList.add('tts-current');
      if(scroll)el.scrollIntoView({behavior:'smooth',block:'center'});
    }
    const prog=document.getElementById('readerProgress'); if(prog)prog.value=idx;
    updateProgressLabel(idx);
  }

  function makeUtterance(chunk){
    const set=loadSettings();
    const u=new SpeechSynthesisUtterance(chunk.text);
    u.lang='en-US';
    u.rate=Number(set.rate||0.88);
    u.pitch=1.0;u.volume=1;
    const v=getBestVoice(); if(v)u.voice=v;
    u.onstart=()=>{highlightWord(chunk.start,true);status(`朗讀中：${chunkIndex+1} / ${chunks.length}`);};
    u.onboundary=(e)=>{
      if(typeof e.charIndex!=='number')return;
      let local=0;
      for(let i=0;i<chunk.offsets.length;i++){
        if(chunk.offsets[i].char<=e.charIndex)local=i; else break;
      }
      const idx=chunk.offsets[local]?.index ?? chunk.start;
      highlightWord(idx,false);
    };
    u.onend=()=>{
      if(!reading)return;
      chunkIndex++;
      if(chunkIndex>=chunks.length){reading=false;paused=false;status('朗讀完成');highlightWord(words.length-1,false);return;}
      speakCurrentChunk();
    };
    u.onerror=(e)=>{console.warn('reader speech error',e);status('朗讀錯誤，已停止');reading=false;paused=false;};
    return u;
  }

  function speakCurrentChunk(){
    if(!supported())return alert('此瀏覽器不支援語音朗讀。');
    if(!chunks.length){if(!prepareArticle())return alert('目前沒有可朗讀的英文文章。');}
    speechSynthesis.cancel();
    const chunk=chunks[chunkIndex];
    currentUtterance=makeUtterance(chunk);
    speechSynthesis.speak(currentUtterance);
  }

  function startFrom(idx){
    if(!supported())return alert('此瀏覽器不支援語音朗讀。');
    if(!prepareArticle())return alert('目前沒有可朗讀的英文文章。');
    idx=Math.max(0,Math.min(words.length-1,idx||0));
    currentWordIndex=idx;
    chunkIndex=findChunkByWordIndex(idx);
    // If user seeks inside a chunk, rebuild a temporary first chunk from exact word.
    if(idx>chunks[chunkIndex].start){
      const original=chunks[chunkIndex];
      const end=original.end;
      const text=words.slice(idx,end).map(w=>w.text).join(' ');
      const offsets=[]; let pos=0;
      for(let i=idx;i<end;i++){offsets.push({char:pos,index:i});pos+=words[i].text.length+1;}
      chunks[chunkIndex]={start:idx,end,text,offsets,_temp:true,_original:original};
    }
    reading=true;paused=false;
    highlightWord(idx,true);
    speakCurrentChunk();
  }

  function seekTo(idx,continuePlay){
    if(!words.length)prepareArticle();
    idx=Math.max(0,Math.min(words.length-1,idx||0));
    speechSynthesis.cancel();
    currentWordIndex=idx;
    chunkIndex=findChunkByWordIndex(idx);
    highlightWord(idx,true);
    if(continuePlay){reading=true;paused=false;startFrom(idx);}else{reading=false;paused=false;status('已定位到第 '+(idx+1)+' 個字');}
  }

  function pause(){if(supported()){speechSynthesis.pause();paused=true;status('已暫停');}}
  function resume(){if(supported()){speechSynthesis.resume();paused=false;reading=true;status('繼續朗讀');}}
  function stop(){if(supported())speechSynthesis.cancel();reading=false;paused=false;status('已停止');clearHighlight();}
  function nextChunk(){if(!words.length)prepareArticle();chunkIndex=Math.min(chunks.length-1,chunkIndex+1);seekTo(chunks[chunkIndex]?.start||0,reading);}
  function prevChunk(){if(!words.length)prepareArticle();chunkIndex=Math.max(0,chunkIndex-1);seekTo(chunks[chunkIndex]?.start||0,reading);}

  function boot(){
    injectStyle();injectUI();
    if(supported()){
      loadVoices();
      if('onvoiceschanged' in speechSynthesis)speechSynthesis.onvoiceschanged=loadVoices;
    }
    console.log('Full article reader patch loaded');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.fullReaderPlay=()=>startFrom(currentWordIndex||0);
  window.fullReaderStop=stop;
  window.fullReaderSeek=idx=>seekTo(Number(idx||0),reading);
})();
