
/* anki-srs-stats-patch.js v20260706-1
   Anki-like SRS / Forgetting curve / Weak words / AI article prompt for English Notebook.
   Core principle: db.learn is the single source of truth.
   Install after dual-engine-lemma-translation-patch-v3.js:
   <script src="./anki-srs-stats-patch.js?v=20260706-1"></script>
*/
(function(){
  'use strict';
  const STORE='notebook_platform_v3';
  const SRS='notebook_srs_settings_v1';

  function now(){return Date.now();}
  function dayKey(ts=Date.now()){const d=new Date(ts);return d.toISOString().slice(0,10);}
  function esc(s){return String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));}
  function getDB(){let d={};try{d=JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){};d.notebooks=d.notebooks||[];d.learn=d.learn||{};d.dark=!!d.dark;d.updatedAt=d.updatedAt||now();return d;}
  function setDB(d){d=d||{};d.notebooks=d.notebooks||[];d.learn=d.learn||{};d.updatedAt=now();localStorage.setItem(STORE,JSON.stringify(d));try{db=d;}catch(e){}return d;}
  function getSettings(){try{return JSON.parse(localStorage.getItem(SRS)||'{}')}catch(e){return {}}}
  function setSettings(s){localStorage.setItem(SRS,JSON.stringify(s||{}));}
  function lemmaOf(w){try{if(typeof lemmatizeWord==='function')return lemmatizeWord(w).lemma||w}catch(e){}return String(w||'').toLowerCase();}

  function migrateItem(x,key){
    x.word=x.word||key; x.lemma=x.lemma||key;
    x.firstSeenAt=x.firstSeenAt||x.updatedAt||now();
    x.lastSeenAt=x.lastSeenAt||x.updatedAt||now();
    x.lastReviewedAt=x.lastReviewedAt||0;
    x.lifetimeClicks=x.lifetimeClicks||0;
    x.sessionClicks=x.sessionClicks||0;
    x.maxClickStreak=x.maxClickStreak||x.clicks||0;
    x.reviewHistory=x.reviewHistory||[];
    x.dueAt=x.dueAt||0;
    x.intervalDays=x.intervalDays||0;
    x.ease=x.ease||2.5;
    x.lapses=x.lapses||0;
    x.status=x.status||statusOf(x);
    x.totalResets=x.totalResets||0;
    return x;
  }
  function migrateDB(){const d=getDB();Object.entries(d.learn||{}).forEach(([k,x])=>migrateItem(x,k));setDB(d);return d;}

  function statusOf(x){
    if(!x)return 'new';
    if(x.known && (x.intervalDays||0)>=21)return 'mature';
    if(x.known)return 'young';
    if((x.clicks||0)>0 || x.captured)return 'learning';
    return 'new';
  }
  function pushReview(x,grade,source){
    x.reviewHistory=x.reviewHistory||[];
    x.reviewHistory.push({ts:now(),day:dayKey(),grade,source:source||'manual',clicks:x.clicks||0,strength:x.strength||0,intervalDays:x.intervalDays||0});
    if(x.reviewHistory.length>500)x.reviewHistory=x.reviewHistory.slice(-500);
    x.lastReviewedAt=now();
  }
  function schedule(x,grade){
    // Small practical SRS model inspired by Anki behavior, not a full SM-2 clone.
    // again: soon; hard: short; good: grows; easy: grows faster.
    x.ease=x.ease||2.5;
    const oneDay=86400000;
    if(grade==='again'){
      x.lapses=(x.lapses||0)+1;
      x.intervalDays=0;
      x.dueAt=now()+10*60*1000;
      x.known=false; x.captured=true; x.status='relearning';
      x.ease=Math.max(1.3,(x.ease||2.5)-0.2);
      return;
    }
    if(grade==='hard'){
      x.intervalDays=Math.max(1,Math.round((x.intervalDays||0)*1.2)||1);
      x.dueAt=now()+x.intervalDays*oneDay;
      x.known=false; x.captured=true; x.status='learning';
      x.ease=Math.max(1.3,(x.ease||2.5)-0.1);
      return;
    }
    if(grade==='good'){
      x.intervalDays=(x.intervalDays||0)<1?1:Math.round((x.intervalDays||1)*(x.ease||2.5));
      x.dueAt=now()+x.intervalDays*oneDay;
      x.known=true; x.captured=false; x.status=x.intervalDays>=21?'mature':'young';
      return;
    }
    if(grade==='easy'){
      x.ease=Math.min(3.2,(x.ease||2.5)+0.15);
      x.intervalDays=(x.intervalDays||0)<1?4:Math.round((x.intervalDays||1)*(x.ease||2.5)*1.3);
      x.dueAt=now()+x.intervalDays*oneDay;
      x.known=true; x.captured=false; x.status=x.intervalDays>=21?'mature':'young';
      return;
    }
  }

  function recordClick(word){
    const key=lemmaOf(word); const d=getDB(); const x=migrateItem(d.learn[key]||(d.learn[key]={word:key,lemma:key}),key);
    x.lifetimeClicks=(x.lifetimeClicks||0)+1;
    x.sessionClicks=(x.sessionClicks||0)+1;
    x.lastSeenAt=now();
    x.maxClickStreak=Math.max(x.maxClickStreak||0,x.clicks||0);
    if((x.lifetimeClicks||0)>=10)x.isWeak=true;
    x.status=statusOf(x);
    d.learn[key]=x; setDB(d);
  }

  function gradeWord(word,grade,source){
    const key=lemmaOf(word); const d=getDB(); const x=migrateItem(d.learn[key]||(d.learn[key]={word:key,lemma:key}),key);
    pushReview(x,grade,source||'manual');
    schedule(x,grade);
    if(grade==='good'||grade==='easy'){
      x.totalResets=(x.totalResets||0)+1;
      x.clicks=0; x.strength=0;
      // Keep history. Do NOT delete or forget the word.
    }
    x.status=statusOf(x);
    x.updatedAt=now(); d.learn[key]=x; setDB(d);
    try{if(typeof renderCapture==='function')renderCapture(); if(typeof applyIntensity==='function')applyIntensity(); if(typeof showWord==='function')showWord(key);}catch(e){}
    return x;
  }

  // Wrap v3 clickWord / known / hard while preserving translations.
  const oldClick=window.clickWord;
  window.clickWord=function(word){
    recordClick(word);
    if(typeof oldClick==='function')return oldClick(word);
  };
  window.known=function(word){return gradeWord(word,'good','known-button');};
  window.hard=function(word){return gradeWord(word,'hard','hard-button');};
  window.srsGrade=function(word,grade){return gradeWord(word,grade,'srs-button');};

  function allItems(){const d=migrateDB();return Object.values(d.learn||{}).map((x)=>migrateItem(x,x.lemma||x.word));}
  function weakItems(){return allItems().filter(x=>(x.lifetimeClicks||0)>=10 || (x.maxClickStreak||0)>=10 || x.isWeak).sort((a,b)=>(b.lifetimeClicks||0)-(a.lifetimeClicks||0));}
  function dueItems(){const n=now();return allItems().filter(x=>x.dueAt && x.dueAt<=n && !x.known).sort((a,b)=>(a.dueAt||0)-(b.dueAt||0));}
  function futureDue(days=30){const n=now(), one=86400000; const arr=new Array(days).fill(0); allItems().forEach(x=>{if(x.dueAt){const i=Math.floor((x.dueAt-n)/one); if(i>=0&&i<days)arr[i]++;}});return arr;}
  function reviewsByDay(days=30){const map={}; const cutoff=now()-days*86400000; allItems().forEach(x=>(x.reviewHistory||[]).forEach(r=>{if(r.ts>=cutoff){map[r.day]=(map[r.day]||0)+1;}}));return map;}
  function cardCounts(){const c={new:0,learning:0,relearning:0,young:0,mature:0};allItems().forEach(x=>{c[statusOf(x)]=(c[statusOf(x)]||0)+1;});return c;}

  function barChart(vals,maxH=74){const max=Math.max(1,...vals);return `<div class="anki-bars">${vals.map((v,i)=>`<div class="anki-bar" title="Day +${i}: ${v}" style="height:${Math.max(2,Math.round(v/max*maxH))}px"></div>`).join('')}</div>`;}
  function miniCalendar(){
    const rev=reviewsByDay(180); const today=new Date(); const cells=[];
    for(let i=179;i>=0;i--){const d=new Date(today.getTime()-i*86400000); const k=d.toISOString().slice(0,10); const v=rev[k]||0; const level=v>20?4:v>10?3:v>3?2:v>0?1:0; cells.push(`<span class="cal l${level}" title="${k}: ${v} reviews"></span>`);} 
    return `<div class="anki-cal">${cells.join('')}</div>`;
  }
  function pieCounts(c){const total=Object.values(c).reduce((a,b)=>a+b,0)||1; return Object.entries(c).map(([k,v])=>`<div class="countrow"><span>${k}</span><b>${v}</b><em>${Math.round(v/total*100)}%</em></div>`).join('');}
  function intervalBars(){const vals=new Array(20).fill(0); allItems().forEach(x=>{const i=Math.min(19,Math.floor((x.intervalDays||0)/5)); vals[i]++;});return barChart(vals,74);}

  function aiPrompt(){
    const words=weakItems().slice(0,35).map(x=>x.lemma||x.word);
    return `請用繁體中文說明，並用英文寫一篇約 250-350 字的短文，主題貼近職場、安全、學習或日常情境。必須自然使用以下我不熟的英文單字，每個單字至少使用一次，文章之後請列出每個單字的繁中意思與一句例句。請避免過度生硬堆字。\n\n弱點單字：${words.join(', ')}`;
  }
  function copyPrompt(){navigator.clipboard.writeText(aiPrompt()).then(()=>alert('已複製 AI 弱點文章 Prompt'));}

  function injectStyle(){
    if(document.getElementById('ankiStatsStyle'))return;
    const s=document.createElement('style');s.id='ankiStatsStyle';s.textContent=`
      #ankiStatsModal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99980;display:none;overflow:auto;padding:20px;color:#111;font-family:Segoe UI,Microsoft JhengHei,sans-serif;}
      #ankiStatsModal.show{display:block;}
      #ankiStatsBox{background:#f7f7f7;border-radius:10px;max-width:1180px;margin:0 auto;padding:18px;box-shadow:0 14px 38px rgba(0,0,0,.35);}
      #ankiStatsTop{display:flex;align-items:center;gap:12px;margin-bottom:12px;}
      #ankiStatsTop h2{margin:0;font-size:24px;flex:1;}
      .anki-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
      .anki-card{background:white;border:1px solid #ddd;border-radius:10px;padding:16px;min-height:220px;box-shadow:0 1px 4px rgba(0,0,0,.08);}
      .anki-card h3{font-size:26px;margin:0 0 10px;border-bottom:1px solid #ccc;padding-bottom:8px;}
      .anki-bars{height:86px;display:flex;align-items:end;gap:3px;margin:12px 0;}
      .anki-bar{width:9px;background:#68b878;border-radius:2px 2px 0 0;opacity:.88;}
      .anki-cal{display:grid;grid-template-columns:repeat(30,8px);gap:2px;margin:20px auto;justify-content:center;}
      .cal{width:8px;height:8px;background:#e6eef6;border-radius:1px;}.cal.l1{background:#b7d7f0}.cal.l2{background:#6baed6}.cal.l3{background:#3182bd}.cal.l4{background:#08519c}
      .countrow{display:grid;grid-template-columns:1fr 60px 60px;gap:6px;margin:5px 0;}.countrow b{text-align:right}.countrow em{text-align:right;color:#666;font-style:normal}
      .weaklist{max-height:170px;overflow:auto;font-size:13px;}.weakitem{display:grid;grid-template-columns:1fr 50px 50px;gap:6px;border-bottom:1px dotted #ddd;padding:4px 0;}
      .anki-btn{border:1px solid #bbb;background:#fff;border-radius:6px;padding:7px 10px;cursor:pointer}.anki-btn.primary{background:#2f6f9f;color:white;border-color:#2f6f9f}.promptbox{width:100%;min-height:130px;font-size:12px;padding:8px;border:1px solid #ccc;border-radius:6px;}
      @media(max-width:900px){.anki-grid{grid-template-columns:1fr}.anki-card h3{font-size:22px}#ankiStatsModal{padding:8px}.anki-cal{grid-template-columns:repeat(20,8px)}}
    `;document.head.appendChild(s);
  }
  function renderStats(){
    injectStyle();
    let m=document.getElementById('ankiStatsModal');
    if(!m){m=document.createElement('div');m.id='ankiStatsModal';document.body.appendChild(m);}
    const items=allItems(); const weak=weakItems(); const due=dueItems(); const fd=futureDue(30); const counts=cardCounts(); const rev=reviewsByDay(30); const today=rev[dayKey()]||0;
    m.innerHTML=`<div id="ankiStatsBox">
      <div id="ankiStatsTop"><h2>Statistics / 遺忘曲線</h2><button class="anki-btn" id="ankiClose">Close</button></div>
      <div class="anki-grid">
        <section class="anki-card"><h3>Today</h3><p>${today?`Today reviewed: <b>${today}</b>`:'No cards have been studied today.'}</p><p>Due now: <b>${due.length}</b></p><p>Weak words: <b>${weak.length}</b></p></section>
        <section class="anki-card"><h3>Future Due</h3><p>The number of reviews due in the future.</p>${barChart(fd)}<p>Total: <b>${fd.reduce((a,b)=>a+b,0)}</b> reviews</p><p>Due tomorrow: <b>${fd[1]||0}</b></p></section>
        <section class="anki-card"><h3>Calendar</h3>${miniCalendar()}</section>
        <section class="anki-card"><h3>Reviews</h3>${barChart(Object.values(rev).slice(-30))}<p>Total 30 days: <b>${Object.values(rev).reduce((a,b)=>a+b,0)}</b></p></section>
        <section class="anki-card"><h3>Card Counts</h3>${pieCounts(counts)}<p>Total cards: <b>${items.length}</b></p></section>
        <section class="anki-card"><h3>Review Intervals</h3>${intervalBars()}<p>Average interval: <b>${Math.round(items.reduce((a,x)=>a+(x.intervalDays||0),0)/Math.max(1,items.length)*10)/10}</b> days</p></section>
        <section class="anki-card"><h3>Weak Words</h3><div class="weaklist">${weak.slice(0,40).map(x=>`<div class="weakitem"><span>${esc(x.lemma||x.word)}<br><small>${esc(x.tw||'')}</small></span><b>${x.lifetimeClicks||0}</b><em>${x.maxClickStreak||0}</em></div>`).join('')||'<p>No weak words yet.</p>'}</div><small>Columns: lifetime / max streak</small></section>
        <section class="anki-card" style="grid-column:span 2"><h3>AI Weak-word Article</h3><p>把不熟單字集中成一篇文章。靜態 GitHub Pages 沒有內建 AI，所以這裡先產生可貼給 Copilot / ChatGPT 的 prompt。</p><textarea class="promptbox" id="weakPrompt">${esc(aiPrompt())}</textarea><br><button class="anki-btn primary" id="copyPrompt">複製 AI 文章 Prompt</button></section>
      </div>
    </div>`;
    document.getElementById('ankiClose').onclick=()=>m.classList.remove('show');
    document.getElementById('copyPrompt').onclick=copyPrompt;
    m.classList.add('show');
  }

  function injectButton(){
    const side=document.getElementById('side'); if(!side||document.getElementById('ankiStatsBtn'))return;
    const b=document.createElement('button');b.id='ankiStatsBtn';b.className='sidebtn hi';b.textContent='遺忘曲線 / Anki 統計';b.onclick=renderStats;
    const hr=side.querySelector('hr');side.insertBefore(b,hr?hr.nextSibling:side.firstChild);
  }

  setTimeout(()=>{migrateDB();injectButton();console.log('Anki SRS stats patch loaded');},500);
  window.showAnkiStats=renderStats;
  window.srsGrade=srsGrade;
})();
