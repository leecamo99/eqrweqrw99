
/* sync-study-notes-from-learn-patch.js v20260705-1
   Purpose:
   - Keep STUDY NOTES in sync with generated translations stored in db.learn.
   - When a clicked word is translated under its lemma, this patch copies the lemma translation
     back into each notebook's marks entry, so STUDY NOTES stops showing "未建字義".
   - Safe to load after dual-engine-lemma-translation-patch-v2.js.
*/
(function(){
  'use strict';
  const STORE = 'notebook_platform_v3';

  function loadDB(){
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
    catch(e){ return {}; }
  }
  function saveDB(db){
    db = normalize(db);
    localStorage.setItem(STORE, JSON.stringify(db));
    try { window.db = db; } catch(e) {}
  }
  function normalize(db){
    db = db || {};
    db.notebooks = db.notebooks || [];
    db.learn = db.learn || {};
    db.dark = !!db.dark;
    db.updatedAt = db.updatedAt || Date.now();
    return db;
  }
  function lemmatizeSafe(word){
    try {
      if (typeof window.lemmatizeWord === 'function') return window.lemmatizeWord(word).lemma || word;
    } catch(e) {}
    return String(word || '').trim().toLowerCase();
  }
  function isEmptyMeaning(v){
    return !v || String(v).includes('未建字義') || String(v).includes('請自行補充') || String(v).includes('查詢中');
  }

  window.syncStudyNotesFromLearn = function syncStudyNotesFromLearn(){
    const db = normalize(loadDB());
    let changed = false;

    db.notebooks.forEach(nb => {
      nb.marks = nb.marks || {};
      Object.keys(nb.marks).forEach(surface => {
        const lemma = lemmatizeSafe(surface);
        const learned = db.learn[lemma] || db.learn[surface];
        if (!learned) return;

        const mark = nb.marks[surface] || {};

        // Only overwrite empty/placeholder meanings; do not destroy manually curated notes.
        if (learned.tw && !String(learned.tw).includes('查詢中') && isEmptyMeaning(mark.tw)) {
          mark.tw = learned.tw;
          changed = true;
        }
        if (learned.pos && !mark.pos) {
          mark.pos = learned.pos;
          changed = true;
        }
        if (learned.tip && isEmptyMeaning(mark.tip)) {
          mark.tip = learned.tip;
          changed = true;
        }
        mark.lemma = lemma;
        nb.marks[surface] = mark;
      });
    });

    if (changed) {
      db.updatedAt = Date.now();
      saveDB(db);
      try { if (typeof window.render === 'function') window.render(); } catch(e) {}
      try { if (typeof window.renderCapture === 'function') window.renderCapture(); } catch(e) {}
      try { if (typeof window.applyIntensity === 'function') window.applyIntensity(); } catch(e) {}
    }
    return changed;
  };

  // Wrap clickWord so after translation has time to return, STUDY NOTES refreshes automatically.
  const prevClickWord = window.clickWord;
  if (typeof prevClickWord === 'function' && !window.__syncStudyNotesClickPatched) {
    window.__syncStudyNotesClickPatched = true;
    window.clickWord = function(word){
      const result = prevClickWord.apply(this, arguments);
      setTimeout(window.syncStudyNotesFromLearn, 1200);
      setTimeout(window.syncStudyNotesFromLearn, 3500);
      setTimeout(window.syncStudyNotesFromLearn, 7000);
      return result;
    };
  }

  // Also run when page renders or when loaded.
  setTimeout(window.syncStudyNotesFromLearn, 1000);
  setTimeout(window.syncStudyNotesFromLearn, 4000);

  console.log('Study Notes sync patch loaded');
})();
