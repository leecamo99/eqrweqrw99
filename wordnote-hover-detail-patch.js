
/* wordnote-hover-detail-patch.js v20260706-1
   Adds a clean custom hover popover for WORD NOTE translation details.
   Works with dual-engine-lemma-translation-patch-v3.js.
   Behavior:
   - The visible card keeps only the Chinese translation.
   - Move mouse over the Chinese translation area to show engine + English definition.
   - Hides native title text and uses a readable floating panel instead.
*/
(function(){
  'use strict';
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
      if(item.engine) parts.push('Auto translated by ' + item.engine);
      if(item.tip) parts.push(item.tip);
      if(item.lastForm) parts.push('Form: ' + item.lastForm);
      if(item.variants){
        const variants = Object.entries(item.variants).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ×${v}`).join(', ');
        if(variants) parts.push('Variants: ' + variants);
      }
      return parts.join('\n');
    }catch(e){return '';}
  }
  function normalizeDetail(raw){
    let text = String(raw||'').trim();
    if(!text) text = getDetailFromDB();
    if(!text) return '';
    // Split common separators into readable lines.
    return text
      .replace(/｜/g, '\n')
      .replace(/\s*\|\s*/g, '\n')
      .replace(/Auto translated by/g, 'Auto translated by')
      .trim();
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
    const text = normalizeDetail(detail);
    if(!text) return;
    const el = ensureTip();
    const lines = text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    el.innerHTML = '<div style="font-weight:700;color:#f4d27a;margin-bottom:6px">詳細英文解釋</div>' +
      lines.map(line => `<div>${esc(line)}</div>`).join('');
    positionTip(e);
  }
  function hideTip(){
    if(tipEl) tipEl.style.display = 'none';
  }
  function bindMeaning(){
    const meaning = document.querySelector('#dockBody .meaning');
    if(!meaning || meaning.dataset.hoverDetailBound === '1') return;
    meaning.dataset.hoverDetailBound = '1';
    // Prefer existing title from v3, then move to data-detail to avoid tiny native tooltip.
    const detail = meaning.getAttribute('title') || getDetailFromDB();
    if(detail){
      meaning.dataset.detail = detail;
      meaning.removeAttribute('title');
    }
    meaning.style.cursor = 'help';
    meaning.addEventListener('mouseenter', e => showTip(e, meaning.dataset.detail || getDetailFromDB()));
    meaning.addEventListener('mousemove', e => positionTip(e));
    meaning.addEventListener('mouseleave', hideTip);
  }
  const obs = new MutationObserver(()=>setTimeout(bindMeaning, 0));
  function boot(){
    ensureTip();
    bindMeaning();
    const dock = document.getElementById('dockBody');
    if(dock) obs.observe(dock,{childList:true,subtree:true});
    console.log('WORD NOTE hover detail patch loaded');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
