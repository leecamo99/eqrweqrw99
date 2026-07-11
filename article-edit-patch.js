/* article-edit-patch.js v20260711-3
   Fix findCurrentCardData with prefix matching.
*/

(function () {

  'use strict';

  var STORE = 'notebook_platform_v3';

  function log() {
    try {
      console.log.apply(console, ['[ArticleEdit]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function getDB() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || '{}');
    } catch (e) { return {}; }
  }

  function setDB(d) {
    localStorage.setItem(STORE, JSON.stringify(d));
  }

  function findCurrentArticle() {

    var card = document.querySelector('.card');
    if (!card) return null;

    var enEl = card.querySelector('.en');
    if (!enEl) return null;

    return { card: card, enEl: enEl };
  }

  function findCurrentCardData() {

    var db = getDB();
    if (!db.notebooks) return null;

    var card = document.querySelector('.card');
    if (!card) return null;

    var cardId = card.dataset.cid;
    if (!cardId) {
      log('card.dataset.cid 不存在');
      return null;
    }

    log('尋找 cardId:', cardId);

    // 第一次：直接匹配
    for (var i = 0; i < db.notebooks.length; i++) {
      var nb = db.notebooks[i];
      if (!nb.cards) continue;

      for (var j = 0; j < nb.cards.length; j++) {
        if (nb.cards[j].id === cardId) {
          log('找到 (直接匹配):', i, j);
          return {
            notebook: nb,
            card: nb.cards[j],
            nbIdx: i,
            cardIdx: j
          };
        }
      }
    }

    // 第二次：cardId 開頭匹配 notebook.id
    // cardId 格式：nb_XXXXcY
    var nbIdMatch = cardId.match(/^(nb_\d+)/);
    if (nbIdMatch) {
      var possibleNbId = nbIdMatch[1];
      var cardIdxMatch = cardId.match(/c(\d+)$/);
      var possibleCardIdx = cardIdxMatch ? parseInt(cardIdxMatch[1], 10) : 0;

      log('嘗試前綴匹配:', possibleNbId, 'card idx:', possibleCardIdx);

      for (var k = 0; k < db.notebooks.length; k++) {
        var nb2 = db.notebooks[k];
        if (nb2.id === possibleNbId && nb2.cards && nb2.cards[possibleCardIdx]) {
          log('找到 (前綴匹配):', k, possibleCardIdx);
          return {
            notebook: nb2,
            card: nb2.cards[possibleCardIdx],
            nbIdx: k,
            cardIdx: possibleCardIdx
          };
        }
      }
    }

    // 第三次：找當前 active notebook
    var activeNb = document.querySelector('.notebook.active');
    if (activeNb) {
      var activeIdx = Array.prototype.indexOf.call(activeNb.parentNode.children, activeNb);
      if (db.notebooks[activeIdx] && db.notebooks[activeIdx].cards) {
        log('用 active notebook:', activeIdx);
        // 找 card index (在 DOM 中的順序)
        var cardsInDom = document.querySelectorAll('.card');
        var currentCardIdx = Array.prototype.indexOf.call(cardsInDom, card);
        if (db.notebooks[activeIdx].cards[currentCardIdx]) {
          return {
            notebook: db.notebooks[activeIdx],
            card: db.notebooks[activeIdx].cards[currentCardIdx],
            nbIdx: activeIdx,
            cardIdx: currentCardIdx
          };
        }
      }
    }

    log('都找不到');
    return null;
  }

  var isEditing = false;
  var editControls = null;

  function enterEditMode() {

    var found = findCurrentArticle();
    if (!found) {
      alert('沒有找到文章');
      return;
    }

    var cardData = findCurrentCardData();
    if (!cardData) {
      alert('沒有找到 card 資料。\n請重新載入頁面。');
      return;
    }

    isEditing = true;

    var originalText = extractPlainText(cardData.card.text);

    var textarea = document.createElement('textarea');
    textarea.id = 'articleEditTextarea';
    textarea.value = originalText;
    textarea.style.cssText = ''
      + 'width: 100%;'
      + 'min-height: 300px;'
      + 'padding: 12px;'
      + 'border: 2px solid #a68a56;'
      + 'border-radius: 6px;'
      + 'background: #faf6ed;'
      + 'color: #333;'
      + 'font-family: inherit;'
      + 'font-size: 15px;'
      + 'line-height: 1.7;'
      + 'resize: vertical;'
      + 'box-sizing: border-box;';

    found.enEl.style.display = 'none';
    found.enEl.parentNode.insertBefore(textarea, found.enEl);

    var controls = document.createElement('div');
    controls.id = 'articleEditControls';
    controls.style.cssText = ''
      + 'margin-top: 10px;'
      + 'display: flex;'
      + 'flex-wrap: wrap;'
      + 'gap: 8px;';

    controls.innerHTML =
      '<button id="articleEditSaveKeepBtn" style="' +
        'padding: 8px 12px;' +
        'background: #a68a56;' +
        'color: white;' +
        'border: none;' +
        'border-radius: 4px;' +
        'cursor: pointer;' +
        'font-size: 13px;' +
      '">💾 儲存 (保留標記)</button>' +
      '<button id="articleEditSaveRemarkBtn" style="' +
        'padding: 8px 12px;' +
        'background: #7a6547;' +
        'color: white;' +
        'border: none;' +
        'border-radius: 4px;' +
        'cursor: pointer;' +
        'font-size: 13px;' +
      '">🔄 儲存 (重新標註)</button>' +
      '<button id="articleEditCancelBtn" style="' +
        'padding: 8px 12px;' +
        'background: #666;' +
        'color: white;' +
        'border: none;' +
        'border-radius: 4px;' +
        'cursor: pointer;' +
        'font-size: 13px;' +
      '">✖ 取消</button>' +
      '<div style="flex: 1;"></div>' +
      '<div id="articleEditStatus" style="color: #666; font-size: 12px; align-self: center;">' +
      '</div>';

    textarea.parentNode.insertBefore(controls, textarea.nextSibling);

    editControls = { textarea: textarea, controls: controls, enEl: found.enEl };

    document.getElementById('articleEditSaveKeepBtn').onclick = function () {
      doSave(true);
    };
    document.getElementById('articleEditSaveRemarkBtn').onclick = function () {
      doSave(false);
    };
    document.getElementById('articleEditCancelBtn').onclick = cancelEdit;

    var editBtn = document.getElementById('articleEditBtn');
    if (editBtn) editBtn.style.display = 'none';

    log('entered edit mode');
  }

  function doSave(keepMarks) {

    if (!editControls) {
      log('editControls not found');
      return;
    }

    var status = document.getElementById('articleEditStatus');
    if (status) status.textContent = '儲存中...';

    log('doSave keepMarks:', keepMarks);

    var newText = editControls.textarea.value.trim();
    if (!newText) {
      alert('文章不能為空');
      if (status) status.textContent = '';
      return;
    }

    var cardData = findCurrentCardData();
    if (!cardData) {
      alert('沒有找到 card 資料');
      if (status) status.textContent = '';
      return;
    }

    log('cardData found:', cardData.nbIdx, cardData.cardIdx);

    var db = getDB();
    var newTextWithMarks;

    if (keepMarks) {
      newTextWithMarks = newText;
      log('saved with existing marks');
    } else {
      if (typeof window.markText === 'function') {
        var nb = db.notebooks[cardData.nbIdx];
        newTextWithMarks = window.markText(newText, nb);
        log('saved with re-marking');
      } else {
        newTextWithMarks = newText;
        log('markText not available, saved as plain text');
      }
    }

    db.notebooks[cardData.nbIdx].cards[cardData.cardIdx].text = newTextWithMarks;
    setDB(db);
    log('db saved');

    if (typeof window.render === 'function') {
      window.render();
      log('render called');
    } else {
      log('window.render not available');
    }

    exitEditMode();

    if (status) status.textContent = '';

    alert('已儲存');

    log('save complete');
  }

  function cancelEdit() {
    exitEditMode();
    log('cancelled');
  }

  function exitEditMode() {

    isEditing = false;

    if (editControls) {
      if (editControls.textarea) editControls.textarea.remove();
      if (editControls.controls) editControls.controls.remove();
      if (editControls.enEl) editControls.enEl.style.display = '';
    }

    editControls = null;

    var editBtn = document.getElementById('articleEditBtn');
    if (editBtn) editBtn.style.display = '';
  }

  function extractPlainText(text) {
    if (!text) return '';
    return text.replace(/\{\{(.+?)\}\}/g, '$1');
  }

  function addEditButton() {

    if (document.getElementById('articleEditBtn')) return;

    var found = findCurrentArticle();
    if (!found) return;

    var h3 = found.card.querySelector('h3');
    if (!h3) return;

    var editBtn = document.createElement('button');
    editBtn.id = 'articleEditBtn';
    editBtn.textContent = '✏️ 編輯原文';
    editBtn.style.cssText = ''
      + 'padding: 5px 10px;'
      + 'background: transparent;'
      + 'color: #a68a56;'
      + 'border: 1px solid #a68a56;'
      + 'border-radius: 3px;'
      + 'cursor: pointer;'
      + 'font-size: 12px;'
      + 'margin-left: 8px;';

    editBtn.onclick = enterEditMode;

    h3.appendChild(editBtn);

    log('edit button added');
  }

  function startWatchdog() {

    setInterval(function () {

      if (isEditing) return;

      if (!document.getElementById('articleEditBtn')) {
        addEditButton();
      }
    }, 1000);
  }

  var attempts = 0;
  var timer = setInterval(function () {
    attempts++;
    addEditButton();
    if (document.getElementById('articleEditBtn') || attempts > 30) {
      clearInterval(timer);
    }
  }, 500);

  startWatchdog();

  log('ready v20260711-3');

})();
