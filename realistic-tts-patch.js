
/* realistic-tts-patch.js v20260706-2
   Free Microsoft/Browser TTS for English Notebook.
   Adds: read current paragraph, read all article, read selected text, pause/resume/stop,
   voice selector, speed/pitch controls, and word pronunciation button in WORD NOTE.
   Install before </body>:
   <script src="./realistic-tts-patch.js?v=20260706-2"></script>
*/
(function(){
  'use strict';
  const STORE='notebook_tts_settings_v1';
  let voices=[];
  let currentUtterance=null;
  let currentQueue=[];
  let isReading=false;

  function loadSettings(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return {}}}
  function saveSettings(s){localStorage.setItem(STORE,JSON.stringify(s||{}));}
  function esc(s){return String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));}
  function supported(){return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;}

  function getBestEnglishVoice(){
    const s=loadSettings();
    const list=voices.length?voices:window.speechSynthesis.getVoices();
    if(s.voiceURI){
      const v=list.find(x=>x.voiceURI===s.voiceURI || x.name===s.voiceURI);
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
    voices=window.speechSynthesis.getVoices()||[];
    renderVoiceOptions();
  }

  function renderVoiceOptions(){
    const sel=document.getElementById('ttsVoice');
    if(!sel)return;
    const s=loadSettings();
    const current=s.voiceURI||'';
    sel.innerHTML='<option value="">自動選擇英文聲音</option>'+voices.map(v=>`<option value="${esc(v.voiceURI||v.name)}" ${current===(v.voiceURI||v.name)?'selected':''}>${esc(v.name)} (${esc(v.lang)})${v.default?' — default':''}</option>`).join('');
  }

  function getTextFromElement(el){
    if(!el)return '';
    const c=el.cloneNode(true);
    c.querySelectorAll('.note,button,input,select,textarea,.mynote').forEach(x=>x.remove());
    return (c.innerText||'').replace(/\s+/g,' ').trim();
  }
  function getCurrentChapterText(){
    const visibleCard=document.querySelector('.card');
    return getTextFromElement(visibleCard&&visibleCard.querySelector('.en'));
  }
  function getAllArticleText(){
    return Array.from(document.querySelectorAll('.card .en')).map(getTextFromElement).filter(Boolean).join('\n\n');
  }
  function splitText(text){
    const sentences=(text||'').replace(/\s+/g,' ').match(/[^.!?。！？]+[.!?。！？]?/g)||[];
    const chunks=[]; let buf='';
    for(const s of sentences){
      if((buf+' '+s).length>220){if(buf.trim())chunks.push(buf.trim());buf=s;}else{buf+=(buf?' ':'')+s;}
    }
    if(buf.trim())chunks.push(buf.trim());
    return chunks.length?chunks:[text].filter(Boolean);
  }

  function makeUtterance(text){
    const s=loadSettings();
    const u=new SpeechSynthesisUtterance(text);
    u.lang=s.lang||'en-US';
    u.rate=Number(s.rate||0.88);
    u.pitch=Number(s.pitch||1.0);
    u.volume=Number(s.volume||1.0);
    const v=getBestEnglishVoice();
    if(v)u.voice=v;
    return u;
  }
  function updateStatus(t){const el=document.getElementById('ttsStatus');if(el)el.textContent=t||'';}

  function speakQueue(chunks){
    if(!supported()){alert('此瀏覽器不支援 Web Speech 語音合成。');return;}
    stopTTS();
    currentQueue=[...chunks];
    isReading=true;
    updateStatus('朗讀中...');
    playNext();
  }
  function playNext(){
    if(!isReading)return;
    const next=currentQueue.shift();
    if(!next){isReading=false;currentUtterance=null;updateStatus('朗讀完成');return;}
    const u=makeUtterance(next);
    currentUtterance=u;
    u.onstart=()=>updateStatus('朗讀中：'+next.slice(0,50)+(next.length>50?'...':''));
    u.onend=()=>playNext();
    u.onerror=(e)=>{console.warn('TTS error',e);updateStatus('語音發生錯誤，已停止');isReading=false;};
    window.speechSynthesis.speak(u);
  }
  function stopTTS(){if(supported())window.speechSynthesis.cancel();currentQueue=[];currentUtterance=null;isReading=false;updateStatus('已停止');}
  function pauseTTS(){if(supported()){window.speechSynthesis.pause();updateStatus('已暫停');}}
  function resumeTTS(){if(supported()){window.speechSynthesis.resume();updateStatus('繼續朗讀');}}
  function readSelectedText(){const text=String(window.getSelection&&window.getSelection().toString()||'').trim();if(!text){alert('請先選取要朗讀的文字。');return;}speakQueue(splitText(text));}
  function readCurrentChapter(){const text=getCurrentChapterText();if(!text){alert('目前沒有可朗讀的文章段落。');return;}speakQueue(splitText(text));}
  function readAll(){const text=getAllArticleText();if(!text){alert('目前沒有可朗讀的文章。');return;}speakQueue(splitText(text));}
  function readWord(word){if(!word)return;speakQueue([String(word)]);}

  function injectUI(){
    if(document.getElementById('ttsPanel'))return;
    const side=document.getElementById('side');
    if(!side)return;
    const panel=document.createElement('div');
    panel.id='ttsPanel';
    panel.style.cssText='border:1px solid rgba(255,255,255,.15);padding:8px;margin:10px 0;font-size:12px;color:#e8e0cc';
    panel.innerHTML=`
      <div style="color:var(--accent,#a68a56);letter-spacing:1px;margin-bottom:6px">免費語音朗讀</div>
      <button class="sidebtn" id="ttsReadChapter">朗讀目前段落</button>
      <button class="sidebtn" id="ttsReadAll">朗讀全文</button>
      <button class="sidebtn" id="ttsReadSelected">朗讀選取文字</button>
      <button class="sidebtn" id="ttsPause">暫停</button>
      <button class="sidebtn" id="ttsResume">繼續</button>
      <button class="sidebtn" id="ttsStop">停止</button>
      <label style="display:block;margin-top:8px">聲音</label>
      <select id="ttsVoice" style="width:100%;font-size:12px"></select>
      <label style="display:block;margin-top:8px">語速 <span id="ttsRateVal"></span></label>
      <input id="ttsRate" type="range" min="0.55" max="1.35" step="0.05" style="width:100%">
      <label style="display:block;margin-top:8px">音高 <span id="ttsPitchVal"></span></label>
      <input id="ttsPitch" type="range" min="0.75" max="1.25" step="0.05" style="width:100%">
      <div id="ttsStatus" style="margin-top:8px;color:#cfc6b2">待命</div>`;
    const hr=side.querySelector('hr');
    side.insertBefore(panel,hr?hr.nextSibling:side.firstChild);
    const s=loadSettings();
    document.getElementById('ttsRate').value=s.rate||0.88;
    document.getElementById('ttsPitch').value=s.pitch||1.0;
    document.getElementById('ttsRateVal').textContent=document.getElementById('ttsRate').value;
    document.getElementById('ttsPitchVal').textContent=document.getElementById('ttsPitch').value;
    document.getElementById('ttsReadChapter').onclick=readCurrentChapter;
    document.getElementById('ttsReadAll').onclick=readAll;
    document.getElementById('ttsReadSelected').onclick=readSelectedText;
    document.getElementById('ttsPause').onclick=pauseTTS;
    document.getElementById('ttsResume').onclick=resumeTTS;
    document.getElementById('ttsStop').onclick=stopTTS;
    document.getElementById('ttsVoice').onchange=e=>{const s=loadSettings();s.voiceURI=e.target.value;saveSettings(s);};
    document.getElementById('ttsRate').oninput=e=>{const s=loadSettings();s.rate=Number(e.target.value);saveSettings(s);document.getElementById('ttsRateVal').textContent=e.target.value;};
    document.getElementById('ttsPitch').oninput=e=>{const s=loadSettings();s.pitch=Number(e.target.value);saveSettings(s);document.getElementById('ttsPitchVal').textContent=e.target.value;};
    renderVoiceOptions();
  }

  function patchWordNoteSpeak(){
    const obs=new MutationObserver(()=>{
      const body=document.getElementById('dockBody');
      if(!body || document.getElementById('ttsSpeakWordBtn'))return;
      const first=body.querySelector('.wordbig');
      if(!first)return;
      const b=document.createElement('button');
      b.id='ttsSpeakWordBtn';b.className='btn';b.textContent='🔊 單字發音';
      b.onclick=()=>readWord(first.textContent.trim());
      body.appendChild(b);
    });
    const dock=document.getElementById('dockBody');
    if(dock)obs.observe(dock,{childList:true,subtree:true});
  }

  function boot(){
    injectUI();
    if(!supported()){updateStatus('此瀏覽器不支援語音合成');return;}
    loadVoices();
    if('onvoiceschanged' in window.speechSynthesis){window.speechSynthesis.onvoiceschanged=loadVoices;}
    patchWordNoteSpeak();
    console.log('Realistic TTS patch loaded');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.readNotebookArticle=readAll;
  window.readNotebookChapter=readCurrentChapter;
  window.stopNotebookSpeech=stopTTS;
})();
