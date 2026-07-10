// wordnote-speak-inspector-patch.js v20260709-1
// Show all duplicated 🔊 speak buttons side-by-side with delete option

(function(){

  console.log('[SpeakInspector] loaded');

  const RE_SPEAK = /🔊|speak|發音/i;

  function findDock(){
    return (
      document.getElementById('dock') ||
      document.querySelector('.wordnote') ||
      document.querySelector('.word-note') ||
      document.getElementById('wordNote')
    );
  }

  function tagButtons(){

    const dock = findDock();

    if(!dock) return;

    const buttons = Array.from(
      dock.querySelectorAll('button')
    ).filter(
      btn => RE_SPEAK.test(btn.textContent || '')
    );

    if(!buttons.length) return;

    // 已標記過就不再處理
    if(dock.dataset.__speakInspected === String(buttons.length)){
      return;
    }
    dock.dataset.__speakInspected = String(buttons.length);

    // 建立容器
    let bar = dock.querySelector('#speakInspectBar');

    if(!bar){

      bar = document.createElement('div');
      bar.id = 'speakInspectBar';
      bar.style.cssText = `
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:6px;
        padding:6px;
        background:#111827;
        border:1px dashed #f4d27a;
        border-radius:6px;
      `;

      dock.appendChild(bar);
    }
    else{
      bar.innerHTML = '';
    }

    const title = document.createElement('div');

    title.textContent =
      '共 ' + buttons.length + ' 顆 🔊 按鈕（點✕手動刪除）';

    title.style.cssText = `
      width:100%;
      font-size:12px;
      color:#f4d27a;
    `;

    bar.appendChild(title);

    buttons.forEach((btn, i) => {

      const wrap = document.createElement('div');

      wrap.style.cssText = `
        display:flex;
        align-items:center;
        gap:4px;
        padding:2px 4px;
        background:#1f2937;
        border:1px solid #374151;
        border-radius:6px;
      `;

      const badge = document.createElement('span');

      badge.textContent = '#' + (i+1);

      badge.style.cssText = `
        font-size:12px;
        color:#9ca3af;
      `;

      // 嘗試找來源提示
      const source =
        btn.dataset.source ||
        btn.getAttribute('data-patch') ||
        btn.title ||
        btn.className ||
        '';

      const info = document.createElement('span');

      info.textContent = source || '(unknown source)';

      info.style.cssText = `
        font-size:11px;
        color:#a1a1aa;
        max-width:180px;
        overflow:hidden;
        white-space:nowrap;
        text-overflow:ellipsis;
      `;

      // Clone 按鈕（觸發原按鈕行為）
      const clone = btn.cloneNode(true);

      clone.style.cssText = `
        padding:4px 8px;
        border-radius:6px;
        background:#374151;
        color:#fff;
        cursor:pointer;
        font-size:12px;
        border:none;
      `;

      clone.onclick = () => {

        try{

          btn.click();

        }catch(e){}

      };

      // 刪除按鈕
      const del = document.createElement('button');

      del.textContent = '✕';

      del.title = '刪除這顆 🔊 按鈕';

      del.style.cssText = `
        color:#f87171;
        border:none;
        background:transparent;
        cursor:pointer;
        font-size:14px;
      `;

      del.onclick = () => {

        try{
          btn.remove();
        }catch(e){}

        wrap.remove();
      };

      wrap.appendChild(badge);
      wrap.appendChild(clone);
      wrap.appendChild(info);
      wrap.appendChild(del);

      bar.appendChild(wrap);
    });
  }

  const dock = findDock();

  if(dock){

    const observer = new MutationObserver(() => {

      tagButtons();

    });

    observer.observe(dock, {
      childList:true,
      subtree:true
    });
  }

  setInterval(tagButtons, 800);

  tagButtons();

})();
