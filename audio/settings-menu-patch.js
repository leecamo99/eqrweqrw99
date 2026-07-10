/* settings-menu-patch.js v20260710-1
   A small ⚙️ button in top-right that opens a settings menu.
   All API keys/tokens are set here.
   No floating clutter on main UI.
*/

(function () {

  'use strict';

  const ITEMS = [

    {
      label: 'GitHub Token',
      key:   'notebook_github_token_v1',
      hint:  '存放 audio/*.mp3 用。Fine-grained token，只給此 repo Contents: Read and write',
      match: /^(ghp_|github_pat_)/
    },

    {
      label: 'Google Cloud TTS API Key',
      key:   'notebook_google_cloud_tts_key_v1',
      hint:  'Google Cloud Text-to-Speech API Key',
      match: /^AIza/
    },

    {
      label: 'Gemini API Key',
      key:   'notebook_gemini_key_v1',
      hint:  '（可選）Gemini 弱點文章生成用',
      match: /^AIza/
    }

  ];

  function preview(v) {
    if (!v) return '（未設定）';
    return v.slice(0, 6) + '••••••' + v.slice(-4);
  }

  function setValue(item) {

    const cur = localStorage.getItem(item.key) || '';

    const input = prompt(
      item.label + '\n\n' +
      (item.hint || '') + '\n\n' +
      '目前：' + preview(cur) + '\n\n' +
      '（留空 = 清除）',
      ''
    );

    if (input === null) return; // 使用者按取消

    const val = String(input || '').trim();

    if (!val) {
      localStorage.removeItem(item.key);
      alert('已清除：' + item.label);
      render();
      return;
    }

    if (item.match && !item.match.test(val)) {
      const ok = confirm(
        '看起來不是常見的 ' + item.label + ' 格式。\n' +
        '確定要儲存嗎？'
      );
      if (!ok) return;
    }

    localStorage.setItem(item.key, val);
    alert('已儲存：' + item.label + '\n\n目前：' + preview(val));
    render();
  }

  // --- 建立齒輪按鈕 ---
  const gear = document.createElement('button');

  gear.id = 'settings-menu-gear';
  gear.textContent = '⚙️';
  gear.title = '設定';

  gear.style.cssText = `
    position:fixed;
    top:10px;
    right:10px;
    z-index:2147483647;
    width:36px;
    height:36px;
    border:none;
    border-radius:50%;
    background:rgba(31, 41, 55, 0.85);
    color:#f4d27a;
    cursor:pointer;
    font-size:18px;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);
  `;

  document.body.appendChild(gear);

  // --- 建立彈出選單 ---
  const menu = document.createElement('div');

  menu.id = 'settings-menu-panel';

  menu.style.cssText = `
    position:fixed;
    top:52px;
    right:10px;
    z-index:2147483647;
    background:#1f2937;
    color:#f4f4f5;
    border:1px solid #374151;
    border-radius:10px;
    padding:12px;
    min-width:280px;
    max-width:90vw;
    max-height:80vh;
    overflow:auto;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
    font-size:13px;
    display:none;
  `;

  document.body.appendChild(menu);

  function render() {

    menu.innerHTML = '';

    const title = document.createElement('div');

    title.textContent = '⚙ 設定';

    title.style.cssText = `
      color:#f4d27a;
      font-weight:bold;
      margin-bottom:8px;
      border-bottom:1px solid #374151;
      padding-bottom:6px;
    `;

    menu.appendChild(title);

    ITEMS.forEach(item => {

      const cur = localStorage.getItem(item.key) || '';

      const row = document.createElement('div');

      row.style.cssText = `
        margin-bottom:10px;
        padding:8px;
        background:#111827;
        border-radius:6px;
      `;

      row.innerHTML = `
        <div style="color:#f4d27a;font-weight:bold">
          ${item.label}
        </div>
        <div style="color:#9ca3af;font-size:11px;margin:4px 0">
          ${item.hint || ''}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:#e5e7eb;font-family:monospace">
            ${preview(cur)}
          </span>
          <button style="
            border:none;
            border-radius:6px;
            padding:4px 10px;
            background:#374151;
            color:#fff;
            cursor:pointer;
          ">設定</button>
        </div>
      `;

      const b = row.querySelector('button');
      b.onclick = () => setValue(item);

      menu.appendChild(row);
    });

    const hint = document.createElement('div');

    hint.textContent =
      'Token 只存在此瀏覽器的 localStorage，不會上傳。' +
      '請勿在公用電腦操作。';

    hint.style.cssText = `
      color:#9ca3af;
      font-size:11px;
      margin-top:8px;
      border-top:1px solid #374151;
      padding-top:6px;
    `;

    menu.appendChild(hint);
  }

  gear.onclick = () => {

    if (menu.style.display === 'none') {
      render();
      menu.style.display = 'block';
    } else {
      menu.style.display = 'none';
    }
  };

  // 點外面關閉
  document.addEventListener('click', (e) => {

    if (menu.style.display === 'none') return;

    if (e.target === gear) return;
    if (menu.contains(e.target)) return;

    menu.style.display = 'none';

  }, true);

  console.log('[SettingsMenu] ready');

})();
