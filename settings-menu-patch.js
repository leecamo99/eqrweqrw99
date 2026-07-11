/* settings-menu-patch.js v20260710-4
   Integrates API keys/tokens into the existing #sync sidebar section.
   Fallback: floating ⚙️ button top-right.
*/

(function () {

  'use strict';

  const ITEMS = [
    {
      label: 'GitHub Token',
      key:   'notebook_github_token_v1',
      hint:  '用於上傳 audio/*.mp3（Fine-grained token）',
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
      hint:  '（可選）Gemini 弱點文章生成',
      match: /^AIza/
    },
    {
      label: 'Google Translate API Key',
      key:   'google_translate_api_key',
      hint:  '用於高品質單字翻譯（Cloud Translation API）',
      match: /^AIza/
    }
  ];

  function preview(v) {
    if (!v) return '（未設定）';
    return v.slice(0, 6) + '••••••' + v.slice(-4);
  }

  function setValue(item, refreshFn) {

    const cur = localStorage.getItem(item.key) || '';

    const input = prompt(
      item.label + '\n\n' +
      (item.hint || '') + '\n\n' +
      '目前：' + preview(cur) + '\n\n' +
      '（留空 = 清除）',
      ''
    );

    if (input === null) return;

    const val = String(input || '').trim();

    if (!val) {
      localStorage.removeItem(item.key);
      alert('已清除：' + item.label);
      refreshFn && refreshFn();
      return;
    }

    if (item.match && !item.match.test(val)) {
      const ok = confirm(
        '格式看起來不像 ' + item.label + '，確定儲存？'
      );
      if (!ok) return;
    }

    localStorage.setItem(item.key, val);
    alert('已儲存：' + item.label + '\n\n' + preview(val));
    refreshFn && refreshFn();
  }

  function buildRow(item, refreshFn) {

    const cur = localStorage.getItem(item.key) || '';

    const row = document.createElement('div');

    row.style.cssText = `
      margin:6px 0;
      padding:8px;
      background:#111827;
      border-radius:6px;
      color:#f4f4f5;
      font-size:12px;
    `;

    row.innerHTML = `
      <div style="color:#f4d27a;font-weight:bold">${item.label}</div>
      <div style="color:#9ca3af;font-size:11px;margin:4px 0">
        ${item.hint || ''}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span style="font-family:monospace">${preview(cur)}</span>
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

    row.querySelector('button').onclick = () => setValue(item, refreshFn);

    return row;
  }

  function installInSync() {

    const sync = document.getElementById('sync');
    if (!sync) return false;

    if (sync.querySelector('#settings-menu-block')) return true;

    const block = document.createElement('div');
    block.id = 'settings-menu-block';
    block.style.cssText = `
      margin-top:10px;
      padding-top:8px;
      border-top:1px solid #374151;
    `;

    const title = document.createElement('div');
    title.textContent = '⚙ API Key / Token（點展開）';
    title.style.cssText = `
      color:#f4d27a;
      font-weight:bold;
      font-size:12px;
      cursor:pointer;
      user-select:none;
      margin-bottom:6px;
    `;

    const body = document.createElement('div');
    body.style.display = 'none';

    function refresh() {
      body.innerHTML = '';
      ITEMS.forEach(item => body.appendChild(buildRow(item, refresh)));
    }

    title.onclick = () => {

      const open = body.style.display === 'block';

      body.style.display = open ? 'none' : 'block';

      if (!open) refresh();
    };

    block.appendChild(title);
    block.appendChild(body);

    sync.appendChild(block);

    console.log('[SettingsMenu v4] installed inside #sync');

    return true;
  }

  function installFloating() {

    if (document.getElementById('settings-menu-gear')) return;

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
      background:rgba(31,41,55,0.85);
      color:#f4d27a;
      cursor:pointer;
      font-size:18px;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed;
      top:52px;
      right:10px;
      z-index:2147483647;
      background:#1f2937;
      border:1px solid #374151;
      border-radius:10px;
      padding:12px;
      min-width:280px;
      max-width:90vw;
      max-height:80vh;
      overflow:auto;
      box-shadow:0 8px 24px rgba(0,0,0,0.4);
      display:none;
    `;

    document.body.appendChild(gear);
    document.body.appendChild(panel);

    function refresh() {
      panel.innerHTML = '';
      ITEMS.forEach(item => panel.appendChild(buildRow(item, refresh)));
    }

    gear.onclick = () => {

      if (panel.style.display === 'none') {
        refresh();
        panel.style.display = 'block';
      } else {
        panel.style.display = 'none';
      }
    };

    document.addEventListener('click', (e) => {

      if (panel.style.display === 'none') return;
      if (e.target === gear) return;
      if (panel.contains(e.target)) return;

      panel.style.display = 'none';

    }, true);

    console.log('[SettingsMenu v4] fallback floating gear installed');
  }

  let tries = 0;

  const timer = setInterval(() => {

    tries++;

    if (installInSync()) {
      clearInterval(timer);
      return;
    }

    if (tries > 20) {
      clearInterval(timer);
      installFloating();
    }

  }, 300);

  installInSync();

  console.log('[SettingsMenu v4] ready');

})();
