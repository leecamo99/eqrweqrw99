
/* gemini-weak-article-patch-v2.js v20260706-2
   Gemini weak-word article generator with 429 protection.
   Fixes:
   - Prevent duplicate generate clicks while request is in progress
   - Gracefully handles 429 RESOURCE_EXHAUSTED / quota exceeded
   - Adds local fallback: copy prompt if Gemini quota is unavailable
   - Stores generated articles in db.generatedArticles
   Install after anki-srs-stats-patch.js:
   <script src="./gemini-weak-article-patch-v2.js?v=20260706-2"></script>
*/
(function(){
  'use strict';
  const STORE='notebook_platform_v3';
  const KEY='notebook_gemini_api_key_v1';
  const MODEL_KEY='notebook_gemini_model_v1';
  const DEFAULT_MODEL='gemini-2.5-flash';
  let inFlight=false;

  function esc(s){return String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));}
  function getDB(){let d={};try{d=JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){};d.learn=d.learn||{};return d;}
  function setDB(d){d=d||{};d.learn=d.learn||{};d.updatedAt=Date.now();localStorage.setItem(STORE,JSON.stringify(d));try{db=d;}catch(e){};return d;}
  function getModel(){return localStorage.getItem(MODEL_KEY)||DEFAULT_MODEL;}
  function weakItems(){
    const d=getDB();
    return Object.values(d.learn||{})
      .filter(x=>(x.lifetimeClicks||0)>=10||(x.maxClickStreak||0)>=10||x.isWeak||((x.clicks||0)>=10))
      .sort((a,b)=>(b.lifetimeClicks||b.clicks||0)-(a.lifetimeClicks||a.clicks||0));
  }
  function buildPrompt(){
    const items=weakItems().slice(0,35);
    const list=items.map(x=>`${x.lemma||x.word}${x.tw?`（${x.tw}）`:''}`).join(', ');
    return `你是一位英文學習教練。請根據以下弱點單字，寫一篇自然、可朗讀、適合中級英文學習者的英文短文。\n\n要求：\n1. 英文文章約 250-350 字。\n2. 主題貼近日常、職場、學習或安全流程，不要過度堆砌單字。\n3. 每個弱點單字至少自然使用一次，可以使用正確詞形變化。\n4. 文章後面用繁體中文列出「單字複習表」：單字 / 詞性 / 繁中意思 / 文章中的一句例句。\n5. 最後提供 5 題簡短理解問題。\n6. 請直接輸出內容，不要解釋你如何生成。\n\n弱點單字：${list||'目前沒有足夠弱點單字，請先點擊一些不熟的單字。'}`;
  }
  function parseError(text){
    try{return JSON.parse(text)}catch(e){return null;}
  }
  async function callGemini(prompt){
    const key=localStorage.getItem(KEY)||'';
    if(!key)throw new Error('請先設定 Gemini API Key');
    const model=getModel();
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.72,topP:0.9,maxOutputTokens:1500}})});
    const text=await res.text();
    if(!res.ok){
      const err=parseError(text);
      const msg=err?.error?.message || text.slice(0,300);
      const e=new Error(`Gemini API ${res.status}: ${msg}`);
      e.status=res.status;
      e.raw=err||text;
      throw e;
    }
    const data=JSON.parse(text);
    const out=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n')||'';
    if(!out.trim())throw new Error('Gemini 回傳空內容');
    return out;
  }
  function ensureModal(){
    let m=document.getElementById('geminiWeakArticleModal');
    if(m)return m;
    const style=document.createElement('style');style.id='geminiWeakArticleStyle';style.textContent=`
      #geminiWeakArticleModal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99985;display:none;overflow:auto;padding:18px;font-family:Segoe UI,Microsoft JhengHei,sans-serif;color:#111;}
      #geminiWeakArticleModal.show{display:block;}
      #geminiWeakArticleBox{max-width:980px;margin:0 auto;background:#f8f7f2;border-radius:10px;padding:16px;box-shadow:0 14px 38px rgba(0,0,0,.35);}
      #geminiWeakArticleTop{display:flex;gap:8px;align-items:center;margin-bottom:10px}#geminiWeakArticleTop h2{flex:1;margin:0;font-size:22px}
      .gemBtn{border:1px solid #aaa;background:#fff;border-radius:6px;padding:7px 10px;cursor:pointer}.gemBtn.primary{background:#2f6f9f;color:#fff;border-color:#2f6f9f}.gemBtn:disabled{opacity:.55;cursor:not-allowed}
      #geminiPrompt,#geminiOutput{width:100%;border:1px solid #ccc;border-radius:8px;padding:10px;background:#fff;font-size:14px;line-height:1.6;box-sizing:border-box;}
      #geminiPrompt{min-height:130px}#geminiOutput{min-height:320px;white-space:pre-wrap;overflow:auto;}
      .gemHint{font-size:12px;color:#666;margin:6px 0 10px}.gemWarn{background:#fff4d6;border:1px solid #e5c36b;border-radius:8px;padding:8px;margin:8px 0;color:#594300}
      @media(max-width:760px){#geminiWeakArticleModal{padding:8px}#geminiWeakArticleTop{flex-wrap:wrap}#geminiWeakArticleTop h2{font-size:18px;flex-basis:100%}}
    `;document.head.appendChild(style);
    m=document.createElement('div');m.id='geminiWeakArticleModal';
    m.innerHTML=`<div id="geminiWeakArticleBox"><div id="geminiWeakArticleTop"><h2>Gemini 弱點文章生成</h2><button class="gemBtn" id="gemSetKey">設定 Key</button><button class="gemBtn" id="gemSetModel">模型</button><button class="gemBtn primary" id="gemGenerate">生成文章</button><button class="gemBtn" id="gemCopyPrompt">複製 Prompt</button><button class="gemBtn" id="gemCopy">複製結果</button><button class="gemBtn" id="gemClose">Close</button></div><div class="gemHint">會從 db.learn 讀取 lifetimeClicks / maxClickStreak >= 10 的弱點字。Key 只存在本機 localStorage。若遇到 429，代表 Gemini 專案或區域的每分鐘請求額度已用完。</div><div id="gemNotice"></div><label>Prompt</label><textarea id="geminiPrompt"></textarea><br><br><label>Gemini Output</label><div id="geminiOutput">待生成...</div></div>`;
    document.body.appendChild(m);
    document.getElementById('gemClose').onclick=()=>m.classList.remove('show');
    document.getElementById('gemSetKey').onclick=setKey;
    document.getElementById('gemSetModel').onclick=setModel;
    document.getElementById('gemGenerate').onclick=generate;
    document.getElementById('gemCopyPrompt').onclick=()=>{navigator.clipboard.writeText(document.getElementById('geminiPrompt').value).then(()=>alert('已複製 Prompt'));};
    document.getElementById('gemCopy').onclick=()=>{const t=document.getElementById('geminiOutput').innerText;navigator.clipboard.writeText(t).then(()=>alert('已複製文章'));};
    return m;
  }
  function setKey(){
    const old=localStorage.getItem(KEY)||'';
    const k=prompt('貼上 Gemini API Key（儲存在本機 localStorage；公開網站建議改用後端 proxy）',old);
    if(k===null)return;
    if(k.trim())localStorage.setItem(KEY,k.trim());else localStorage.removeItem(KEY);
    alert(k.trim()?'Gemini API Key 已儲存':'Gemini API Key 已清除');
  }
  function setModel(){
    const old=getModel();
    const m=prompt('Gemini model，例如 gemini-2.5-flash 或 gemini-1.5-flash',old);
    if(m===null)return;
    if(m.trim())localStorage.setItem(MODEL_KEY,m.trim());else localStorage.removeItem(MODEL_KEY);
    alert('模型已設定為：'+getModel());
  }
  function setBusy(busy){
    inFlight=busy;
    const btn=document.getElementById('gemGenerate');
    if(btn){btn.disabled=busy;btn.textContent=busy?'生成中...':'生成文章';}
  }
  function notice(html){const n=document.getElementById('gemNotice');if(n)n.innerHTML=html||'';}
  async function generate(){
    if(inFlight)return;
    const out=document.getElementById('geminiOutput');
    const prompt=document.getElementById('geminiPrompt').value||buildPrompt();
    setBusy(true); notice(''); out.textContent='生成中...';
    try{
      const text=await callGemini(prompt);
      out.textContent=text;
      const d=getDB();d.generatedArticles=d.generatedArticles||[];d.generatedArticles.unshift({ts:Date.now(),type:'weakWords',model:getModel(),prompt,result:text,words:weakItems().slice(0,35).map(x=>x.lemma||x.word)});d.generatedArticles=d.generatedArticles.slice(0,20);setDB(d);
    }catch(e){
      console.error(e);
      if(e.status===429){
        notice('<div class="gemWarn"><b>Gemini 429 / Too Many Requests</b><br>Gemini 已回報每分鐘請求額度超過限制。這不是 Notebook 程式壞掉。你可以先用「複製 Prompt」到外部 Gemini/AI Studio，或調整 Gemini 專案配額/模型後再生成。</div>');
      }
      out.textContent='生成失敗：'+e.message;
    }finally{setBusy(false);}
  }
  function open(){const m=ensureModal();document.getElementById('geminiPrompt').value=buildPrompt();document.getElementById('geminiOutput').textContent='待生成...';notice('');m.classList.add('show');}
  function injectButton(){
    const side=document.getElementById('side');if(!side)return;
    const old=document.getElementById('geminiWeakBtn');if(old)old.remove();
    const b=document.createElement('button');b.id='geminiWeakBtn';b.className='sidebtn hi';b.textContent='Gemini 弱點文章';b.onclick=open;
    const ref=document.getElementById('ankiStatsBtn');
    if(ref&&ref.parentNode)ref.parentNode.insertBefore(b,ref.nextSibling);else side.insertBefore(b,side.firstChild);
  }
  setTimeout(()=>{injectButton();console.log('Gemini weak article patch v2 loaded');},500);
  window.openGeminiWeakArticle=open;
  window.setGeminiApiKey=setKey;
})();
