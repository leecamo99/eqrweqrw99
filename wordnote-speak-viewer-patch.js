// wordnote-speak-viewer-patch.js v20260709-1
// Non-destructive viewer: shows all 🔊 buttons in WORD NOTE side-by-side
// with source label so user can decide which one to keep.

(function(){

  console.log('[SpeakViewer] loaded');

  const RE_SPEAK = /🔊|speak|發音/i;

  function findDock(){
    return (
      document.getElementById('dock') ||
      document.querySelector('.wordnote') ||
      document.querySelector('.word-note') ||
      document.getElementById('wordNote')
    );
  }

  function labelOf(btn){

    // 猜測按鈕來源
    const src =
      btn.dataset.source ||
      btn.getAttribute('data-patch') ||
      btn.title ||
      '';

    if(src) return src;

    const cls = (btn.className || '').toString();

    if(/gctts/i.test(cls))   return 'Google Cloud TTS';

    if(/mymemory/i.test(cls))return 'MyMemory';

    if(/dual/i.test(cls))    return 'dual-engine';

    if(/hover/i.test(cls))   return 'hover-detail';

    if(/anki/i.test(cls))    return 'anki';

    if(cls) return cls.slice(0, 40);

    return '(no source)';
  }

  function render(){

    const dock = findDock();

    if(!dock) return;

    const buttons = Array.from(
      dock.querySelectorAll('button')
    ).filter(
      btn => RE_SPEAK.test(btn.textContent || '')
    );

    if(!buttons.length) return;

    let box = dock.querySelector('#speakViewerBox');

    if(!box){

      box = document.createElement('div');

      box.id = 'speakViewerBox';

      box.style.cssText = `
        margin-top:8px;
        padding:6px;
        border:1px dashed #f4d27a;
        border-radius:6px;
        background:#111827;
        color:#f4f4f5;
        font-size:12px;
      `;

      dock.appendChild(box);
    }

    box.innerHTML = '';

    const title = document.createElement('div');

    title.textContent =
      '目前發現 ' + buttons.length + ' 顆 🔊 按鈕';

    title.style.cssText = `
      color:#f4d27a;
      margin-bottom:4px;
    `;

    box.appendChild(title);

    const row = document.createElement('div');

    row.style.cssText = `
      display:flex;
      flex-wrap:wrap;
      gap:6px;
    `;

    box.appendChild(row);

    buttons.forEach((btn, i) => {

      const item = document.createElement('div');

      item.style.cssText = `
        display:flex;
        flex-direction:column;
        gap:2px;
        padding:4px;
        background:#1f2937;
        border-radius:6px;
        min-width:120px;
      `;

      const num = document.createElement('div');

      num.textContent = '#' + (i+1);

      num.style.cssText = `
        color:#9ca3af;
        font-size:11px;
      `;

      const label = document.createElement('div');

      label.textContent = labelOf(btn);

      label.style.cssText = `
        color:#facc15;
        font-size:11px;
        word-break:break-all;
      `;

      const preview = document.createElement('div');

      preview.textContent =
        (btn.textContent || '').trim().slice(0, 20);

      preview.style.cssText = `
        color:#a1a1aa;
        font-size:11px;
      `;

      const btnBox = document.createElement('div');

      btnBox.style.cssText = `
        display:flex;
        gap:4px;
        margin-top:4px;
      `;

      const testBtn = document.createElement('button');

      testBtn.textContent = '試播';

      testBtn.style.cssText = `
        flex:1;
        padding:2px 4px;
        border:none;
        border-radius:4px;
        background:#374151;
        color:#fff;
        cursor:pointer;
      `;

      testBtn.onclick = () => {

        try{
          btn.click();
        }catch(e){}

      };

      const focusBtn = document.createElement('button');

      focusBtn.textContent = '定位';

      focusBtn.style.cssText = `
        flex:1;
        padding:2px 4px;
        border:none;
        border-radius:4px;
        background:#4b5563;
        color:#fff;
        cursor:pointer;
      `;

      focusBtn.onclick = () => {

        btn.scrollIntoView({
          behavior:'smooth',
          block:'center'
        });

        btn.style.outline = '2px solid #f4d27a';

        setTimeout(() => {
          btn.style.outline = '';
        }, 1500);

      };

      btnBox.appendChild(testBtn);
      btnBox.appendChild(focusBtn);

      item.appendChild(num);
      item.appendChild(label);
      item.appendChild(preview);
      item.appendChild(btnBox);

      row.appendChild(item);
    });
  }

  const dock = findDock();

  if(dock){

    const observer = new MutationObserver(() => {
      render();
    });

    observer.observe(dock, {
      childList: true,
      subtree: true
    });
  }

  setInterval(render, 800);

  render();

})();
