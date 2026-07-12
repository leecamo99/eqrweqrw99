/* gemini-custom-prompt-patch.js v20260712-2
   Fix: Update textarea immediately after saving new template.
*/

(function () {

  'use strict';

  var STORAGE_KEY = 'gemini_prompt_template_v1';

  function log() {
    try {
      console.log.apply(console, ['[GeminiPrompt]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  var DEFAULT_TEMPLATE = 
    '你是一位英文學習教練。請根據以下弱點單字，寫一篇自然、可朗讀、適合中級英文學習者的英文短文。\n\n' +
    '要求：\n' +
    '1. 英文文章約 250-350 字。\n' +
    '2. 主題貼近日常、職場、學習或安全流程，不要過度堆砌單字。\n' +
    '3. 每個弱點單字至少自然使用一次，可以使用正確詞形變化。\n' +
    '4. 文章後面用繁體中文列出「單字複習表」：單字 / 詞性 / 繁中意思 / 文章中的一句例句。\n' +
    '5. 最後提供 5 題簡短理解問題。\n' +
    '6. 請直接輸出內容，不要解釋你如何生成。\n' +
    '7. 輸出純文字，不要使用任何 Markdown 語法（不要用 **, __, *, #, [], 等符號）。單字直接以純文字呈現，不做粗體、斜體或程式碼標記。\n\n' +
    '弱點單字：{WORDS}';

  var TOEIC_TEMPLATE = 
    '你是一位多益 (TOEIC) 專家，目標分數 800+。請根據以下弱點單字，寫一篇適合多益考試風格的英文短文。\n\n' +
    '要求：\n' +
    '1. 英文文章約 250-350 字。\n' +
    '2. 主題貼近多益常考情境：商業郵件、報告、公告、會議、旅遊、交通、購物等。\n' +
    '3. 每個弱點單字至少自然使用一次，可以使用正確詞形變化。\n' +
    '4. 難度符合多益 700-800 分程度。\n' +
    '5. 文章後面用繁體中文列出「單字複習表」：單字 / 詞性 / 繁中意思 / 文章中的一句例句。\n' +
    '6. 最後提供 5 題簡短理解問題（多益題型）。\n' +
    '7. 請直接輸出內容，不要解釋你如何生成。\n' +
    '8. 輸出純文字，不要使用任何 Markdown 語法（不要用 **, __, *, #, [], 等符號）。單字直接以純文字呈現，不做粗體、斜體或程式碼標記。\n\n' +
    '弱點單字：{WORDS}';

  var CONVERSATION_TEMPLATE = 
    '你是一位英文口語教練。請根據以下弱點單字，寫一段自然生動的英文會話。\n\n' +
    '要求：\n' +
    '1. 兩人對話，約 200-300 字。\n' +
    '2. 主題貼近日常生活：交友、聚餐、興趣、家庭、旅遊等。\n' +
    '3. 每個弱點單字至少自然使用一次。\n' +
    '4. 對話風格輕鬆、自然、口語化。\n' +
    '5. 對話後面用繁體中文列出單字複習表。\n' +
    '6. 請直接輸出內容，不要解釋你如何生成。\n' +
    '7. 輸出純文字，不要使用任何 Markdown 語法。\n\n' +
    '弱點單字：{WORDS}';

  function getTemplate() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_TEMPLATE;
  }

  function setTemplate(t) {
    if (t) {
      localStorage.setItem(STORAGE_KEY, t);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // 立即更新 Gemini modal 的 Prompt textarea
  function refreshGeminiPrompt() {

    var promptTextarea = document.getElementById('geminiPrompt');
    if (!promptTextarea) return false;

    var db;
    try {
      db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
    } catch (e) { db = {}; }

    var items = Object.values(db.learn || {})
      .filter(function (x) {
        return (x.lifetimeClicks || 0) >= 10 || 
               (x.maxClickStreak || 0) >= 10 || 
               x.isWeak || 
               ((x.clicks || 0) >= 10);
      })
      .sort(function (a, b) {
        return (b.lifetimeClicks || b.clicks || 0) - (a.lifetimeClicks || a.clicks || 0);
      })
      .slice(0, 35);

    var list = items.map(function (x) {
      return (x.lemma || x.word) + (x.tw ? '（' + x.tw + '）' : '');
    }).join(', ');

    if (!list) {
      list = '目前沒有足夠弱點單字，請先點擊一些不熟的單字。';
    }

    var template = getTemplate();
    var finalPrompt = template.replace(/\{WORDS\}/g, list);

    promptTextarea.value = finalPrompt;

    log('prompt refreshed');
    return true;
  }

  function openEditor() {

    if (document.getElementById('geminiPromptEditor')) {
      document.getElementById('geminiPromptEditor').remove();
    }

    var modal = document.createElement('div');
    modal.id = 'geminiPromptEditor';
    modal.style.cssText = ''
      + 'position: fixed;'
      + 'inset: 0;'
      + 'background: rgba(0,0,0,0.6);'
      + 'z-index: 99999;'
      + 'display: flex;'
      + 'align-items: center;'
      + 'justify-content: center;'
      + 'padding: 20px;'
      + 'font-family: Segoe UI, Microsoft JhengHei, sans-serif;';

    modal.innerHTML =
      '<div style="' +
        'background: #fff;' +
        'border-radius: 10px;' +
        'padding: 20px;' +
        'max-width: 800px;' +
        'width: 100%;' +
        'max-height: 90vh;' +
        'display: flex;' +
        'flex-direction: column;' +
        'gap: 12px;' +
      '">' +

        '<div style="display: flex; justify-content: space-between; align-items: center;">' +
          '<h2 style="margin: 0; font-size: 20px; color: #333;">✏️ 編輯 Prompt 模板</h2>' +
          '<button id="promptEditorClose" style="' +
            'background: transparent;' +
            'border: none;' +
            'font-size: 24px;' +
            'cursor: pointer;' +
            'color: #666;' +
          '">×</button>' +
        '</div>' +

        '<div style="color: #666; font-size: 12px; line-height: 1.6;">' +
          '客製化 Prompt 讓 Gemini 更符合你的需求。<br>' +
          '<strong>重要：</strong>必須包含 <code>{WORDS}</code>，實際生成時會被替換為弱點單字列表。' +
        '</div>' +

        '<div style="display: flex; gap: 6px; flex-wrap: wrap;">' +
          '<button class="tplBtn" data-tpl="default" style="padding: 5px 10px; background: #666; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">📖 預設 (中級)</button>' +
          '<button class="tplBtn" data-tpl="toeic" style="padding: 5px 10px; background: #a68a56; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">📊 多益 800+</button>' +
          '<button class="tplBtn" data-tpl="conversation" style="padding: 5px 10px; background: #4a7856; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">💬 日常會話</button>' +
        '</div>' +

        '<textarea id="promptEditorText" style="' +
          'width: 100%;' +
          'flex: 1;' +
          'min-height: 400px;' +
          'padding: 12px;' +
          'border: 1px solid #ccc;' +
          'border-radius: 6px;' +
          'font-family: monospace;' +
          'font-size: 13px;' +
          'line-height: 1.6;' +
          'resize: vertical;' +
          'box-sizing: border-box;' +
        '"></textarea>' +

        '<div style="display: flex; gap: 8px; justify-content: flex-end;">' +
          '<button id="promptEditorReset" style="padding: 8px 16px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">重設預設值</button>' +
          '<button id="promptEditorCancel" style="padding: 8px 16px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">取消</button>' +
          '<button id="promptEditorSave" style="padding: 8px 16px; background: #2f6f9f; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">💾 儲存並套用</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    var textarea = document.getElementById('promptEditorText');
    textarea.value = getTemplate();

    var close = function () {
      modal.remove();
    };

    document.getElementById('promptEditorClose').onclick = close;
    document.getElementById('promptEditorCancel').onclick = close;

    document.getElementById('promptEditorSave').onclick = function () {

      var text = textarea.value.trim();

      if (!text) {
        alert('Prompt 不能為空');
        return;
      }

      if (text.indexOf('{WORDS}') === -1) {
        var ok = confirm(
          'Prompt 沒有 {WORDS} 標記！\n\n' +
          '{WORDS} 會被替換為弱點單字列表。\n' +
          '如果沒有這個標記，Gemini 不會知道要用哪些單字。\n\n' +
          '確定要儲存嗎？'
        );
        if (!ok) return;
      }

      setTemplate(text);

      // ★ 儲存後立刻套用到 Gemini modal
      refreshGeminiPrompt();

      alert('已儲存並套用');
      close();
    };

    document.getElementById('promptEditorReset').onclick = function () {
      if (confirm('確定重設為預設 Prompt？')) {
        textarea.value = DEFAULT_TEMPLATE;
      }
    };

    modal.querySelectorAll('.tplBtn').forEach(function (btn) {
      btn.onclick = function () {

        var tpl = this.dataset.tpl;

        if (!confirm('要載入這個範本？當前 Prompt 內容會被覆蓋。')) return;

        if (tpl === 'default') textarea.value = DEFAULT_TEMPLATE;
        else if (tpl === 'toeic') textarea.value = TOEIC_TEMPLATE;
        else if (tpl === 'conversation') textarea.value = CONVERSATION_TEMPLATE;
      };
    });

    log('editor opened');
  }

  function addEditButton() {

    var top = document.getElementById('geminiWeakArticleTop');
    if (!top) return false;

    if (document.getElementById('gemEditPrompt')) return true;

    var closeBtn = document.getElementById('gemClose');
    if (!closeBtn) return false;

    var editBtn = document.createElement('button');
    editBtn.id = 'gemEditPrompt';
    editBtn.className = 'gemBtn';
    editBtn.textContent = '✏️ 編輯模板';
    editBtn.style.background = '#a68a56';
    editBtn.style.color = 'white';
    editBtn.style.borderColor = '#a68a56';

    editBtn.onclick = openEditor;

    closeBtn.parentNode.insertBefore(editBtn, closeBtn);

    log('edit button added');
    return true;
  }

  function startWatchdog() {

    var lastState = false;

    setInterval(function () {

      var modal = document.getElementById('geminiWeakArticleModal');
      if (!modal) return;

      var isOpen = modal.classList.contains('show');

      if (isOpen) {
        addEditButton();

        // 每次剛打開（狀態從關閉變成打開）就更新一次
        if (!lastState) {
          refreshGeminiPrompt();
        }
      }

      lastState = isOpen;
    }, 300);
  }

  startWatchdog();

  log('ready v20260712-2');

})();
