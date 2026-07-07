// google-cloud-tts-reader-patch-v7.js
// Mobile Mini / Hide / Full mode for gcttsPanel

(function(){

  const KEY='tts_panel_mode';

  function panel(){
    return document.getElementById('gcttsPanel');
  }

  function apply(mode){

    const p=panel();
    if(!p) return;

    localStorage.setItem(KEY,mode);

    p.style.transition='height .25s ease';
    p.style.overflow='hidden';

    const rows=p.querySelectorAll('div');

    if(mode==='full'){

      p.style.height='170px';
      document.body.style.paddingBottom='170px';

      rows.forEach(r=>{
        r.style.display='';
      });

    }

    else if(mode==='mini'){

      p.style.height='58px';
      document.body.style.paddingBottom='70px';

      if(rows[1]) rows[1].style.display='none';
      if(rows[2]) rows[2].style.display='none';

    }

    else{

      p.style.height='30px';
      document.body.style.paddingBottom='35px';

      if(rows[1]) rows[1].style.display='none';
      if(rows[2]) rows[2].style.display='none';

    }

  }

  function init(){

    const p=panel();

    if(!p) return;

    if(document.getElementById('ttsModeBtn')) return;

    const btn=document.createElement('button');

    btn.id='ttsModeBtn';

    btn.style.cssText=
      position:absolute;
      right:65px;
      top:8px;
      z-index:999999;
      padding:4px 8px;
    ;

    let mode=
      localStorage.getItem(KEY)
      || (
        window.innerWidth<768
          ? 'mini'
          : 'full'
      );

    btn.textContent=
      mode==='full'
        ? '▾'
        : mode==='mini'
            ? '▸'
            : '▲';

    apply(mode);

    btn.onclick=()=>{

      mode=
        mode==='full'
          ? 'mini'
          : mode==='mini'
              ? 'hide'
              : 'full';

      btn.textContent=
        mode==='full'
          ? '▾'
          : mode==='mini'
              ? '▸'
              : '▲';

      apply(mode);

    };

    p.appendChild(btn);

  }

  setInterval(init,500);

})();
