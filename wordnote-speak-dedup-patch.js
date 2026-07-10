// wordnote-speak-dedup-patch.js v20260709-1
// Removes duplicated 🔊 buttons in WORD NOTE dock

(function(){

  console.log('[WordNoteSpeakDedup] loaded');

  const RE_SPEAK = /🔊|speak|發音/i;

  function findDock(){
    return (
      document.getElementById('dock') ||
      document.querySelector('.wordnote') ||
      document.querySelector('.word-note') ||
      document.getElementById('wordNote') ||
      document.body
    );
  }

  function dedupSpeakButtons(){

    const dock = findDock();
    if(!dock) return;

    const buttons = Array.from(
      dock.querySelectorAll('button')
    ).filter(btn => RE_SPEAK.test(btn.textContent || ''));

    if(buttons.length <= 1) return;

    console.log(
      '[WordNoteSpeakDedup] found',
      buttons.length,
      'speak buttons, keeping the newest'
    );

    // 保留最後一顆
    buttons.slice(0, -1).forEach(btn => {

      try{
        btn.remove();
      }catch(e){}
    });
  }

  // 監聽 dock 內容變化
  const observer = new MutationObserver(() => {
    dedupSpeakButtons();
  });

  const dock = findDock();

  if(dock){
    observer.observe(dock, {
      childList: true,
      subtree: true
    });
  }

  // 第一次
  dedupSpeakButtons();

  // 保險：每秒檢查一次
  setInterval(dedupSpeakButtons, 1000);

})();
