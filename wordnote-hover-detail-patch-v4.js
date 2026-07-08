/* wordnote-hover-detail-patch-v4.js (Integrated with Mini TTS Patch)
   1. Fix duplicate detail lines in WORD NOTE hover popover.
   2. Inject immune Mini TTS Audio button into Flashcard Modal.
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
      'position:fixed', 'z-index:99999', 'display:none',
      'max-width:min(520px, calc(100vw - 32px))', 'background:#2f3f52', 'color:#fff8e8',
      'border:1px solid rgba(255,255,255,.25)', 'box-shadow:0 10px 28px rgba(0,0,0,.28)',
      'border-radius:8px', 'padding:12px 14px',
      'font:14px/1.65 Microsoft JhengHei, system-ui, sans-serif',
      'white-space:normal', 'pointer-events:none'
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
        const variants = Object.entries(item.variants).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ×${v}`).join(', ');
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
    return uniqueLines(text.replace(/｜/g, '\n').replace(/\s*\|\s*/g, '\n').split(/\n+/).map(x=>x.trim()).filter(Boolean));
  }
  
  function positionTip(e){
    const el = ensureTip();
    const pad = 14;
    let x = e.clientX + 16, y = e.clientY + 16;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.display = 'block';
    const r = el.getBoundingClientRect();
    if(r.right > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - r.width - pad);
    if(r.bottom > window.innerHeight - pad) y = Math.max(pad, e.clientY - r.height - 16);
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  
  function showTip(e, detail){
    const lines = normalizeDetail(detail);
    if(!lines.length) return;
    const el = ensureTip();
    el.innerHTML = '<div style="font-weight:700;color:#f4d27a;margin-bottom:6px">詳細英文解釋</div>' + lines.map(line => `<div>${esc(line)}</div>`).join('');
    positionTip(e);
  }
  
  function hideTip(){ if(tipEl) tipEl.style.display = 'none'; }
  
  function bindMeaning(){
    const meaning = document.querySelector('#dockBody .meaning');
    if(!meaning || meaning.dataset.hoverDetailBound === '2') return;
    meaning.dataset.hoverDetailBound = '2';
    const lines = normalizeDetail(meaning.getAttribute('title') || getDetailFromDB());
    if(lines.length){ meaning.dataset.detail = lines.join('\n'); meaning.removeAttribute('title'); }
    meaning.style.cursor = 'help';
    meaning.addEventListener('mouseenter', e => showTip(e, meaning.dataset.detail || getDetailFromDB()));
    meaning.addEventListener('mousemove', positionTip);
    meaning.addEventListener('mouseleave', hideTip);
  }
  
  const hoverObs = new MutationObserver(()=>setTimeout(bindMeaning, 0));

  // ==========================================
  // PART 2: 閃卡彈窗 TTS 發音 (迷你免疫版)
  // ==========================================
  async function playIndependentAudio(word) {
    try {
        // 精準清理單字，只保留英文字母
        const cleanWord = word.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/)[0];
        if (!cleanWord) return alert(`無法解析單字，抓取到的是: ${word}`);
        
        console.log(`[TTS Custom] 確定播放純單字: ${cleanWord}`);
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
        const data = await res.json();
        const audioUrl = data[0]?.phonetics?.find(p => p.audio)?.audio;
        if (audioUrl) { new Audio(audioUrl).play(); }
        else { alert(`找不到單字 "${cleanWord}" 的真人音檔`); }
    } catch (e) { console.error(e); }
  }

  function bindTTSButton() {
    if (document.getElementById('my-mini-immune-btn')) return;

    const divs = Array.from(document.querySelectorAll('div')).reverse();
    
    for (const modal of divs) {
        if (modal.textContent.includes('點擊') && modal.textContent.includes('先想中文')) {
            
            // 【強化抓字邏輯】：不要抓目前層級的字，往上層找標題！
            let word = "";
            const titleEl = document.querySelector('.word-note-popup h1, .word-note-popup h2, .word-note-popup .word-title, .wordbig');
            if (titleEl) {
                word = titleEl.textContent;
            } else {
                // 如果找不到標題標籤，就把整個視窗的文字拿來分析第一行
                const rootPopup = modal.closest('div[class*="popup"]') || modal.parentElement.parentElement;
                const firstLine = (rootPopup ? rootPopup.innerText : modal.innerText).split('\n').map(t=>t.trim()).filter(Boolean)[0];
                word = firstLine || "";
            }
            
            // 【縮小按鈕】：變成一個小小的圓圈
            const btn = document.createElement('div');
            btn.id = 'my-mini-immune-btn';
            btn.textContent = '🔊';
            btn.title = '點擊聆聽真人發音';
            btn.style.cssText = "display: inline-flex; justify-content: center; align-items: center; width: 28px; height: 28px; margin-right: 8px; background: #27ae60; color: white; border-radius: 50%; cursor: pointer; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); vertical-align: middle; transition: background 0.2s;";
            
            btn.onmouseover = () => btn.style.background = '#2ecc71';
            btn.onmouseout = () => btn.style.background = '#27ae60';

            btn.onclick = (e) => { 
                e.stopPropagation(); 
                playIndependentAudio(word); 
            };
            
            // 將小按鈕插在 "點擊 X 次..." 前面，看起來像個小 icon
            modal.prepend(btn);
            console.log(`✅ [TTS Custom] 已掛載迷你按鈕，抓取到標題: ${word}`);
            break; 
        }
    }
  }

  const ttsObs = new MutationObserver(() => setTimeout(bindTTSButton, 0));

  // ==========================================
  // 初始化
  // ==========================================
  function boot(){
    ensureTip();
    bindMeaning();
    const dock = document.getElementById('dockBody');
    if(dock) hoverObs.observe(dock, { childList: true, subtree: true });
    ttsObs.observe(document.body, { childList: true, subtree: true });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* 
   Native TTS & Detail Integration for Flashcards
   移植目標：將 Word Note 的發音邏輯與懸浮詳解直接植入閃卡
*/

(function() {
  'use strict';

  // 1. 真人發音引擎 (Google TTS) - 絕對穩定
  const playFlashcardAudio = (word) => {
    const cleanWord = word.replace(/[^a-zA-Z\s\-]/g, '').trim().split(/\s+/)[0];
    if (!cleanWord) return;
    
    // 使用 Google 翻譯引擎，繞過 404 字典接口風險
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(cleanWord)}`;
    const audio = new Audio(ttsUrl);
    
    // 強制播放，如果被瀏覽器阻擋，將會自動觸發 catch
    audio.play().catch(e => {
        console.warn("瀏覽器阻擋發音，請確認已與網頁互動過。");
    });
  };

  // 2. 注入按鈕至閃卡視窗
  const injectFlashcardFeatures = () => {
    const modal = document.querySelector('.word-note-popup, .flashcard-modal'); // 請根據你的實際 class 名稱調整
    if (!modal || modal.dataset.nativeInjected) return;
    modal.dataset.nativeInjected = 'true';

    const word = modal.querySelector('.word-title, .wordbig')?.textContent || '';
    
    // 建立發音按鈕
    const btn = document.createElement('button');
    btn.textContent = '🔊 發音';
    btn.style.cssText = "margin: 5px; padding: 5px 10px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;";
    btn.onclick = (e) => { e.stopPropagation(); playFlashcardAudio(word); };
    
    // 注入到模組標題列
    modal.prepend(btn);
  };

  // 3. 監控渲染
  const observer = new MutationObserver(injectFlashcardFeatures);
  observer.observe(document.body, { childList: true, subtree: true });
})();
