
/* full-article-reader-bottom-patch.js v20260706-1
   Bottom floating player for English Notebook full article reading.
   Replaces/augments full-article-reader-patch.js UI with a mobile-friendly bottom player.
   Features:
   - Fixed bottom player, no need to open side menu on phone
   - Expand / collapse
   - Play whole article, pause, resume, stop
   - Previous / next chunk
   - Progress slider seek to any word
   - Dynamic word highlight in article while reading
   - Uses free browser SpeechSynthesis / SpeechSynthesisUtterance
   Install after vocabulary patches, and remove old realistic-tts-patch.js / full-article-reader-patch.js if you don't want duplicate panels:
   <script src="./full-article-reader-bottom-patch.js?v=20260706-1"></script>
*/
(function(){
  'use strict';
  const SETTINGS='notebook_bottom_reader_settings_v1';
  let words=[];
  let chunks=[];
  let chunkIndex=0;
  let currentWordIndex=0;
  let reading=false;
  let paused=false;
  let voices=[];

  function loadSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS)||'{}')}catch(e){return {}}}
  function saveSettings(s){localStorage.setItem(SETTINGS,JSON.stringify(s||{}));}
  function esc(s){return String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));}
  function supported(){return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;}
  function status(t){const el=document.getElementById('brStatus'); if(el)el.textContent=t||'';}

  function injectStyle(){
    if(document.getElementById('bottomReaderStyle'))return;
    const s=document.createElement('style');
    s.id='bottomReaderStyle';
    s.textContent=`
      body{padding-bottom:96px;}
      .tts-word{border-radius:3px;padding:0 1px;transition:background .08s,color .08s,box-shadow .08s;}
      .tts-word.tts-current{background:#f4d27a!important;color:#1f2937!important;box-shadow:0 0 0 2px rgba(244,210,122,.35);}
      .tts-word.tts-read{background:rgba(166,138,86,.12)!important;}
      #bottomReader{position:fixed;left:0;right:0;bottom:0;z-index:99990;background:rgba(37,50,65,.97);color:#fff8e8;border-top:1px solid rgba(255,255,255,.18);box-shadow:0 -8px 28px rgba(0,0,0,.26);font:13px/1.45 Microsoft JhengHei,system-ui,sans-serif;}
      #bottomReader *{box-sizing:border-box;}
      #bottomReaderHeader{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.12);}
      #bottomReaderTitle{font-weight:700;color:#f4d27a;white-space:nowrap;}
      #brStatus{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d8cfbb;font-size:12px;}
      #brToggle{border:1px solid rgba(255,255,255,.28);background:transparent;color:#fff8e8;border-radius:5px;padding:4px 8px;cursor:pointer;}
      #bottomReaderBody{padding:8px 10px;display:block;}
      #bottomReader.collapsed #bottomReaderBody{display:none;}
      #bottomReader.collapsed{width:auto;left:auto;right:10px;bottom:10px;border:1px solid rgba(255,255,255,.25);border-radius:999px;overflow:hidden;}
      #bottomReader.collapsed #bottomReaderHeader{border-bottom:0;padding:6px 8px;}
      #bottomReader.collapsed #bottomReaderTitle{display:none;}
      #bottomReader.collapsed #brStatus{max-width:150px;}
      .br-row{display:flex;align-items:center;gap:6px;margin:5px 0;}
      .br-btn{border:1px solid rgba(255,255,255,.24);background:transparent;color:#fff8e8;border-radius:6px;padding:7px 9px;cursor:pointer;min-width:42px;}
      .br-btn.primary{background:#a68a56;border-color:#c9aa6b;color:#1f2937;font-weight:700;}
      #brProgress{width:100%;accent-color:#f4d27a;}
      #brProgressLabel{min-width:78px;text-align:right;color:#d8cfbb;font-size:12px;}
      #brVoice,#brRate{background:#2f3f52;color:#fff8e8;border:1px solid rgba(255,255,255,.22);border-radius:5px;padding:5px;width:100%;}
      .br-small{font-size:12px;color:#d8cfbb;white-space:nowrap;}
      @media(max-width:820px){
        body{padding-bottom:124px;}
        #bottomReader{font-size:12px;}
        #bottomReaderBody{padding:7px 8px;}
        .br-row{gap:4px;margin:4px 0;}
        .br-btn{padding:7px 8px;min-width:38px;}
        #brVoice{max-width:100%;}
        .br-mobile-stack{display:grid;grid-template-columns:1fr 80px;gap:6px;align-items:center;}
      }
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
    const sel=document.getElementById('brVoice');
    if(!sel)return;
    const set=loadSettings();
    sel.innerHTML='<option value="">自動選擇英文聲音</option>'+voices.map(v=>{
      const id=v.voiceURI||v.name;
      return `<option value="${esc(id)}" ${set.voiceURI===id?'selected':''}>${esc(v.name)} (${esc(v.lang)})${v.default?' — default':''}</option>`;
    }).join('');
  }

  function injectUI(){
    if(document.getElementById('bottomReader'))return;
    const set=loadSettings();
    const p=document.createElement('div');
    p.id='bottomReader';
    if(set.collapsed)p.classList.add('collapsed');
    p.innerHTML=`
      <div id="bottomReaderHeader">
        <span id="bottomReaderTitle">全文動態朗讀</span>
        <span id="brStatus">待命</span>
        <button id="brToggle" title="縮小/放大">${set.collapsed?'放大':'縮小'}</button>
      </div>
      <div id="bottomReaderBody">
        <div class="br-row">
          <button class="br-btn primary" id="brPlay">▶</button>
          <button class="br-btn" id="brPause">暫停</button>
          <button class="br-btn" id="brResume">繼續</button>
          <button class="br-btn" id="brStop">停止</button>
          <button class="br-btn" id="brPrev">上一段</button>
          <button class="br-btn" id="brNext">下一段</button>
        </div>
        <div class="br-row">
          <input id="brProgress" type="range" min="0" max="0" value="0" step="1">
          <span id="brProgressLabel">0 / 0</span>
        </div>
        <div class="br-row br-mobile-stack">
          <select id="brVoice"></select>
          <select id="brRate">
            ${[['0.70','慢速'],['0.82','學習'],['0.88','自然慢'],['1.00','正常'],['1.15','快速']].map(([v,t])=>`<option value="${v}" ${String(set.rate||0.88)===v?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>`;
    document.body.appendChild(p);
    document.getElementById('brToggle').onclick=()=>{
      const s=loadSettings();
      const el=document.getElementById('bottomReader');
      el.classList.toggle('collapsed');
      s.collapsed=el.classList.contains('collapsed');
      saveSettings(s);
      document.getElementById('brToggle').textContent=s.collapsed?'放大':'縮小';
    };
    document.getElementById('brPlay').onclick=()=>startFrom(currentWordIndex||0);
    document.getElementById('brPause').onclick=pause;
    document.getElementById('brResume').onclick=resume;
    document.getElementById('brStop').onclick=stop;
    document.getElementById('brPrev').onclick=prevChunk;
    document.getElementById('brNext').onclick=nextChunk;
    document.getElementById('brRate').onchange=e=>{const s=loadSettings();s.rate=Number(e.target.value);saveSettings(s);};
    document.getElementById('brVoice').onchange=e=>{const s=loadSettings();s.voiceURI=e.target.value;saveSettings(s);};
    const prog=document.getElementById('brProgress');
    prog.oninput=e=>{const idx=Number(e.target.value||0);highlightWord(idx,true);updateProgressLabel(idx);status('定位到第 '+(idx+1)+' 個字');};
    prog.onchange=e=>{const idx=Number(e.target.value||0);seekTo(idx,reading);};
    loadVoices();
  }

  function unwrapOldTTS(root){
    root.querySelectorAll('.tts-word').forEach(sp=>sp.replaceWith(document.createTextNode(sp.textContent)));
    root.normalize();
  }

  function prepareArticle(){
    words=[];chunks=[];clearHighlight();
    const ens=Array.from(document.querySelectorAll('.card .en'));
    let global=0;
    ens.forEach(en=>{
      unwrapOldTTS(en);
      const walker=document.createTreeWalker(en,NodeFilter.SHOW_TEXT,{acceptNode(node){
        if(!node.nodeValue||!node.nodeValue.trim())return NodeFilter.FILTER_REJECT;
        const parent=node.parentElement;
        if(parent&&parent.closest('script,style,textarea,input,select,button'))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }});
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(node=>{
        const text=node.nodeValue;
        const frag=document.createDocumentFragment();
        let last=0;
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
    const prog=document.getElementById('brProgress');
    if(prog){prog.max=Math.max(0,words.length-1);prog.value=Math.min(currentWordIndex,Math.max(0,words.length-1));}
    updateProgressLabel(Number(prog?.value||0));
    return words.length;
  }

  function buildChunks(){
    chunks=[];
    let start=0;
    const maxWords=55;
    while(start<words.length){
      let end=Math.min(words.length,start+maxWords);
      for(let i=start+25;i<Math.min(words.length,start+maxWords);i++){
        const after=words[i].el.nextSibling&&words[i].el.nextSibling.textContent||'';
        if(/[.!?。！？]/.test(after)){end=i+1;break;}
      }
      const text=words.slice(start,end).map(w=>w.text).join(' ');
      const offsets=[];let pos=0;
      for(let i=start;i<end;i++){offsets.push({char:pos,index:i});pos+=words[i].text.length+1;}
      chunks.push({start,end,text,offsets});
      start=end;
    }
  }

  function findChunkByWordIndex(idx){
    if(!chunks.length)return 0;
    const c=chunks.findIndex(x=>idx>=x.start&&idx<x.end);
    return c>=0?c:Math.max(0,Math.min(chunks.length-1,chunkIndex));
  }
  function updateProgressLabel(idx){const label=document.getElementById('brProgressLabel');if(label)label.textContent=`${Math.min(idx+1,words.length)} / ${words.length}`;}
  function clearHighlight(){document.querySelectorAll('.tts-word.tts-current').forEach(x=>x.classList.remove('tts-current'));}
  function highlightWord(idx,scroll){
    if(!words.length)return;
    idx=Math.max(0,Math.min(words.length-1,idx));
    currentWordIndex=idx;
    document.querySelectorAll('.tts-word.tts-current').forEach(x=>x.classList.remove('tts-current'));
    for(let i=0;i<idx;i++)words[i]?.el?.classList.add('tts-read');
    for(let i=idx;i<words.length;i++)words[i]?.el?.classList.remove('tts-read');
    const el=words[idx]&&words[idx].el;
    if(el){el.classList.add('tts-current');if(scroll)el.scrollIntoView({behavior:'smooth',block:'center'});}
    const prog=document.getElementById('brProgress');if(prog)prog.value=idx;
    updateProgressLabel(idx);
  }
  function makeUtterance(chunk){
    const set=loadSettings();
    const u=new SpeechSynthesisUtterance(chunk.text);
    u.lang='en-US';u.rate=Number(set.rate||0.88);u.pitch=1;u.volume=1;
    const v=getBestVoice();if(v)u.voice=v;
    u.onstart=()=>{highlightWord(chunk.start,true);status(`朗讀中：${chunkIndex+1} / ${chunks.length}`);};
    u.onboundary=(e)=>{
      if(typeof e.charIndex!=='number')return;
      let local=0;
      for(let i=0;i<chunk.offsets.length;i++){if(chunk.offsets[i].char<=e.charIndex)local=i;else break;}
      const idx=chunk.offsets[local]?.index??chunk.start;
      highlightWord(idx,false);
    };
    u.onend=()=>{
      if(!reading)return;
      chunkIndex++;
      if(chunkIndex>=chunks.length){reading=false;paused=false;status('朗讀完成');highlightWord(words.length-1,false);return;}
      speakCurrentChunk();
    };
    u.onerror=(e)=>{console.warn('bottom reader speech error',e);status('朗讀錯誤，已停止');reading=false;paused=false;};
    return u;
  }
  function speakCurrentChunk(){
    if(!supported())return alert('此瀏覽器不支援語音朗讀。');
    if(!chunks.length){if(!prepareArticle())return alert('目前沒有可朗讀的英文文章。');}
    speechSynthesis.cancel();
    const chunk=chunks[chunkIndex];
    speechSynthesis.speak(makeUtterance(chunk));
  }
  function startFrom(idx){
    if(!supported())return alert('此瀏覽器不支援語音朗讀。');
    if(!prepareArticle())return alert('目前沒有可朗讀的英文文章。');
    idx=Math.max(0,Math.min(words.length-1,idx||0));
    currentWordIndex=idx;
    chunkIndex=findChunkByWordIndex(idx);
    if(idx>chunks[chunkIndex].start){
      const original=chunks[chunkIndex];
      const end=original.end;
      const text=words.slice(idx,end).map(w=>w.text).join(' ');
      const offsets=[];let pos=0;
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

  function removeOldSideReader(){
    // Hide older side panels to reduce mobile clutter.
    const old1=document.getElementById('readerPanel'); if(old1)old1.style.display='none';
    const old2=document.getElementById('ttsPanel'); if(old2)old2.style.display='none';
  }
  function boot(){
    injectStyle();
    injectUI();
    removeOldSideReader();
    if(supported()){
      loadVoices();
      if('onvoiceschanged' in speechSynthesis)speechSynthesis.onvoiceschanged=loadVoices;
    }
    console.log('Bottom full article reader patch loaded');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.bottomReaderPlay=()=>startFrom(currentWordIndex||0);
  window.bottomReaderStop=stop;
  window.bottomReaderSeek=idx=>seekTo(Number(idx||0),reading);
})();
