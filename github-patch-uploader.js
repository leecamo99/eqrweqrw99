/* github-patch-uploader.js  v20260713-1
   GitHub Patch 快速上傳器
   功能：
   1) 右下角浮動 🚀 按鈕，點開上傳面板
   2) 檔名下拉選單（自動列出 repo 檔案清單）
   3) 大 textarea 貼程式碼（不會被字元過濾）
   4) 自動 Base64 編碼 → 打 GitHub API PUT
   5) 顯示上傳狀態、commit sha、直接開 GitHub 檢視
   6) 記住上次選的檔名
*/
(function () {
  'use strict';
  const TAG = '[PatchUploader]';
  const VER = 'v20260713-1';

  // ⚙️ 設定：改成你的 GitHub 資訊
  const OWNER = 'leecamo99';
  const REPO  = 'eqrweqrw99';
  const BRANCH = 'main';
  const TOKEN_KEY = 'notebook_github_token_v1';

  // ---------- CSS ----------
  const CSS = `
  #pchUpBtn{position:fixed;right:12px;bottom:170px;z-index:99998;
    width:44px;height:44px;border-radius:50%;background:#f4d27a;color:#222;
    border:none;font-size:20px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);
    transition:transform .2s}
  #pchUpBtn:hover{transform:scale(1.1)}
  #pchUpModal{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100000;
    display:none;align-items:center;justify-content:center;padding:20px}
  #pchUpModal.on{display:flex}
  #pchUpBox{background:#1e1e1e;color:#eee;border-radius:12px;padding:0;
    width:100%;max-width:720px;max-height:90vh;display:flex;flex-direction:column;
    font:13px/1.5 -apple-system,'Segoe UI',sans-serif;box-shadow:0 8px 40px rgba(0,0,0,.6)}
  #pchUpBox .pchHead{padding:12px 16px;background:#2a2a2a;border-radius:12px 12px 0 0;
    display:flex;justify-content:space-between;align-items:center}
  #pchUpBox .pchTitle{font-weight:bold;color:#f4d27a;font-size:14px}
  #pchUpBox .pchClose{background:none;border:none;color:#aaa;font-size:20px;cursor:pointer}
  #pchUpBox .pchClose:hover{color:#fff}
  #pchUpBox .pchBody{padding:16px;overflow:auto;flex:1}
  #pchUpBox label{display:block;color:#aaa;margin:8px 0 4px}
  #pchUpBox input,#pchUpBox select,#pchUpBox textarea{
    width:100%;background:#111;color:#eee;border:1px solid #444;
    border-radius:6px;padding:8px;font-family:inherit;box-sizing:border-box}
  #pchUpBox textarea{min-height:280px;font-family:'Consolas','Monaco',monospace;
    font-size:12px;resize:vertical;white-space:pre;overflow:auto}
  #pchUpBox .pchRow{display:flex;gap:8px;align-items:center;margin:8px 0}
  #pchUpBox .pchRow > *{flex:1}
  #pchUpBox .pchRow button{flex:0 0 auto}
  #pchUpBox .pchBtn{background:#4dc9e6;color:#000;border:none;padding:8px 16px;
    border-radius:6px;cursor:pointer;font-weight:bold}
  #pchUpBox .pchBtn:hover{background:#6ad}
  #pchUpBox .pchBtn:disabled{background:#555;color:#aaa;cursor:not-allowed}
  #pchUpBox .pchBtn.warn{background:#f4d27a}
  #pchUpBox .pchBtn.ok{background:#8f8;color:#000}
  #pchUpBox .pchBtn.mini{padding:4px 10px;font-size:11px}
  #pchUpBox .pchStatus{padding:10px;border-radius:6px;margin-top:10px;
    font-size:12px;white-space:pre-wrap;word-break:break-all}
  #pchUpBox .pchStatus.info{background:#233;color:#8cf}
  #pchUpBox .pchStatus.ok{background:#131;color:#8f8}
  #pchUpBox .pchStatus.err{background:#311;color:#f88}
  #pchUpBox .pchMeta{font-size:11px;color:#888;margin-top:4px}
  #pchUpBox .pchFoot{padding:10px 16px;background:#252525;border-radius:0 0 12px 12px;
    display:flex;gap:8px;justify-content:flex-end}
  @media (max-width:600px){
    #pchUpBtn{right:8px;bottom:200px;width:40px;height:40px;font-size:18px}
    #pchUpModal{padding:10px}
    #pchUpBox .pchBody{padding:12px}
    #pchUpBox textarea{min-height:200px;font-size:11px}
  }
  `;

  function injectCSS() {
    if (document.getElementById('pchUpCSS')) return;
    const s = document.createElement('style');
    s.id = 'pchUpCSS';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------- GitHub API ----------
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function apiGet(path) {
    const r = await fetch(
      'https://api.github.com/repos/' + OWNER + '/' + REPO + '/' + path,
      { headers: { Authorization: 'token ' + getToken() } }
    );
    if (!r.ok) throw new Error('GET ' + path + ' 失敗 ' + r.status);
    return r.json();
  }

  async function listJsFiles() {
    const arr = await apiGet('contents?ref=' + BRANCH);
    return arr
      .filter(x => x.type === 'file' && /\.(js|html|css|json|md)$/i.test(x.name))
      .map(x => x.name)
      .sort();
  }

  async function getFileSha(path) {
    try {
      const info = await apiGet('contents/' + path + '?ref=' + BRANCH);
      return info.sha;
    } catch (e) {
      return null; // 新檔案
    }
  }

  async function putFile(path, contentB64, sha, message) {
    const body = {
      message: message || ('update ' + path),
      content: contentB64,
      branch: BRANCH
    };
    if (sha) body.sha = sha;
    const r = await fetch(
      'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path,
      {
        method: 'PUT',
        headers: {
          Authorization: 'token ' + getToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || 'PUT 失敗');
    return j;
  }

  function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  // ---------- UI ----------
  function buildBtn() {
    if (document.getElementById('pchUpBtn')) return;
    const b = document.createElement('button');
    b.id = 'pchUpBtn';
    b.title = 'GitHub Patch 上傳器';
    b.textContent = '🚀';
    b.onclick = openModal;
    document.body.appendChild(b);
  }

  function buildModal() {
    if (document.getElementById('pchUpModal')) return;
    const m = document.createElement('div');
    m.id = 'pchUpModal';
    m.innerHTML = `
      <div id="pchUpBox">
        <div class="pchHead">
          <span class="pchTitle">🚀 GitHub Patch 上傳器</span>
          <button class="pchClose" id="pchBtnX">✕</button>
        </div>
        <div class="pchBody">
          <label>📁 檔名（下拉選現有 / 或直接輸入新檔名）</label>
          <div class="pchRow">
            <select id="pchFileSel"><option value="">-- 載入中 --</option></select>
            <button class="pchBtn mini" id="pchBtnReload" title="重新載入清單">🔄</button>
          </div>
          <input id="pchFileName" placeholder="或手動輸入檔名，例如 my-patch.js">

          <label>💬 Commit 訊息（可留空）</label>
          <input id="pchMsg" placeholder="update xxx patch">

          <label>📝 檔案內容（貼上程式碼）</label>
          <textarea id="pchContent" placeholder="貼你的程式碼到這裡..."
            spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
          <div class="pchMeta" id="pchMeta">0 字元 · 0 行</div>

          <div id="pchStatus"></div>
        </div>
        <div class="pchFoot">
          <button class="pchBtn mini" id="pchBtnLoad">📥 從 GitHub 載入</button>
          <button class="pchBtn mini warn" id="pchBtnClear">🗑 清空</button>
          <button class="pchBtn" id="pchBtnUp">📤 上傳</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    // ---- 事件綁定 ----
    m.querySelector('#pchBtnX').onclick = closeModal;
    m.onclick = (e) => { if (e.target === m) closeModal(); };

    const sel = m.querySelector('#pchFileSel');
    const inp = m.querySelector('#pchFileName');
    const ta  = m.querySelector('#pchContent');
    const meta = m.querySelector('#pchMeta');

    sel.onchange = () => {
      if (sel.value) {
        inp.value = sel.value;
        localStorage.setItem('pchUp_lastFile', sel.value);
      }
    };
    inp.oninput = () => {
      // 讓下拉跟著跳
      const opt = [...sel.options].find(o => o.value === inp.value);
      if (opt) sel.value = inp.value;
      else sel.value = '';
      localStorage.setItem('pchUp_lastFile', inp.value);
    };
    ta.oninput = () => {
      const v = ta.value;
      meta.textContent = v.length + ' 字元 · ' + (v.split('\n').length) + ' 行';
      // 警告字元過濾（如果有奇怪的 *）
      if (/[a-z]\*[a-z]/i.test(v)) {
        meta.textContent += '  ⚠️ 偵測到疑似 * 亂碼';
        meta.style.color = '#f88';
      } else {
        meta.style.color = '#888';
      }
    };

    m.querySelector('#pchBtnReload').onclick = loadFileList;
    m.querySelector('#pchBtnLoad').onclick = loadFromGitHub;
    m.querySelector('#pchBtnClear').onclick = () => {
      if (confirm('清空內容？')) { ta.value = ''; ta.oninput(); }
    };
    m.querySelector('#pchBtnUp').onclick = doUpload;
  }

  function openModal() {
    if (!getToken()) {
      alert('❌ 找不到 GitHub Token\n請先在 localStorage 存入 ' + TOKEN_KEY);
      return;
    }
    document.getElementById('pchUpModal').classList.add('on');
    loadFileList();
    // 還原上次檔名
    const last = localStorage.getItem('pchUp_lastFile');
    if (last) document.getElementById('pchFileName').value = last;
  }

  function closeModal() {
    document.getElementById('pchUpModal').classList.remove('on');
  }

  function setStatus(type, text) {
    const s = document.getElementById('pchStatus');
    s.className = 'pchStatus ' + type;
    s.textContent = text;
  }

  async function loadFileList() {
    const sel = document.getElementById('pchFileSel');
    sel.innerHTML = '<option value="">-- 載入中 --</option>';
    try {
      const files = await listJsFiles();
      sel.innerHTML = '<option value="">-- 選擇檔案 --</option>' +
        files.map(f => '<option value="' + f + '">' + f + '</option>').join('');
      const last = localStorage.getItem('pchUp_lastFile');
      if (last && files.includes(last)) sel.value = last;
    } catch (e) {
      sel.innerHTML = '<option value="">❌ 載入失敗</option>';
      setStatus('err', '載入檔案清單失敗：' + e.message);
    }
  }

  async function loadFromGitHub() {
    const path = document.getElementById('pchFileName').value.trim();
    if (!path) { alert('請先選檔名'); return; }
    setStatus('info', '📥 從 GitHub 載入 ' + path + '...');
    try {
      const url = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/' + path + '?t=' + Date.now();
      const t = await fetch(url).then(r => r.ok ? r.text() : Promise.reject('HTTP ' + r.status));
      const ta = document.getElementById('pchContent');
      ta.value = t;
      ta.oninput();
      setStatus('ok', '✅ 已載入 ' + t.length + ' 字元。可以編輯後上傳。');
    } catch (e) {
      setStatus('err', '❌ 載入失敗：' + e);
    }
  }

  async function doUpload() {
    const path = document.getElementById('pchFileName').value.trim();
    const content = document.getElementById('pchContent').value;
    const msg = document.getElementById('pchMsg').value.trim();
    if (!path) { alert('請填檔名'); return; }
    if (!content) { alert('內容不能空'); return; }

    // 字元過濾檢查
    if (/[a-z]\*[a-z]/i.test(content)) {
      if (!confirm('⚠️ 偵測到內容有疑似 * 亂碼，可能會壞掉，仍要上傳嗎？')) return;
    }

    const btn = document.getElementById('pchBtnUp');
    btn.disabled = true;
    setStatus('info', '🔍 查詢當前檔案 sha...');

    try {
      const sha = await getFileSha(path);
      setStatus('info', '📤 上傳中... (' + (sha ? '更新' : '新建') + ')');
      const b64 = toBase64(content);
      const r = await putFile(path, b64, sha, msg || ('update ' + path));
      const url = r.content && r.content.html_url;
      const commit = r.commit && r.commit.sha && r.commit.sha.slice(0, 7);
      setStatus('ok',
        '✅ 上傳成功！\n' +
        'Commit: ' + commit + '\n' +
        'URL: ' + url + '\n\n' +
        '💡 提示：CDN 可能延遲 5~30 秒，強制重新整理 Ctrl+Shift+R'
      );
    } catch (e) {
      setStatus('err', '❌ 上傳失敗：' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- 啟動 ----------
  function boot() {
    injectCSS();
    buildBtn();
    buildModal();
    console.log(TAG, 'ready', VER);
    console.log(TAG, '點右下 🚀 按鈕開啟上傳器');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
