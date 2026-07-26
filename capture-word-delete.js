// capture-word-delete.js
(() => {
  'use strict';

  const STORE = 'notebook_platform_v3';
  const BODY_ID = 'capBody';

  function deleteWord(item) {
    const word = item?.dataset?.cap;
    if (!word) return;

    let data;
    try {
      data = JSON.parse(localStorage.getItem(STORE) || '{}');
    } catch {
      data = {};
    }

    data.learn ||= {};

    for (const [key, value] of Object.entries(data.learn)) {
      if (key === word || value?.word === word || value?.lemma === word) {
        delete data.learn[key];
      }
    }

    data.updatedAt = Date.now();
    localStorage.setItem(STORE, JSON.stringify(data));
    item.remove();
    console.log('[CaptureDelete] deleted:', word);
  }

  function injectButtons() {
    const body = document.getElementById(BODY_ID);
    if (!body) return;

    body.querySelectorAll('.capitem').forEach(item => {
      if (item.querySelector('.cap-delete-btn')) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cap-delete-btn';
      btn.textContent = '×';
      btn.title = '刪除此單字';
      btn.setAttribute('aria-label', '刪除此單字');
      btn.style.cssText = [
        'margin-left:auto',
        'border:0',
        'background:transparent',
        'color:var(--danger,#9c5b5b)',
        'font-size:18px',
        'line-height:1',
        'cursor:pointer',
        'padding:4px 6px',
        'flex:0 0 auto'
      ].join(';');

      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        deleteWord(item);
      });

      item.appendChild(btn);
    });
  }

  function start() {
    const body = document.getElementById(BODY_ID);
    if (!body) return setTimeout(start, 200);

    injectButtons();
    new MutationObserver(injectButtons).observe(body, {
      childList: true,
      subtree: true
    });

    console.log('[CaptureDelete] ready');
  }

  start();
})();
