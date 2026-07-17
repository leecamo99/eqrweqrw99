/*!
 * lemma*alias-known-fix-patch.js v20260717*1
 * 修**follow*/ following *類 lemma*與變形字分*問題
 */
*function(){
  'use strict';

  con*t STORE = 'notebook_platform_v3';
*  function getDB(){
    try{
     *return JSON.parse(localStorage.get*tem(STORE) || '{}');
    }catch(e)*
      return {};
    }
  }

  fun*tion setDB(db){
    localStorage.s*tItem(STORE, JSON.stringify(db));
* }

  function simpleLemma(w){
    w = String(w || '').toLowerCase().trim();

    if(w === 'following') return 'follow';

    if(w.endsWith('ing') && w.length > 5){
      let root = w.slice(0, -3);

      // running -> run
      if(root.length >= 3 && root[root.length - 1] === root[root.length - 2]){
        root = root.slice(0, -1);
      }

      return root;
    }

    if(w.endsWith('ed') && w.length > 4){
      let root = w.slice(0, -2);
      if(root.length >= 3 && root[root.length - 1] === root[root.length - 2]){
        root = root.slice(0, -1);
      }
      return root;
    }

    if(w.endsWith('s') && w.length > 3){
      return w.slice(0, -1);
    }

    return w;
  }

  function markKnownEveryAlias(word){
    const db = getDB();
    db.learn = db.learn || {};

    const lemma = simpleLemma(word);
    const targets = new Set([word, lemma]);

    Object.keys(db.learn).forEach(k=>{
      const x = db.learn[k];
      const kLemma = simpleLemma(k);
      const storedLemma = x && (x.lemma || x.word);

      if(
        k === word ||
        k === lemma ||
        kLemma === lemma ||
        storedLemma === lemma ||
        storedLemma === word
      ){
        targets.add(k);
      }
    });

    targets.forEach(k=>{
      if(db.learn[k]){
        db.learn[k].clicks = 0;
        db.learn[k].strength = 0;
        db.learn[k].captured = false;
        db.learn[k].known = true;
        db.learn[k].dueAt = 0;
        db.learn[k].updatedAt = Date.now();
      }
    });

    setDB(db);

    if(typeof window.renderCapture === 'function'){
      try{ window.renderCapture(); }catch(e){}
    }

    if(typeof window.applyIntensity === 'function'){
      try{ window.applyIntensity(); }catch(e){}
    }

    return Array.from(targets);
  }

  const oldKnown = window.known;

  window.known = function(word){
    const fixed = markKnownEveryAlias(word);

    if(typeof oldKnown === 'function'){
      try{ oldKnown(word); }catch(e){}
    }

    console.log('[LemmaAliasKnownFix] known aliases:', fixed);
  };

  const oldFlashKnown = window.flashKnown;

  window.flashKnown = function(){
    let word = null;

    try{
      word = window.flashCurrent && window.flashCurrent.word;
    }catch(e){}

    if(word){
      markKnownEveryAlias(word);
    }

    if(typeof oldFlashKnown === 'function'){
      try{
        oldFlashKnown();
        return;
      }catch(e){}
    }

    if(typeof window.nextFlash === 'function'){
      window.nextFlash();
    }
  };

  console.log('[LemmaAliasKnownFix] loaded');
})();
