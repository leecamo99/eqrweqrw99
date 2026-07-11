/* article-edit-patch.js v20260711-1
   Adds edit mode to article. Click "✏️ 編輯" to modify original text.
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

  // 找當前 notebook 和文章 element
  function findCurrentArticle() {

    var card = document.querySelector('.card');
    if (!card) return null;

    var enEl = card.querySelector('.en');
    if (!enEl) return null;

    return { card: card, enEl: enEl };
  }

  // 找當前 notebook 和 card data
  function findCurrentCardData() {

    var db = getDB();
    if (!db.notebooks) return null;

    var card = document.querySelector('.card');
    if (!card) return null;

    var cardId = card.dataset.cid;
    if (!cardId) return null;

    for (var i = 0; i < db.notebooks.length; i++) {
      var nb = db.notebooks[i];
      if (!nb.cards) continue;

      for (var j = 0; j < nb.cards.length; j++) {
        if (nb.cards[j].id === cardId) {
          return {
            notebook: nb,
            card: nb.cards[j],
            nbIdx: i,
            cardIdx: j
          };
        }
      }
    }

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
      alert('沒有找到 card 資料');
      return;
    }

    isEditing = true;

    // 取得原始純文字（把 mark 去掉，保留純內容）
    var originalText = extractPlainText(cardData.card.text);

    // 建立 textarea
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

    // 替換 .en 為 textarea
    found.enEl.style.display = 'none';
    found.enEl.parentNode.insertBefore(textarea, found.enEl);

    // 建立控制按鈕
    var controls = document.createElement('div');
    controls.id = 'articleEditControls';
    controls.style.cssText = ''
      + 'margin-top: 10px;'
      + 'display: flex;'
      + 'gap: 8px;';

    controls.innerHTML =
      '<button id="articleEditSaveBtn" style="' +
        'padding: 8px 16px;' +
        'background: #a68a56;' +
        'color: white;' +
        'border: none;' +
        'border-radius: 4px;' +
        'cursor: pointer;' +
        'font-size: 14px;' +
      '">💾 儲存</button>' +
      '<button id="articleEditCancelBtn" style="' +
        'padding: 8px 16px;' +
        'background: #666;' +
        'color: white;' +
        'border: none;' +
        'border-radius: 4px;' +
        'cursor: pointer;' +
        'font-size: 14px;' +
      '">✖ 取消</button>' +
      '<div style="flex: 1;"></div>' +
      '<div style="color: #666; font-size: 12px; align-self: center;">' +
        '編輯後儲存會重新標註單字（可能需要重新翻譯）' +
      '</div>';

    textarea.parentNode.insertBefore(controls, textarea.nextSibling);

    editControls = { textarea: textarea, controls: controls, enEl: found.enEl };

    // 綁定按鈕
    document.getElementById('articleEditSaveBtn').onclick = saveEdit;
    document.getElementById('articleEditCancelBtn').onclick = cancelEdit;

    // 隱藏編輯按鈕
    var editBtn = document.getElementById('articleEditBtn');
    if (editBtn) editBtn.style.display = 'none';

    log('entered edit mode');
  }

  function saveEdit() {

    if (!editControls) return;

    var newText = editControls.textarea.value.trim();
    if (!newText) {
      alert('文章不能為空');
      return;
    }

    var cardData = findCurrentCardData();
    if (!cardData) {
      alert('沒有找到 card 資料');
      return;
    }

    // 決定保留還是重新標註
    var keepMarks = confirm(
      '儲存後選擇：\n\n' +
      '「確定」= 保留現有單字標記 (只更新文字)\n' +
      '「取消」= 重新標註單字（會清除現有標記，重新分析）'
    );

    var db = getDB();
    var newTextWithMarks;

    if (keepMarks) {
      // 保留舊 marks
      newTextWithMarks = newText;
      log('saved with existing marks');
    } else {
      // 重新標註（呼叫主 JS 的 markText）
      if (typeof window.markText === 'function') {
        var nb = db.notebooks[cardData.nbIdx];
        newTextWithMarks = window.markText(newText, nb);
        log('saved with re-marking');
      } else {
        newTextWithMarks = newText;
        log('markText not available, saved as plain text');
      }
    }

    // 更新 db
    db.notebooks[cardData.nbIdx].cards[cardData.cardIdx].text = newTextWithMarks;
    setDB(db);

    // 觸發主 JS 重新渲染
    if (typeof window.render === 'function') {
      window.render();
    }

    exitEditMode();

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

    // 顯示編輯按鈕
    var editBtn = document.getElementById('articleEditBtn');
    if (editBtn) editBtn.style.display = '';
  }

  // 從 markText 產生的內容中抽出純文字（把 {{word}} 標記去掉）
  function extractPlainText(text) {
    if (!text) return '';
    return text.replace(/\{\{(.+?)\}\}/g, '$1');
  }

  function addEditButton() {

    if (document.getElementById('articleEditBtn')) return;

    var found = findCurrentArticle();
    if (!found) return;

    // 找 card h3 上的位置
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

      // 如果沒有編輯按鈕，加上去
      if (!document.getElementById('articleEditBtn')) {
        addEditButton();
      }
    }, 1000);
  }

  // 初始化
  var attempts = 0;
  var timer = setInterval(function () {
    attempts++;
    addEditButton();
    if (document.getElementById('articleEditBtn') || attempts > 30) {
      clearInterval(timer);
    }
  }, 500);

  startWatchdog();

  log('ready v20260711-1');

})();
