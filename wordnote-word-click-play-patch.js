/* wordnote-word-click-play-patch.js v20260710-1
   Make every English word inside WORD NOTE clickable to speak.
*/

(function () {

  'use strict';

  const RE_WORD = /^[A-Za-z][A-Za-z'-]*$/;

  function getWordAtPoint(e) {

    let range = null;

    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (p) {
        range = document.createRange();
        range.setStart(p.offsetNode, p.offset);
        range.setEnd(p.offsetNode, p.offset);
      }
    }

    if (!range) return '';

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return '';

    const text = node.textContent;
    const pos = range.startOffset;

    let s = pos, en = pos;
    while (s > 0 && /[A-Za-z'-]/.test(text[s - 1])) s--;
    while (en < text.length && /[A-Za-z'-]/.test(text[en])) en++;

    return text.slice(s, en);
  }

  document.addEventListener('click', (e) => {

    const target = e.target;
    if (!target) return;

    const dock = target.closest('#dockBody');
    if (!dock) return;

    if (target.closest('button, input, textarea, select, a')) return;
    if (target.closest('#wordNoteVerbBox')) return;

    let word = '';

    if (window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) word = sel.toString().trim();
    }

    if (!word) word = getWordAtPoint(e);

    word = String(word || '').trim();
    if (!word || !RE_WORD.test(word)) return;

    if (typeof window.__speakOneWord__ !== 'function') {
      console.warn('[WordNoteClickPlay] __speakOneWord__ not ready');
      return;
    }

    console.log('[WordNoteClickPlay] click →', word);

    window.__speakOneWord__(word);

  }, true);

  console.log('[WordNoteClickPlay] ready');

})();
