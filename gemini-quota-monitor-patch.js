/* gemini-quota-monitor-patch.js  v20260713-1
   Gemini API 使用量監控面板
   功能：
   1) 記錄每把 key 每日呼叫次數（成功/失敗/429）
   2) 顯示冷卻中 key、剩餘冷卻時間
   3) 顯示快取命中率
   4) 可收合的浮動面板（右下角，手機友善）
   5) 資料存 localStorage，每日自動歸零
*/
(function () {
  'use strict';
  const TAG = '[GeminiQuota]';
  const VER = 'v20260713-1';
  const STORAGE_KEY = 'gemini_quota_stats';
  const KEY_COOLDOWN_MS = 20 * 60 * 1000;

  // ---------- 資料層 ----------
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth()+1+'').padStart(2,'0')}-${(d.getDate()+'').padStart(2,'0')}`;
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const s = raw ? JSON.parse(raw) : {};
      // 換日自動歸零
      if (s.date !== todayStr()) {
        return { date: todayStr(), keys: {}, cacheHit: 0, cacheMiss: 0, totalCalls: 0 };
      }
      return s;
    } catch {
      return { date: todayStr(), keys: {}, cacheHit: 0, cacheMiss: 0, totalCalls: 0 };
    }
  }

  function saveStats(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  }

  let stats = loadStats();

  function ensureKey(idx) {
    if (!stats.keys[idx]) stats.keys[idx] = { ok: 0, fail: 0, rate429: 0, lastUsed: 0, cooldownUntil: 0 };
    return stats.keys[idx];
  }

  // ---------- 對外 API：讓 lookup patch 呼叫 ----------
  window.__geminiQuota = {
    recordCall(keyIdx, result) {
      const k = ensureKey(keyIdx);
      k.lastUsed = Date.now();
      stats.totalCalls++;
      if (result === 'ok')      k.ok++;
      else if (result === '429'){ k.rate429++; k.cooldownUntil = Date.now() + KEY_COOLDOWN_MS; }
      else                       k.fail++;
      saveStats(stats);
      render();
    },
    recordCache(hit) {
      if (hit) stats.cacheHit++; else stats.cacheMiss++;
      saveStats(stats);
      render();
    },
    reset() {
      stats = { date: todayStr(), keys: {}, cacheHit: 0, cacheMiss: 0, totalCalls: 0 };
      saveStats(stats);
      render();
    }
  };

  // ---------- UI 層 ----------
  const CSS = `
  #geminiQuotaPanel{position:fixed;right:12px;bottom:12px;z-index:99999;
    background:#1a1a1a;color:#eee;border:1px solid #444;border-radius:10px;
    font:12px/1.5 -apple-system,'Segoe UI',sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.4);
    min-width:220px;max-width:90vw;user-select:none;transition:all .2s}
  #geminiQuotaPanel.mini{min-width:0;padding:0}
  #geminiQuotaPanel .qHead{padding:8px 12px;background:#2a2a2a;border-radius:10px 10px 0 0;
    display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:8px}
  #geminiQuotaPanel.mini .qHead{border-radius:10px}
  #geminiQuotaPanel .qTitle{font-weight:bold;color:#4dc9e6}
  #geminiQuotaPanel .qBtn{background:none;border:none;color:#aaa;cursor:pointer;font-size:14px;padding:2px 6px}
  #geminiQuotaPanel .qBtn:hover{color:#fff}
  #geminiQuotaPanel .qBody{padding:10px 12px;max-height:60vh;overflow:auto}
  #geminiQuotaPanel.mini .qBody{display:none}
  #geminiQuotaPanel .qRow{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #333}
  #geminiQuotaPanel .qRow:last-child{border-bottom:none}
  #geminiQuotaPanel .qLabel{color:#aaa}
  #geminiQuotaPanel .qVal{color:#fff;font-weight:bold}
  #geminiQuotaPanel .qKey{background:#252525;padding:6px 8px;border-radius:6px;margin:4px 0}
  #geminiQuotaPanel .qKey.cool{background:#3a2020;border:1px solid #a33}
  #geminiQuotaPanel .qKeyHead{display:flex;justify-content:space-between;font-weight:bold;color:#4dc9e6;margin-bottom:2px}
  #geminiQuotaPanel .qMini{font-size:16px;padding:6px 10px;color:#4dc9e6}
  #geminiQuotaPanel .qReset{width:100%;margin-top:8px;padding:6px;background:#333;border:1px solid #555;
    color:#eee;border-radius:6px;cursor:pointer;font-size:11px}
  #geminiQuotaPanel .qReset:hover{background:#444}
  @media (max-width:600px){
    #geminiQuotaPanel{right:8px;bottom:8px;font-size:11px}
    #geminiQuotaPanel .qBody{max-height:50vh}
  }
  `;

  function injectCSS() {
    if (document.getElementById('geminiQuotaCSS')) return;
    const s = document.createElement('style');
    s.id = 'geminiQuotaCSS';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function fmtMS(ms) {
    if (ms <= 0) return '';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}分${s}秒`;
  }

  function buildPanel() {
    if (document.getElementById('geminiQuotaPanel')) return;
    const el = document.createElement('div');
    el.id = 'geminiQuotaPanel';
    el.className = localStorage.getItem('geminiQuotaMini') === '1' ? 'mini' : '';
    el.innerHTML = `
      <div class="qHead">
        <span class="qTitle">📊 Gemini 用量</span>
        <div>
          <button class="qBtn" id="qBtnMin" title="收合/展開">▬</button>
          <button class="qBtn" id="qBtnClose" title="隱藏（重新整理後回來）">✕</button>
        </div>
      </div>
      <div class="qBody" id="qBody"></div>
    `;
    document.body.appendChild(el);

    el.querySelector('#qBtnMin').onclick = (e) => {
      e.stopPropagation();
      el.classList.toggle('mini');
      localStorage.setItem('geminiQuotaMini', el.classList.contains('mini') ? '1' : '0');
    };
    el.querySelector('#qBtnClose').onclick = (e) => {
      e.stopPropagation();
      el.style.display = 'none';
    };
    el.querySelector('.qHead').onclick = () => {
      if (el.classList.contains('mini')) {
        el.classList.remove('mini');
        localStorage.setItem('geminiQuotaMini', '0');
      }
    };
  }

  function render() {
    const body = document.getElementById('qBody');
    if (!body) return;

    // 換日檢查
    if (stats.date !== todayStr()) stats = loadStats();

    const totalCache = stats.cacheHit + stats.cacheMiss;
    const hitRate = totalCache ? Math.round(stats.cacheHit / totalCache * 100) : 0;

    let html = `
      <div class="qRow"><span class="qLabel">📅 日期</span><span class="qVal">${stats.date}</span></div>
      <div class="qRow"><span class="qLabel">🔥 總呼叫</span><span class="qVal">${stats.totalCalls}</span></div>
      <div class="qRow"><span class="qLabel">📦 快取命中</span><span class="qVal">${stats.cacheHit} / ${totalCache} (${hitRate}%)</span></div>
    `;

    const keyIdxs = Object.keys(stats.keys).sort((a,b) => +a - +b);
    if (keyIdxs.length) {
      html += `<div style="margin-top:8px;color:#4dc9e6;font-weight:bold">🔑 各 Key 明細</div>`;
      keyIdxs.forEach(idx => {
        const k = stats.keys[idx];
        const remain = k.cooldownUntil - Date.now();
        const isCool = remain > 0;
        html += `
          <div class="qKey ${isCool ? 'cool' : ''}">
            <div class="qKeyHead">
              <span>Key ${+idx + 1}</span>
              <span>${isCool ? '❄️ ' + fmtMS(remain) : '✅ 可用'}</span>
            </div>
            <div class="qRow"><span class="qLabel">成功</span><span class="qVal" style="color:#8f8">${k.ok}</span></div>
            <div class="qRow"><span class="qLabel">失敗</span><span class="qVal" style="color:#faa">${k.fail}</span></div>
            <div class="qRow"><span class="qLabel">429</span><span class="qVal" style="color:#f66">${k.rate429}</span></div>
          </div>
        `;
      });
    } else {
      html += `<div style="color:#888;margin-top:8px;text-align:center">尚無呼叫記錄</div>`;
    }

    html += `<button class="qReset" id="qBtnReset">🔄 重置今日統計</button>`;
    body.innerHTML = html;

    const rst = body.querySelector('#qBtnReset');
    if (rst) rst.onclick = () => {
      if (confirm('確定重置今日統計？')) window.__geminiQuota.reset();
    };
  }

  // 每 30 秒刷新一次冷卻倒數
  function boot() {
    injectCSS();
    buildPanel();
    render();
    setInterval(render, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  console.log(TAG, 'ready', VER);
})();
