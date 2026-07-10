// audio-manager-patch.js v20260709-1
// Patch A: single audio channel manager
// - Stops previous audio before playing new one
// - Cancels speechSynthesis when new audio starts
// - Cancels Google Cloud TTS when speechSynthesis is triggered
// - Removes duplicated speak listeners on WORD NOTE 🔊 button

(function(){

  console.log('[AudioManager] loaded');

  const M = window.__AUDIO_MANAGER__ = {

    current: null,

    stopAll(){

      // stop Web Speech
      try{
        if(window.speechSynthesis){
          speechSynthesis.cancel();
        }
      }catch(e){}

      // stop current audio
      if(M.current){
        try{
          M.current.pause();
          M.current.currentTime = 0;
        }catch(e){}
        M.current = null;
      }

      // stop Google Cloud TTS panel if exists
      const gStopBtn = document.getElementById('gcttsStop');
      if(gStopBtn && typeof gStopBtn.click === 'function'){
        try{ gStopBtn.click(); }catch(e){}
      }
    },

    register(audio){
      M.stopAll();
      M.current = audio;
    }

  };

  // ---- Wrap Audio.prototype.play ----
  const originalPlay = HTMLAudioElement.prototype.play;

  HTMLAudioElement.prototype.play = function(){

    try{
      M.register(this);
    }catch(e){}

    return originalPlay.apply(this, arguments);
  };

  // ---- Wrap speechSynthesis.speak ----
  if(window.speechSynthesis){

    const originalSpeak = speechSynthesis.speak.bind(speechSynthesis);

    speechSynthesis.speak = function(utter){

      try{
        M.stopAll();
      }catch(e){}

      return originalSpeak(utter);
    };
  }

  // ---- Fix WORD NOTE 🔊 duplicated listeners ----
  // We rely on delegation instead of per-button binding.
  document.addEventListener('click', (e)=>{

    const target = e.target;

    if(!target) return;

    // 支援 emoji 或英文按鈕
    const isSpeakBtn =
      target.matches('button') &&
      /🔊|speak|speak-word|發音/i.test(target.textContent || '');

    if(!isSpeakBtn) return;

    // 找出對應的單字
    const wordEl =
      target
        .closest('.word-note, .dock, #dock, .wordnote, #capBody')
        ?.querySelector('h1, .word-title, .word-en, .en-word');

    const word =
      (wordEl?.textContent || target.dataset.word || '')
        .replace(/\s+/g,' ')
        .trim();

    if(!word) return;

    // 停掉其他語音，再播單字
    M.stopAll();

    try{

      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.9;

      speechSynthesis.speak(u);

    }catch(err){
      console.warn('[AudioManager] speak error', err);
    }

  }, true);

  console.log('[AudioManager] ready');

})();
