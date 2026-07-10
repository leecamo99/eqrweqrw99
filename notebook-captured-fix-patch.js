/* notebook-captured-fix-patch.js v20260710-1
   Option A:
   - db.learn stays global (unique lemma pool)
   - Each notebook has its own captured lemma list
   - Sidebar cards show "本篇捕獲數"
*/

(function () {

  'use strict';

  const LS_KEY = 'notebook_captured_map_v1';
  // { [notebookId\]: [lemma1, lemma2, ...] }

  function loadMap() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveMap(m) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(m));
    } catch (e) {}
  }

  const map = loadMap();

  // ---- 取得目前開啟的筆記 id ----
  function currentNotebookId() {

    // 常見 id 標記位置
    const active =
      document.querySelector('.notebook.active') ||
      document.querySelector('[data-active="1"][data-notebook-id]') ||
      document.querySelector('[data-notebook-id].active') ||
      document.querySelector('[data-nid].active');

    if (active) {
      return active.dataset.notebookId ||
             active.dataset.nid ||
             active.id ||
             '';
    }

    // fallback：讀 URL hash
    const h = (location.hash || '').replace('#','').trim();
    if (h) return h;

    // fallback：讀主標題文字（可能是「20260706」）
    const title = document.querySelector(
      '.article-title, #articleTitle, h1'
    );

    if (title) return title.textContent.trim().slice(0, 40);

    return '';
  }

  // ---- 記錄捕獲字 ----
  function record(word) {

    if (!word) return;

    const id = currentNotebookId();
    if (!id) return;

    if (!map[id]) map[id] = [];

    if (map[id].includes(word)) return;

    map[id].push(word);

    saveMap(map);

    console.log(`[Captured] +${word} → notebook=${id}, total=${map[id].length}`);

    refreshCards();
  }

  // 對外提供，讓你其他 patch 也能呼叫
  window.__notebookRecordCapture__ = record;

  // ---- Hook：當 dockBody 顯示新的 lemma 時，自動記錄 ----
  const dock = document.getElementById('dockBody');
  if (dock) {

    const obs = new MutationObserver(() => {

      const el = dock.querySelector('.wordbig, h1');
      if (!el) return;

      const word = String(el.textContent || '').trim();
      if (!word) return;

      record(word);
    });

    obs.observe(dock, { childList: true, subtree: true });
  }

  // ---- 覆寫側欄卡片顯示 ----
  function refreshCards() {

    const cards = document.querySelectorAll(
      '[data-notebook-id], [data-nid], .notebook, .notebook-card, .note-card, .nb-card'
    );

    cards.forEach(card => {

      const id =
        card.dataset.notebookId ||
        card.dataset.nid ||
        card.id ||
        card.querySelector?.('.notebook-title, .title, h4')?.textContent?.trim().slice(0,40);

      if (!id) return;

      const count = (map[id] || []).length;

      // 找卡片內的「XX 捕獲」字樣，替換數字
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);

      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      nodes.forEach(n => {

        if (!/\d+\s*捕獲/.test(n.nodeValue)) return;

        n.nodeValue = n.nodeValue.replace(
          /(\d+)\s*捕獲/,
          count + ' 捕獲'
        );
      });
    });
  }

  // 動態偵測側欄更新
  const mo = new MutationObserver(() => refreshCards());

  const sidebar =
    document.getElementById('sidebar') ||
    document.querySelector('.sidebar') ||
    document.querySelector('aside') ||
    document.body;

  mo.observe(sidebar, { childList: true, subtree: true });

  // 開檔即刷
  setTimeout(refreshCards, 300);
  setTimeout(refreshCards, 1500);

  console.log('[NotebookCapturedFix] ready');

})();
