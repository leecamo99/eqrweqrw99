/* wordnote-hover-detail-patch-v3.js (Integrated with TTS Custom Patch)
   1. Fix duplicate detail lines in WORD NOTE hover popover.
      - Deduplicates repeated "Auto translated by ..."
      - Removes repeated identical lines
      - Keeps Chinese translation visible in WORD NOTE; only detailed English info appears on hover
   2. Inject immune TTS Audio button into Flashcard Modal.
*/
(function(){
  'use strict';

  // ==========================================
  // PART 1: 懸浮詳細解釋 (Hover Detail) 邏輯
  // ==========================================
  let tipEl = null;

  function esc(s){
    return String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }
  
  function ensureTip(){
    if(tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.id = 'wordnoteHoverDetail';
    tipEl.style.cssText = [
      'position:fixed',
      'z-index:99999',
      'display:none',
      'max-width:min(520px, calc(100vw - 32px))',
      'background:#2f3f52',
      'color:#fff8e8',
      'border:1px solid rgba(255,255,255,.25)',
      'box-shadow:0 10px 28px rgba(0,0,0,.28)',
      'border-radius:8px',
      'padding:12px 14px',
      'font:14px/1.65 Microsoft JhengHei, system-ui, sans-serif',
      'white-space:normal',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(tipEl);
    return tipEl;
  }
  
  function getDetailFromDB(){
    try{
      const word = document.querySelector('#dockBody .wordbig')?.textContent?.trim();
      if(!word || typeof debugLearn !== 'function') return '';
      const item = debugLearn(word);
      if(!item) return '';
      const parts = [];
      const tip = String(item.tip||'').trim();
      if(item.engine && !/^Auto translated by/i.test(tip)) parts.push('Auto translated by ' + item.engine);
      if(tip) parts.push(tip);
      if(item.lastForm) parts.push('Form: ' + item.lastForm);
      if(item.variants){
        const variants = Object.entries(item.variants)
          .sort((a,b)=>b[1]-a[1])
          .map(([k,v])=>`${k} ×${v}`)
          .join(', ');
        if(variants) parts.push('Variants: ' + variants);
      }
      return parts.join('\n');
    }catch(e){return '';}
  }
  
  function uniqueLines(lines){
    const out = [];
    const seen = new Set();
    let sawAutoTranslated = false;
    for(let line of lines){
      line = String(line||'').trim();
      if(!line) continue;
      if(/^Auto translated by/i.test(line)){
        if(sawAutoTranslated) continue;
        sawAutoTranslated = true;
      }
      const key = line.replace(/\s+/g,' ').toLowerCase();
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
    return out;
  }
  
  function normalizeDetail(raw){
    let text = String(raw||'').trim();
    if(!text) text = getDetailFromDB();
    if(!text) return [];
    const rough = text
      .replace(/｜/g, '\n')
      .replace(/\s*\|\s*/g, '\n')
      .split(/\n+/)
      .map(x=>x.trim())
      .filter(Boolean);
    return uniqueLines(rough);
  }
  
  function positionTip(e){
    const el = ensureTip();
    const pad = 14;
    let x = e.clientX + 16;
    let y = e.clientY + 16;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.display = 'block';
    const r = el.getBoundingClientRect();
    if(r.right > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - r.width - pad);
    if(r.bottom > window.innerHeight - pad) y = Math.max(pad, e.clientY - r.height - 16);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }
  
  function showTip(e, detail){
    const lines = normalizeDetail(detail);
    if(!lines.length) return;
    const el = ensureTip();
    el.innerHTML = '<div style="font-weight:700;color:#f4d27a;margin-bottom:6px">詳細英文解釋</div>' +
      lines.map(line => `<div>${esc(line)}</div>`).join('');
    positionTip(e);
  }
  
  function hideTip(){
    if(tipEl) tipEl.style.display = 'none';
  }
  
  function bindMeaning(){
    const meaning = document.querySelector('#dockBody .meaning');
    if(!meaning || meaning.dataset.hoverDetailBound === '2') return;
    meaning.dataset.hoverDetailBound = '2';

    const rawDetail = meaning.getAttribute('title') || getDetailFromDB();
    const lines = normalizeDetail(rawDetail);
    if(lines.length){
      meaning.dataset.detail = lines.join('\n');
      meaning.removeAttribute('title');
    }
    meaning.style.cursor = 'help';
    meaning.addEventListener('mouseenter', e => showTip(e, meaning.dataset.detail || getDetailFromDB()));
    meaning.addEventListener('mousemove', e => positionTip(e));
    meaning.addEventListener('mouseleave', hideTip);
  }
  
  const hoverObs = new MutationObserver(()=>setTimeout(bindMeaning, 0));


  // ==========================================
  // PART 2: 閃卡彈窗 TTS 發音 (免疫劫持版)
  // ==========================================
  async function playIndependentAudio(word) {
    console.log(`[TTS Custom] 播放: ${word}`);
    try {
        const cleanWord = word.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/)[0];
        if (!cleanWord) return alert("無法解析單字");
        
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
        const data = await res.json();
        const audioUrl = data[0]?.phonetics?.find(p => p.audio)?.audio;
        if (audioUrl) { new Audio(audioUrl).play(); }
        else { alert("找不到此單字的真人音檔"); }
    } catch (e) { console.error(e); }
  }

  function bindTTSButton() {
    if (document.getElementById('my-immune-btn')) return;

    const divs = Array.from(document.querySelectorAll('div')).reverse();
    
    for (const modal of divs) {
        if (modal.textContent.includes('點擊') && modal.textContent.includes('先想中文')) {
            const word = modal.innerText.split('\n')[0].trim();
            
            // 使用 div 取代 button，免疫舊代碼劫持變紫色
            const btn = document.createElement('div');
            btn.id = 'my-immune-btn';
            btn.textContent = '🔊 真人發音';
            btn.style.cssText = "display: inline-block; margin: 10px auto; padding: 8px 16px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: bold; text-align: center; transition: background 0.2s;";
            
            // 增加簡單的 hover 效果讓它更像按鈕
            btn.onmouseover = () => btn.style.background = '#2ecc71';
            btn.onmouseout = () => btn.style.background = '#27ae60';

            btn.onclick = (e) => { 
                e.stopPropagation(); 
                playIndependentAudio(word); 
            };
            
            modal.prepend(btn);
            console.log(`✅ [TTS Custom] 已掛載免疫按鈕，真實抓取單字: ${word}`);
            break; 
        }
    }
  }

  const ttsObs = new MutationObserver(() => setTimeout(bindTTSButton, 0));


  // ==========================================
  // 初始化 (BOOT)
  // ==========================================
  function boot(){
    // 1. 啟動 Hover Detail
    ensureTip();
    bindMeaning();
    const dock = document.getElementById('dockBody');
    if(dock) hoverObs.observe(dock, { childList: true, subtree: true });

    // 2. 啟動 TTS Button (監控全域)
    ttsObs.observe(document.body, { childList: true, subtree: true });

    console.log('✅ WORD NOTE Hover Detail & TTS Custom Patch loaded successfully');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
