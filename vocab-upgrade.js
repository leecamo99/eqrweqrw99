
/* vocab-upgrade.js
   English Notebook add-on: subtle word intensity, meaning panel, unknown capture, flashcard review.
   Install: upload this file to the same GitHub repo as index.html and add:
   <script src="vocab-upgrade.js"></script>
   right before </body>, after the original script.
*/
(function(){
  'use strict';
  const VOCAB_KEY = 'notebook_vocab_learning_v1';
  const REVIEW_INTERVAL_MS = 10 * 60 * 1000; // 每 10 分鐘檢查是否有該複習的字
  const DEFAULT_REVIEW_DELAY_MS = 60 * 60 * 1000; // 點過後預設 1 小時後進入閃卡

  // 常見職場/機房/門禁英文基礎詞庫。可持續擴充。
  const MEANING_DB = {
    'badge': {pos:'n.', tw:'識別證；工作證', tip:'temporary badge = 臨時識別證'},
    'temporary': {pos:'adj.', tw:'臨時的；暫時的', tip:'temporary badge 臨時識別證'},
    'visible': {pos:'adj.', tw:'可見的；看得見的', tip:'keep it visible = 保持可見'},
    'return': {pos:'v.', tw:'歸還；返回', tip:'return it before leaving = 離開前歸還'},
    'leaving': {pos:'v.', tw:'離開', tip:'before + V-ing'},
    'personal items': {pos:'n.', tw:'個人物品', tip:'常見公告用語'},
    'backpacks': {pos:'n.', tw:'後背包', tip:''},
    'bags': {pos:'n.', tw:'包包；手提袋', tip:''},
    'approved': {pos:'adj./v.', tw:'已核准的；批准', tip:'approved permission = 已核准權限'},
    'non-approved': {pos:'adj.', tw:'未經核准的', tip:'non-approved devices = 未經核准設備'},
    'allowed in': {pos:'phr.', tw:'被允許進入', tip:'be allowed in + 地點'},
    'such as': {pos:'phr.', tw:'例如', tip:'後面接例子'},
    'colos': {pos:'abbr.', tw:'主機共置區；Colocation 區', tip:'資料中心常見區域'},
    'data halls': {pos:'n.', tw:'資料機房', tip:''},
    'availability zones': {pos:'n.', tw:'可用區', tip:'AZ = Availability Zone'},
    'AZ': {pos:'abbr.', tw:'可用區', tip:'Availability Zone'},
    'ITPAC': {pos:'abbr.', tw:'資訊技術預組裝設備', tip:'Information Technology Pre-Assembled Component'},
    'ITPACs': {pos:'abbr.', tw:'資訊技術預組裝設備', tip:'Information Technology Pre-Assembled Components'},
    'MDF': {pos:'abbr.', tw:'主配線架', tip:'Main Distribution Frame'},
    'MDFs': {pos:'abbr.', tw:'主配線架', tip:'Main Distribution Frames'},
    'DBD': {pos:'abbr.', tw:'資料承載裝置', tip:'Data Bearing Device'},
    'DBDs': {pos:'abbr.', tw:'資料承載裝置', tip:'Data Bearing Devices'},
    'USB': {pos:'abbr.', tw:'USB；通用序列匯流排', tip:''},
    'secure storage': {pos:'n.', tw:'安全儲存區', tip:''},
    'high value asset': {pos:'n.', tw:'高價值資產', tip:''},
    'staging areas': {pos:'n.', tw:'整備區；暫存區', tip:'設備正式上線前的暫置區'},
    'photography': {pos:'n.', tw:'攝影；拍照', tip:'photography permissions = 拍照權限'},
    'permissions': {pos:'n.', tw:'權限；許可', tip:'permission 的複數'},
    'permission levels': {pos:'n.', tw:'權限等級', tip:''},
    'specific': {pos:'adj.', tw:'具體的；明確的', tip:'specific permission levels'},
    'explain': {pos:'v.', tw:'解釋；說明', tip:''},
    'state': {pos:'v.', tw:'陳述；告知', tip:'SOP 中常用：state = 告知/說明'},
    'permitted to': {pos:'phr.', tw:'被允許做…', tip:'be permitted to + V'},
    'not permitted to': {pos:'phr.', tw:'不被允許做…', tip:'比 not allowed 更正式'},
    'includes': {pos:'v.', tw:'包含；包括', tip:''},
    'including': {pos:'prep.', tw:'包括；包含', tip:'後面接名詞或名詞片語'},
    'recording': {pos:'n./v.', tw:'錄製；記錄', tip:'video recording 影像錄製'},
    'live streaming': {pos:'n.', tw:'直播串流', tip:''},
    'still images': {pos:'n.', tw:'靜態影像', tip:''},
    'mobile equipment': {pos:'n.', tw:'行動設備', tip:''},
    'refer to': {pos:'phr.', tw:'參照；參閱', tip:'refer to section 10.5'},
    'section': {pos:'n.', tw:'章節；段落', tip:''},
    'patrolling': {pos:'n./v.', tw:'巡邏', tip:'patrolling on foot = 徒步巡邏'},
    'on foot': {pos:'phr.', tw:'徒步', tip:''},
    'production environment': {pos:'n.', tw:'生產環境；正式營運區域', tip:'機房正式營運環境'},
    'door policy': {pos:'n.', tw:'門禁政策', tip:''},
    'facility': {pos:'n.', tw:'設施；場館', tip:''},
    'one swipe one entry': {pos:'phr.', tw:'一刷一進', tip:'刷卡一次只能進一人'},
    'wait for': {pos:'phr.', tw:'等待…', tip:'wait for the door to close'},
    'swipe': {pos:'v./n.', tw:'刷卡；刷動', tip:'swipe your badge'},
    'card reader': {pos:'n.', tw:'讀卡機', tip:''},
    'flashes': {pos:'v.', tw:'閃爍', tip:'flashes green/red'},
    'proceed': {pos:'v.', tw:'前進；繼續進行', tip:'正式用語'},
    'access': {pos:'n./v.', tw:'進入權限；存取；進入', tip:'do not have access = 沒有權限'},
    'enter': {pos:'v.', tw:'進入', tip:''},
    'unless': {pos:'conj.', tw:'除非', tip:'Do not..., unless...'},
    'completed': {pos:'adj./v.', tw:'已完成的；完成', tip:''},
    'process': {pos:'n.', tw:'流程；程序', tip:''},
    'escorted': {pos:'adj./v.', tw:'被陪同的；被護送', tip:'escort = 陪同'},
    'escort': {pos:'n./v.', tw:'陪同；護送；陪同員', tip:'escort policy = 陪同政策'},
    'in accordance with': {pos:'phr.', tw:'依照；按照', tip:'正式 SOP 常用片語'},
    'emergency exit door': {pos:'n.', tw:'緊急出口門', tip:''},
    'emergency': {pos:'n.', tw:'緊急狀況', tip:''},
    'exists': {pos:'v.', tw:'存在；發生', tip:'unless an emergency exists'},
    'main door': {pos:'n.', tw:'主要入口門', tip:''},
    'applicable': {pos:'adj.', tw:'適用的', tip:'if applicable = 若適用'},
    'individual': {pos:'n.', tw:'個人；人員', tip:''},
    'individuals': {pos:'n.', tw:'人員；個人', tip:''},
    'direct supervision': {pos:'n.', tw:'直接監督', tip:''},
    'supervision': {pos:'n.', tw:'監督', tip:''},
    'assigned': {pos:'adj.', tw:'被指派的', tip:'assigned escort = 指派陪同員'},
    'at all times': {pos:'phr.', tw:'隨時；任何時候', tip:'must remain ... at all times'},
    'instructions': {pos:'n.', tw:'指示；說明', tip:''},
    'provided by': {pos:'phr.', tw:'由…提供', tip:''},
    'under escort': {pos:'phr.', tw:'在陪同狀態下', tip:''},
    'expires': {pos:'v.', tw:'到期；失效', tip:'expire 的第三人稱單數'},
    'expiration': {pos:'n.', tw:'到期；有效期限', tip:''},
    'encounter': {pos:'v.', tw:'遇到；遭遇', tip:'正式用語'},
    'issues': {pos:'n.', tw:'問題；狀況', tip:''},
    'security office': {pos:'n.', tw:'警衛室；保全辦公室', tip:''},
    'hours': {pos:'n.', tw:'小時；時刻', tip:'at 1400 hours = 14:00'}
  };

  function state(){
    let s = localStorage.getItem(VOCAB_KEY);
    if(s){ try{return JSON.parse(s)}catch(e){} }
    return { words:{}, lastReview:0 };
  }
  function saveState(s){ localStorage.setItem(VOCAB_KEY, JSON.stringify(s)); }
  function keyNorm(k){ return String(k||'').trim(); }
  function lowerKey(k){ return keyNorm(k).toLowerCase(); }

  function lookupMeaning(word){
    const k = keyNorm(word);
    if(VOCAB_DB_HAS(k)) return MEANING_DB[k];
    const lk = lowerKey(k);
    for(const [w,v] of Object.entries(MEANING_DB)){
      if(w.toLowerCase() === lk) return v;
    }
    // 簡易詞尾規則：複數 / -ing / -ed / -s
    const candidates = [];
    if(lk.endsWith('ies')) candidates.push(lk.slice(0,-3)+'y');
    if(lk.endsWith('ing')) candidates.push(lk.slice(0,-3), lk.slice(0,-3)+'e');
    if(lk.endsWith('ed')) candidates.push(lk.slice(0,-2), lk.slice(0,-1));
    if(lk.endsWith('s')) candidates.push(lk.slice(0,-1));
    for(const c of candidates){
      for(const [w,v] of Object.entries(MEANING_DB)) if(w.toLowerCase()===c) return v;
    }
    return {pos:'', tw:'（未建字義，請自行補充）', tip:'此字尚未在內建詞庫中。'};
  }
  function VOCAB_DB_HAS(k){ return Object.prototype.hasOwnProperty.call(MEANING_DB, k); }

  function ensureWord(word){
    const s = state();
    const k = keyNorm(word);
    if(!k) return null;
    if(!s.words[k]){
      const m = lookupMeaning(k);
      s.words[k] = {
        word:k, pos:m.pos||'', tw:m.tw||'', tip:m.tip||'',
        clicks:0, strength:0, captured:false, known:false,
        createdAt:Date.now(), updatedAt:Date.now(), dueAt:0,
        correctStreak:0
      };
      saveState(s);
    }
    return s.words[k];
  }

  function incrementWord(word){
    const s = state();
    const k = keyNorm(word);
    if(!k) return null;
    if(!s.words[k]) ensureWord(k);
    const w = s.words[k];
    w.clicks = (w.clicks||0) + 1;
    w.strength = Math.min(10, (w.strength||0) + 1);
    w.captured = true;
    w.known = false;
    w.updatedAt = Date.now();
    if(!w.dueAt) w.dueAt = Date.now() + DEFAULT_REVIEW_DELAY_MS;
    saveState(s);
    return w;
  }

  function setKnown(word){
    const s = state();
    const k = keyNorm(word);
    if(!s.words[k]) return;
    const w = s.words[k];
    w.clicks = 0; w.strength = 0; w.captured = false; w.known = true;
    w.correctStreak = (w.correctStreak||0)+1;
    w.dueAt = 0; w.updatedAt = Date.now();
    saveState(s);
    applyIntensity(); renderCaptureList(); showWord(k);
    if(window.saveDB) try{ window.saveDB(); }catch(e){}
  }

  function markHard(word){
    const s = state();
    const k = keyNorm(word);
    if(!s.words[k]) ensureWord(k);
    const w = s.words[k];
    w.clicks = Math.max(1,(w.clicks||0)+2);
    w.strength = Math.min(10, (w.strength||0)+2);
    w.captured = true; w.known=false; w.correctStreak=0;
    w.dueAt = Date.now() + 30*60*1000; // 30 分鐘後再複習
    w.updatedAt = Date.now();
    saveState(s); applyIntensity(); renderCaptureList();
    if(window.saveDB) try{ window.saveDB(); }catch(e){}
  }

  function injectCSS(){
    if(document.getElementById('vocabUpgradeCSS')) return;
    const css = `
      .mark{background:transparent!important; border-bottom:1px dotted rgba(52,73,94,.35)!important; padding:0 2px!important; transition:background .15s, box-shadow .15s, color .15s!important;}
      .mark.v-int-0{background:transparent!important;}
      .mark.v-int-1{background:rgba(232,217,168,.16)!important;}
      .mark.v-int-2{background:rgba(232,217,168,.26)!important;}
      .mark.v-int-3{background:rgba(232,217,168,.36)!important;}
      .mark.v-int-4{background:rgba(232,217,168,.48)!important;}
      .mark.v-int-5{background:rgba(232,217,168,.60)!important; box-shadow:inset 0 -2px rgba(166,138,86,.25)!important;}
      .mark.v-int-6{background:rgba(232,217,168,.72)!important; box-shadow:inset 0 -2px rgba(166,138,86,.35)!important;}
      .mark.v-int-7{background:rgba(220,195,195,.72)!important; box-shadow:inset 0 -2px rgba(156,91,91,.35)!important;}
      .mark.v-int-8,.mark.v-int-9,.mark.v-int-10{background:rgba(220,195,195,.86)!important; box-shadow:inset 0 -2px rgba(156,91,91,.5)!important;}
      #vocabDock{position:fixed; right:18px; bottom:18px; z-index:220; width:min(380px, calc(100vw - 36px)); max-height:72vh; display:none; background:var(--paper,#faf6ed); color:var(--ink,#2b2b2b); border:1px solid var(--border,#c9bfae); box-shadow:0 8px 26px rgba(0,0,0,.18); overflow:auto;}
      #vocabDock.show{display:block;}
      #vocabDock header{display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border-bottom:1px solid var(--line,#d9cfbc); color:var(--primary,#34495e); letter-spacing:1px; font-family:Georgia,serif;}
      #vocabDock .body{padding:12px 14px; font-family:"Microsoft JhengHei",sans-serif;}
      #vocabDock .word{font-size:22px; font-weight:700; color:var(--primary,#34495e); margin-bottom:4px;}
      #vocabDock .meaning{color:var(--accent,#a68a56); font-size:15px; margin:8px 0;}
      #vocabDock .meta{font-size:12px; color:var(--muted,#7a7367); line-height:1.6;}
      #vocabDock button{background:transparent; border:1px solid var(--border,#c9bfae); color:var(--primary,#34495e); padding:7px 9px; margin:4px 4px 0 0; cursor:pointer; font-family:inherit;}
      #vocabDock button.primary{background:var(--primary,#34495e); color:var(--paper,#faf6ed); border-color:var(--primary,#34495e);}
      #capturePanel{position:fixed; left:18px; bottom:18px; z-index:210; width:min(330px, calc(100vw - 36px)); max-height:50vh; background:var(--paper,#faf6ed); border:1px solid var(--border,#c9bfae); display:none; overflow:auto; box-shadow:0 8px 26px rgba(0,0,0,.14);}
      #capturePanel.show{display:block;}
      #capturePanel header{padding:10px 12px; border-bottom:1px solid var(--line,#d9cfbc); display:flex; justify-content:space-between; align-items:center; font-family:Georgia,serif; color:var(--primary,#34495e);}
      #capturePanel .list{padding:8px 12px; font-family:"Microsoft JhengHei",sans-serif;}
      #capturePanel .item{display:flex; justify-content:space-between; gap:8px; border-bottom:1px dotted var(--line,#d9cfbc); padding:6px 0; cursor:pointer;}
      #capturePanel .item:hover{background:rgba(166,138,86,.08);}
      #capturePanel .count{color:var(--accent,#a68a56); font-weight:700;}
      #flashModal{position:fixed; inset:0; z-index:300; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.45); padding:18px;}
      #flashModal.show{display:flex;}
      #flashModal .card{width:min(520px,96vw); background:var(--paper,#faf6ed); color:var(--ink,#2b2b2b); border:1px solid var(--border,#c9bfae); padding:22px; font-family:"Microsoft JhengHei",sans-serif;}
      #flashModal .q{font-size:28px; color:var(--primary,#34495e); font-family:Georgia,serif; margin-bottom:12px;}
      #flashModal .answer{display:none; margin:12px 0; padding:12px; background:var(--note,#f3ead6); border-left:3px solid var(--accent,#a68a56);}
      #flashModal .answer.show{display:block;}
      #flashModal button{background:transparent; border:1px solid var(--border,#c9bfae); padding:9px 12px; margin:5px 4px 0 0; cursor:pointer;}
      #flashModal button.primary{background:var(--primary,#34495e); color:var(--paper,#faf6ed); border-color:var(--primary,#34495e);}
      @media(max-width:820px){#capturePanel{left:10px; bottom:10px; max-height:38vh;} #vocabDock{right:10px; bottom:10px; max-height:55vh;}}
    `;
    const st = document.createElement('style'); st.id='vocabUpgradeCSS'; st.textContent=css; document.head.appendChild(st);
  }

  function injectUI(){
    if(document.getElementById('vocabDock')) return;
    const dock = document.createElement('div');
    dock.id = 'vocabDock';
    dock.innerHTML = `
      <header><span>WORD NOTE</span><button onclick="document.getElementById('vocabDock').classList.remove('show')">×</button></header>
      <div class="body" id="vocabDockBody"></div>`;
    document.body.appendChild(dock);

    const cp = document.createElement('div');
    cp.id = 'capturePanel';
    cp.innerHTML = `
      <header><span>捕獲不懂的單字</span><button onclick="document.getElementById('capturePanel').classList.toggle('show')">×</button></header>
      <div class="list" id="captureList"></div>`;
    document.body.appendChild(cp);

    const fm = document.createElement('div');
    fm.id='flashModal';
    fm.innerHTML = `<div class="card"><div class="q" id="flashQ"></div><div class="meta" id="flashMeta"></div><div class="answer" id="flashAns"></div><button class="primary" id="flashShow">看答案</button><button id="flashHard">還不熟</button><button id="flashKnown">已熟，歸零</button><button id="flashClose">稍後</button></div>`;
    document.body.appendChild(fm);

    const sideActions = document.querySelector('#sidebar .actions');
    if(sideActions && !document.getElementById('btnCapturedWords')){
      const btn = document.createElement('button');
      btn.id='btnCapturedWords'; btn.className='side-btn hi'; btn.textContent='捕獲單字區';
      btn.onclick = ()=>{ renderCaptureList(); document.getElementById('capturePanel').classList.toggle('show'); };
      sideActions.insertBefore(btn, sideActions.firstChild);
      const reviewBtn = document.createElement('button');
      reviewBtn.className='side-btn'; reviewBtn.textContent='開始閃卡複習';
      reviewBtn.onclick = ()=>startFlashcards(true);
      sideActions.insertBefore(reviewBtn, sideActions.children[1]);
    }
  }

  function showWord(word){
    const w = ensureWord(word);
    if(!w) return;
    const body = document.getElementById('vocabDockBody');
    body.innerHTML = `
      <div class="word">${escapeHtml(w.word)}</div>
      <div class="meta">${escapeHtml(w.pos||'')} · 點擊次數 ${w.clicks||0} · 熟悉度亮度 ${w.strength||0}/10</div>
      <div class="meaning">${escapeHtml(w.tw||'')}</div>
      <div class="meta">${escapeHtml(w.tip||'')}</div>
      <div style="margin-top:10px">
        <button class="primary" data-action="known">我已熟了，歸零</button>
        <button data-action="hard">還不熟，再排複習</button>
        <button data-action="close">關閉</button>
      </div>`;
    body.querySelector('[data-action="known"]').onclick = ()=>setKnown(w.word);
    body.querySelector('[data-action="hard"]').onclick = ()=>{ markHard(w.word); showWord(w.word); };
    body.querySelector('[data-action="close"]').onclick = ()=>document.getElementById('vocabDock').classList.remove('show');
    document.getElementById('vocabDock').classList.add('show');
  }

  function renderCaptureList(){
    const s = state();
    const list = Object.values(s.words).filter(w=>w.captured && !w.known).sort((a,b)=>(b.clicks||0)-(a.clicks||0));
    const el = document.getElementById('captureList');
    if(!el) return;
    if(!list.length){ el.innerHTML='<div style="color:var(--muted);font-size:13px">目前沒有捕獲單字。</div>'; return; }
    el.innerHTML = list.map(w=>`<div class="item" data-word="${escapeHtml(w.word)}"><span>${escapeHtml(w.word)}<br><small>${escapeHtml(w.tw||'')}</small></span><span class="count">${w.clicks||0}</span></div>`).join('');
    el.querySelectorAll('.item').forEach(x=>x.onclick=()=>showWord(x.dataset.word));
  }

  function applyIntensity(){
    const s = state();
    document.querySelectorAll('.mark').forEach(el=>{
      const k = keyNorm(el.dataset.key || el.textContent);
      const w = s.words[k];
      for(let i=0;i<=10;i++) el.classList.remove('v-int-'+i);
      const level = w ? Math.min(10, Math.max(0, w.strength||0)) : 0;
      el.classList.add('v-int-'+level);
      el.title = w ? `${w.word}\n${w.pos||''} ${w.tw||''}\n點擊 ${w.clicks||0} 次` : el.title;
    });
  }

  function enrichDbMarks(){
    if(!window.db || !db.notebooks) return;
    let changed = false;
    db.notebooks.forEach(nb=>{
      Object.keys(nb.marks||{}).forEach(k=>{
        const m = nb.marks[k];
        const mm = lookupMeaning(k);
        if((!m.tw || m.tw.trim()==='') && mm.tw && !mm.tw.includes('未建字義')){ m.tw = mm.tw; changed=true; }
        if((!m.pos || m.pos.trim()==='') && mm.pos){ m.pos = mm.pos; changed=true; }
        if((!m.tip || m.tip.trim()==='') && mm.tip){ m.tip = mm.tip; changed=true; }
      });
    });
    if(changed){ localStorage.setItem('notebook_platform_v2', JSON.stringify(db)); }
  }

  function patchOpenEdit(){
    if(window.__vocabOpenEditPatched) return;
    window.__vocabOpenEditPatched = true;
    const original = window.openEdit;
    window.openEdit = function(key){
      const w = incrementWord(key);
      applyIntensity(); renderCaptureList(); showWord(key);
      // 不再預設開原本大彈窗；如果要編輯，使用 Word Note 裡後續可擴充。
      return w;
    };
    window.openEditOriginal = original;
  }

  function patchRender(){
    if(window.__vocabRenderPatched) return;
    window.__vocabRenderPatched = true;
    const rv = window.renderView;
    if(typeof rv === 'function'){
      window.renderView = function(){ const out = rv.apply(this, arguments); setTimeout(()=>{ enrichDbMarks(); applyIntensity(); renderCaptureList(); }, 0); return out; };
    }
    const rs = window.renderSidebar;
    if(typeof rs === 'function'){
      window.renderSidebar = function(){ const out = rs.apply(this, arguments); setTimeout(()=>{ injectUI(); renderCaptureList(); },0); return out; };
    }
  }

  function dueWords(){
    const s = state(); const now = Date.now();
    return Object.values(s.words).filter(w=>w.captured && !w.known && (w.dueAt||0) && w.dueAt <= now).sort((a,b)=>(b.clicks||0)-(a.clicks||0));
  }
  let flashQueue = [], flashCurrent = null;
  function startFlashcards(force){
    flashQueue = force ? Object.values(state().words).filter(w=>w.captured&&!w.known).sort((a,b)=>(b.clicks||0)-(a.clicks||0)) : dueWords();
    if(!flashQueue.length){ if(force) alert('目前沒有需要複習的捕獲單字。'); return; }
    showNextFlash();
  }
  function showNextFlash(){
    flashCurrent = flashQueue.shift();
    if(!flashCurrent){ document.getElementById('flashModal').classList.remove('show'); return; }
    document.getElementById('flashQ').textContent = flashCurrent.word;
    document.getElementById('flashMeta').textContent = `點擊 ${flashCurrent.clicks||0} 次 · 先想中文意思，再看答案`;
    const ans = document.getElementById('flashAns');
    ans.classList.remove('show');
    ans.innerHTML = `<b>${escapeHtml(flashCurrent.pos||'')}</b> ${escapeHtml(flashCurrent.tw||'')}<br><small>${escapeHtml(flashCurrent.tip||'')}</small>`;
    document.getElementById('flashModal').classList.add('show');
  }

  function bindFlash(){
    document.getElementById('flashShow').onclick = ()=>document.getElementById('flashAns').classList.add('show');
    document.getElementById('flashHard').onclick = ()=>{ if(flashCurrent) markHard(flashCurrent.word); showNextFlash(); };
    document.getElementById('flashKnown').onclick = ()=>{ if(flashCurrent) setKnown(flashCurrent.word); showNextFlash(); };
    document.getElementById('flashClose').onclick = ()=>document.getElementById('flashModal').classList.remove('show');
  }

  function escapeHtml(s){ return String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }

  function boot(){
    injectCSS(); injectUI(); patchOpenEdit(); patchRender(); enrichDbMarks(); applyIntensity(); renderCaptureList(); bindFlash();
    setInterval(()=>startFlashcards(false), REVIEW_INTERVAL_MS);
    setTimeout(()=>startFlashcards(false), 3000);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
