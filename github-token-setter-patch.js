/* github-token-setter-patch.js v20260710-1
   Adds a floating button "🔑 Token" to set / update / clear GitHub token.
   Token is stored in localStorage: notebook_github_token_v1
*/

(function () {

  'use strict';

  const KEY = 'notebook_github_token_v1';

  function currentTokenPreview() {

    const t = localStorage.getItem(KEY) || '';

    if (!t) return '（未設定）';

    return t.slice(0, 6) + '••••••' + t.slice(-4);
  }

  function promptToken() {

    const t = localStorage.getItem(KEY) || '';

    const input = prompt(
      '請貼上你的 GitHub Personal Access Token\n\n' +
      '目前：' + currentTokenPreview() + '\n\n' +
      '（留空 = 清除）',
      ''
    );

    if (input === null) return;

    const val = String(input || '').trim();

    if (!val) {
      localStorage.removeItem(KEY);
      alert('已清除 GitHub Token');
      return;
    }

    if (!/^(ghp_|github_pat_)/.test(val)) {
      const ok = confirm(
        '看起來不是常見的 GitHub Token 格式（ghp_ 或 github_pat_）\n' +
        '確定要儲存嗎？'
      );
      if (!ok) return;
    }

    localStorage.setItem(KEY, val);
    alert('已儲存 GitHub Token\n\n目前：' + currentTokenPreview());
  }

  // 浮動按鈕
  const btn = document.createElement('button');
  btn.textContent = '🔑 Token';

  btn.style.cssText = `
    position:fixed;
    right:8px;
    bottom:56px;
    z-index:2147483647;
    padding:6px 10px;
    border:none;
    border-radius:8px;
    background:#1f2937;
    color:#f4d27a;
    cursor:pointer;
    font-size:13px;
  `;

  btn.onclick = promptToken;

  document.body.appendChild(btn);

  console.log('[GitHubTokenSetter] ready');

})();
