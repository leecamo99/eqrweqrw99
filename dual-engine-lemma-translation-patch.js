
/* dual-engine-lemma-translation-patch.js v20260705-1
   Load this AFTER index.html main script.
   Features:
   - click word -> lemmatize to base form
   - Google Cloud Translation Basic v2 first when API key exists
   - fallback to MyMemory free API
   - optional Free Dictionary API for POS/English definition
   - cache results in localStorage notebook_platform_v3 / db.learn
*/
(function(){
  'use strict';
  const STORE='notebook_platform_v3';
  const GOOGLE_KEY='notebook_google_translate_key_v1';
  const FORM_DELAY=60*60*1000;
  const COMMON_LEMMAS=new Set(['approve','include','record','leave','make','take','provide','complete','assign','permit','escort','allow','require','explain','state','refer','enter','proceed','remain','follow','return','expire','encounter','support','coordinate','delete','add','obtain','ensure','correct','work','stream','patrol','issue','process','access','flash','use','close','open','carry','copy','create','update','sync','translate','learn','capture','review','receive','upload','download','submit','remove','replace','modify','check','confirm','verify','print','provide']);
  const IRREGULAR={has:'have',had:'have',having:'have',was:'be',were:'be',been:'be',being:'be',is:'be',are:'be',am:'be',does:'do',did:'do',done:'do',doing:'do',went:'go',gone:'go',going:'go',made:'make',making:'make',took:'take',taken:'take',taking:'take',gave:'give',given:'give',giving:'give',wrote:'write',written:'write',writing:'write',saw:'see',seen:'see',seeing:'see'};
  function esc(s){return String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));}
  function getDB(){let d={};try{d=JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){};return norm(d);}
  function setDB(d){localStorage.setItem(STORE,JSON.stringify(norm(d)));}
  function norm(d){d=d||{};d.notebooks=d.notebooks||[];d.learn=d.learn||{};d.dark=!!d.dark;d.updatedAt=d.updatedAt||Date.now();return d;}
  function lemmatize(surface){
    let original=String(surface||'').trim();
    let w=original.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g,'');
    if(!w)return{surface:original,lemma:original,form:'unknown'};
    if(IRREGULAR[w])return{surface:original,lemma:IRREGULAR[w],form:'irregular form'};
    if(w.endsWith('ies')&&w.length>4)return{surface:original,lemma:w.slice(0,-3)+'y',form:'plural / 3rd person -ies'};
    if(w.endsWith('ves')&&w.length>4)return{surface:original,lemma:w.slice(0,-3)+'f',form:'plural -ves'};
    if(w.endsWith('ing')&&w.length>5){let root=w.slice(0,-3),withE=root+'e';if(COMMON_LEMMAS.has(withE))return{surface:original,lemma:withE,form:'-ing form'};if(root.length>=3&&root[root.length-1]===root[root.length-2])root=root.slice(0,-1);return{surface:original,lemma:root,form:'-ing form'};}
    if(w.endsWith('ied')&&w.length>4)return{surface:original,lemma:w.slice(0,-3)+'y',form:'-ed / past participle'};
    if(w.endsWith('ed')&&w.length>4){let root=w.slice(0,-2),withE=root+'e';if(COMMON_LEMMAS.has(withE))return{surface:original,lemma:withE,form:'-ed / past participle'};if(root.length>=3&&root[root.length-1]===root[root.length-2])root=root.slice(0,-1);return{surface:original,lemma:root,form:'-ed / past participle'};}
    if(w.endsWith('es')&&w.length>4){let root=w.slice(0,-2),withE=w.slice(0,-1);if(COMMON_LEMMAS.has(withE))return{surface:original,lemma:withE,form:'plural / 3rd person -es'};return{surface:original,lemma:root,form:'plural / 3rd person -es'};}
    if(w.endsWith('s')&&w.length>3)return{surface:original,lemma:w.slice(0,-1),form:'plural / 3rd person -s'};
    return{surface:original,lemma:w,form:'base form'};
  }
  function ensureLemma(surface){
    const info=lemmatize(surface), key=info.lemma, db=getDB();
    if(!db.learn[key]) db.learn[key]={word:key,lemma:key,pos:'',tw:'（未建字義，點擊後自動查詢）',tip:'',clicks:0,strength:0,captured:false,known:false,dueAt:0,updatedAt:Date.now(),variants:{},lastSurface:info.surface,lastForm:info.form,engine:''};
    const x=db.learn[key]; x.word=key; x.lemma=key; x.lastSurface=info.surface; x.lastForm=info.form; x.variants=x.variants||{}; if(info.surface)x.variants[info.surface]=(x.variants[info.surface]||0)+1; setDB(db); return{key,info,x,db};
  }
  async function translateGoogle(text){
    const key=localStorage.getItem(GOOGLE_KEY)||'';
    if(!key) throw new Error('No Google key');
    const res=await fetch('https://translation.googleapis.com/language/translate/v2?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({q:text,source:'en',target:'zh-TW',format:'text'})});
    if(!res.ok) throw new Error('Google '+res.status);
    const data=await res.json();
    const t=data&&data.data&&data.data.translations&&data.data.translations[0]&&data.data.translations[0].translatedText;
    if(!t) throw new Error('Google empty');
    return t;
  }
  async function translateMyMemory(text){
    const url='https://api.mymemory.translated.net/get?'+new URLSearchParams({q:text,langpair:'en|zh-TW'}).toString();
    const res=await fetch(url); if(!res.ok) throw new Error('MyMemory '+res.status);
    const data=await res.json();
    const t=data&&data.responseData&&data.responseData.translatedText;
    if(!t) throw new Error('MyMemory empty');
    return t;
  }
  async function lookupDictionary(text){
    try{const r=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(text)); if(!r.ok)return{}; const jd=await r.json(); const m=jd&&jd[0]&&jd[0].meanings&&jd[0].meanings[0]; if(!m)return{}; const def=m.definitions&&m.definitions[0]&&m.definitions[0].definition; return{pos:m.partOfSpeech||'',definition:def||''};}catch(e){return{};}
  }
  async function autoTranslateLemma(lemma){
    const db=getDB(); const x=db.learn[lemma]; if(!x||x.loading)return;
    if(x.tw && !String(x.tw).includes('未建') && !String(x.tw).includes('查詢中') && !String(x.tw).includes('翻譯 API'))return;
    x.loading=true; x.tw='查詢中...'; x.updatedAt=Date.now(); setDB(db); showWord(lemma);
    let tw='', engine='';
    try{tw=await translateGoogle(lemma); engine='Google Cloud Translation';}
    catch(gErr){try{tw=await translateMyMemory(lemma); engine='MyMemory';}catch(mErr){tw='（翻譯 API 暫時失敗）'; engine='failed';}}
    const dict=await lookupDictionary(lemma);
    const db2=getDB(); if(db2.learn[lemma]){db2.learn[lemma].tw=tw; db2.learn[lemma].engine=engine; db2.learn[lemma].pos=db2.learn[lemma].pos||dict.pos||''; db2.learn[lemma].tip=(engine?('Auto translated by '+engine):'')+(dict.definition?('｜'+dict.definition):''); db2.learn[lemma].loading=false; db2.learn[lemma].updatedAt=Date.now(); setDB(db2);} showWord(lemma); refreshUI(); if(typeof window.save==='function')try{window.save()}catch(e){}
  }
  function showWord(surfaceOrLemma){
    const key=lemmatize(surfaceOrLemma).lemma; const db=getDB(); const x=db.learn[key]; if(!x||!document.getElementById('dockBody'))return;
    const variants=Object.entries(x.variants||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>esc(k)+' ×'+v).join(', ');
    dockBody.innerHTML=`<div class="wordbig">${esc(x.lastSurface||surfaceOrLemma)}</div><div style="color:var(--muted)">原形：<b>${esc(x.lemma||x.word)}</b> · ${esc(x.pos||'')} · 點擊 ${x.clicks||0} 次 · 亮度 ${x.strength||0}/10</div><div style="color:var(--muted)">型態：${esc(x.lastForm||'base form')} · 引擎：${esc(x.engine||'')}</div><div class="meaning">${esc(x.tw||'')}</div><div style="color:var(--muted)">${esc(x.tip||'')}</div><div style="font-size:12px;color:var(--muted);margin-top:6px">變形：${variants||'—'}</div><button class="btn" onclick="known('${esc(x.lemma||x.word)}')">已熟，歸零</button><button class="btn" onclick="hard('${esc(x.lemma||x.word)}')">還不熟</button><button class="btn" onclick="dock.classList.remove('show')">關閉</button>`;
    dock.classList.add('show');
  }
  function refreshUI(){if(typeof window.applyIntensity==='function')try{window.applyIntensity()}catch(e){}; if(typeof window.renderCapture==='function')try{window.renderCapture()}catch(e){};}
  window.clickWord=function(surface){const {key,x}=ensureLemma(surface);x.clicks=(x.clicks||0)+1;x.strength=Math.min(10,(x.strength||0)+1);x.captured=true;x.known=false;if(!x.dueAt)x.dueAt=Date.now()+FORM_DELAY;x.updatedAt=Date.now();const db=getDB();db.learn[key]=x;setDB(db);showWord(key);refreshUI();if(!x.tw||String(x.tw).includes('未建')||String(x.tw).includes('查詢中')||String(x.tw).includes('翻譯 API'))autoTranslateLemma(key);if(typeof window.save==='function')try{window.save()}catch(e){}};
  window.ensureLearn=function(surface){return ensureLemma(surface).x;};
  window.showWord=function(surface){showWord(surface);};
  window.known=function(surface){const key=lemmatize(surface).lemma,db=getDB();if(db.learn[key]){db.learn[key].clicks=0;db.learn[key].strength=0;db.learn[key].captured=false;db.learn[key].known=true;db.learn[key].dueAt=0;db.learn[key].updatedAt=Date.now();setDB(db);}refreshUI();showWord(key);if(typeof window.save==='function')try{window.save()}catch(e){}};
  window.hard=function(surface){const key=lemmatize(surface).lemma;let db=getDB();if(!db.learn[key])ensureLemma(surface);db=getDB();const x=db.learn[key];x.clicks=(x.clicks||0)+2;x.strength=Math.min(10,(x.strength||0)+2);x.captured=true;x.known=false;x.dueAt=Date.now()+30*60*1000;x.updatedAt=Date.now();setDB(db);showWord(key);refreshUI();if(typeof window.save==='function')try{window.save()}catch(e){}};
  window.applyIntensity=function(){const db=getDB();document.querySelectorAll('.mark').forEach(e=>{const key=lemmatize(e.dataset.key||e.textContent).lemma;const w=db.learn[key];for(let i=1;i<=10;i++)e.classList.remove('i'+i);if(w)e.classList.add('i'+Math.min(10,w.strength||0));});};
  window.renderCapture=function(){const db=getDB();const arr=Object.values(db.learn||{}).filter(x=>x.captured&&!x.known).sort((a,b)=>(b.clicks||0)-(a.clicks||0));if(!document.getElementById('capBody'))return;capBody.innerHTML=arr.length?arr.map(x=>`<div class="capitem" data-cap="${esc(x.lemma||x.word)}"><span>${esc(x.lemma||x.word)}<br><small>${esc(x.tw||'')}</small></span><b>${x.clicks||0}</b></div>`).join(''):'<p style="color:var(--muted)">目前沒有捕獲單字。</p>';};
  window.lemmatizeWord=lemmatize; window.autoTranslateLemma=autoTranslateLemma;
  window.setGoogleTranslateKey=function(){const old=localStorage.getItem(GOOGLE_KEY)||'';const k=prompt('貼上 Google Cloud Translation API Key（留空＝清除，只用 MyMemory）',old);if(k===null)return;if(k.trim())localStorage.setItem(GOOGLE_KEY,k.trim());else localStorage.removeItem(GOOGLE_KEY);alert(k.trim()?'已儲存 Google API Key，翻譯會優先用 Google。':'已清除 Google API Key，將只用 MyMemory。');};
  setTimeout(()=>{const side=document.getElementById('side');if(side&&!document.getElementById('googleKeyBtn')){const b=document.createElement('button');b.id='googleKeyBtn';b.className='sidebtn';b.textContent='Google 翻譯 Key';b.onclick=window.setGoogleTranslateKey;const hr=side.querySelector('hr');side.insertBefore(b,hr?hr.nextSibling:side.firstChild);}refreshUI();console.log('Dual Engine Lemma Translation patch loaded');},500);
})();
