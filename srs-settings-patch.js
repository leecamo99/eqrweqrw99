/*!
 * srs-settings-patch.js  v20260718-1
 * SRS / Anki 風格參數面板
 * 儲存位置：localStorage['__srsSettings']
 *
 * 使用方式：
 *   1) 側邊「設定與管理」→ 自動注入「SRS 參數」按鈕
 *   2) 或 Console 執行 __openSrsSettings()
 *   3) 讀取參數：__getSrs('masterThreshold')
 *   4) 重設預設值：__resetSrs()
 *
 * 參數會廣播 CustomEvent('srsSettingsChanged')，其他 patch 可監聽即時套用。
 */
(function () {
  'use strict';
  var TAG = '[SrsSettings]';
  var VER = 'v20260718-2';
  var STORAGE_KEY = '__srsSettings';

  // ==== 預設值（對照 Anki / memoryToast）====
  var DEFAULTS = {
    // 每日上限
    dailyNewCards: 20,      // 每天新卡上限
    dailyReviewCap: 200,    // 每天複習上限

    // 熟練判定（本系統用 clicks）
    masterThreshold: 5,     // clicks >= N 視為已熟

    // 新卡片
    learnSteps: '1 10',     // 學習階段（分鐘，空白分隔）
    graduatingInterval: 1,  // 畢業間隔（天）
    easyInterval: 4,        // 簡單間隔（天）
    insertOrder: 'sequential', // 'sequential' | 'random'

    // 忘記次數
    relearnSteps: '10',     // 重新學習階段（分鐘）
    minInterval: 1,         // 最短間隔（天）
    lapseThreshold: 8,      // 棘手卡臨界值
    lapseAction: 'tag',     // 'tag' | 'suspend'

    // 進階
    maxInterval: 36500,     // 最長間隔（天）
    startingEase: 2.50,     // 起始輕鬆度
    easyBonus: 1.30,        // 簡單卡倍率
    intervalModifier: 1.00, // 間隔調節器
    hardInterval: 1.20,     // 困難間隔倍率
    newInterval: 0.00,      // 忘記後新間隔

    // 計時器
    maxAnswerSeconds: 60,
    showTimer: false,

    // 音訊
    autoPlayAudio: true,
    skipAudioOnReplay: false
  };

  // ==== 讀寫 ====
  function loadAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      // 補齊預設值
      Object.keys(DEFAULTS).forEach(function (k) {
        if (obj[k] === undefined) obj[k] = DEFAULTS[k];
      });
      return obj;
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }
  function saveAll(obj) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    // 廣播 → flash-counter-v2 等 patch 可監聽
    window.dispatchEvent(new CustomEvent('srsSettingsChanged', { detail: obj }));
  }

  window.__getSrs = function (key) {
    var all = loadAll();
    return key ? all[key] : all;
  };
  window.__setSrs = function (key, val) {
    var all = loadAll();
    all[key] = val;
    saveAll(all);
    console.log(TAG, key, '→', val);
  };
  window.__resetSrs = function () {
    saveAll(Object.assign({}, DEFAULTS));
    console.log(TAG, '已重設為預設值');
    if (document.getElementById('srsSettingsModal')) renderModal();
  };

  // ==== UI 定義（分區塊）====
  var FIELDS = [
    { section: '每日上限', items: [
      { key: 'dailyNewCards',   label: '每天新卡片數量', type: 'number', min: 0, max: 999, hint: '每天最多學幾張新卡' },
      { key: 'dailyReviewCap',  label: '每天複習上限',   type: 'number', min: 0, max: 9999, hint: '每天最多複習張數' },
      { key: 'masterThreshold', label: '熟練門檻 (clicks)', type: 'number', min: 1, max: 99, hint: 'clicks >= N 視為已熟，不列入池中' }
    ]},
    { section: '新卡片', items: [
      { key: 'learnSteps',         label: '學習階段（分鐘）', type: 'text',   hint: '空白分隔，例如 "1 10"' },
      { key: 'graduatingInterval', label: '成為畢業卡片間隔（天）', type: 'number', min: 1, max: 999 },
      { key: 'easyInterval',       label: '簡單卡片間隔（天）',    type: 'number', min: 1, max: 999 },
      { key: 'insertOrder',        label: '插入順序', type: 'select', options: [
        { value: 'sequential', label: '循序（最舊的卡片在前）' },
        { value: 'random',     label: '隨機' }
      ]}
    ]},
    { section: '忘記次數', items: [
      { key: 'relearnSteps',   label: '重新學習階段（分鐘）', type: 'text' },
      { key: 'minInterval',    label: '最短間隔（天）', type: 'number', min: 1, max: 999 },
      { key: 'lapseThreshold', label: '棘手卡臨界值', type: 'number', min: 1, max: 99 },
      { key: 'lapseAction',    label: '棘手卡動作', type: 'select', options: [
        { value: 'tag',     label: '僅加上標籤' },
        { value: 'suspend', label: '暫停' }
      ]}
    ]},
    { section: '進階選項', items: [
      { key: 'maxInterval',      label: '最長間隔（天）',   type: 'number', min: 1, max: 36500 },
      { key: 'startingEase',     label: '起始輕鬆度',       type: 'number', step: 0.01, min: 1.30, max: 5.00 },
      { key: 'easyBonus',        label: '簡單卡的間隔倍率', type: 'number', step: 0.01, min: 1.00, max: 3.00 },
      { key: 'intervalModifier', label: '間隔調節器',       type: 'number', step: 0.01, min: 0.50, max: 2.00 },
      { key: 'hardInterval',     label: '困難間隔',         type: 'number', step: 0.01, min: 1.00, max: 3.00 },
      { key: 'newInterval',      label: '設定新的間隔為',   type: 'number', step: 0.01, min: 0.00, max: 1.00 }
    ]},
    { section: '計時器', items: [
      { key: 'maxAnswerSeconds', label: '最大回答秒數', type: 'number', min: 5, max: 600 },
      { key: 'showTimer',        label: '顯示回答計時器', type: 'boolean' }
    ]},
    { section: '音訊', items: [
      { key: 'autoPlayAudio',     label: '自動播放音訊', type: 'boolean' },
      { key: 'skipAudioOnReplay', label: '重播答案時跳過問題', type: 'boolean' }
    ]}
  ];

  // ==== Modal ====
  function ensureStyle() {
    if (document.getElementById('srsSettingsStyle')) return;
    var s = document.createElement('style');
    s.id = 'srsSettingsStyle';
    s.textContent = [
      '#srsSettingsModal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,"Noto Sans TC",sans-serif}',
      '#srsSettingsModal .box{background:#fff8ec;color:#333;border-radius:14px;max-width:820px;width:100%;max-height:90vh;overflow:auto;padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,.4);border:1px solid #e8dcc0}',
      '#srsSettingsModal h2{margin:0 0 6px;font-size:20px;color:#a68a56;display:flex;align-items:center;gap:8px}',
      '#srsSettingsModal .sub{color:#8a7548;font-size:13px;margin-bottom:16px}',
      '#srsSettingsModal .sec{margin:14px 0 8px;padding-top:12px;border-top:1px solid #ead9b6}',
      '#srsSettingsModal .sec h3{margin:0 0 10px;font-size:15px;color:#4dc9e6;font-weight:700}',
      '#srsSettingsModal .row{display:grid;grid-template-columns:1fr 180px;gap:10px;align-items:center;padding:6px 0}',
      '#srsSettingsModal .row label{font-size:14px;color:#555}',
      '#srsSettingsModal .row .hint{font-size:11px;color:#a68a56;display:block;margin-top:2px}',
      '#srsSettingsModal input[type=number],#srsSettingsModal input[type=text],#srsSettingsModal select{width:100%;padding:6px 10px;border:1px solid #d9c99a;border-radius:6px;background:#fff;font-size:14px;box-sizing:border-box}',
      '#srsSettingsModal .sw{display:inline-flex;align-items:center;gap:6px;justify-self:end}',
      '#srsSettingsModal .sw input{transform:scale(1.2)}',
      '#srsSettingsModal .footer{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #ead9b6}',
      '#srsSettingsModal button{padding:8px 16px;border-radius:8px;border:none;font-size:14px;cursor:pointer;font-weight:600}',
      '#srsSettingsModal .btn-close{background:#4dc9e6;color:#fff}',
      '#srsSettingsModal .btn-reset{background:transparent;color:#c44;border:1px solid #c44}',
      '#srsSettingsModal .btn-x{position:absolute;top:14px;right:16px;background:transparent;border:1px solid #a68a56;color:#a68a56;width:30px;height:30px;border-radius:50%;font-size:14px;padding:0;display:flex;align-items:center;justify-content:center}',
      '@media(max-width:640px){#srsSettingsModal .row{grid-template-columns:1fr;gap:4px}#srsSettingsModal .sw{justify-self:start}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function renderModal() {
    ensureStyle();
    var old = document.getElementById('srsSettingsModal');
    if (old) old.remove();

    var s = loadAll();
    var html = ['<div class="box" style="position:relative">',
      '<button class="btn-x" title="關閉">✕</button>',
      '<h2>🧠 SRS 學習參數</h2>',
      '<div class="sub">Anki 風格參數，調整後即時生效。所有值儲存於瀏覽器本機。</div>'];

    FIELDS.forEach(function (grp) {
      html.push('<div class="sec"><h3>' + grp.section + '</h3>');
      grp.items.forEach(function (f) {
        var val = s[f.key];
        var input = '';
        if (f.type === 'boolean') {
          input = '<span class="sw"><input type="checkbox" data-key="' + f.key + '"' + (val ? ' checked' : '') + '></span>';
        } else if (f.type === 'select') {
          var opts = f.options.map(function (o) {
            return '<option value="' + o.value + '"' + (o.value === val ? ' selected' : '') + '>' + o.label + '</option>';
          }).join('');
          input = '<select data-key="' + f.key + '">' + opts + '</select>';
        } else if (f.type === 'text') {
          input = '<input type="text" data-key="' + f.key + '" value="' + String(val).replace(/"/g, '&quot;') + '">';
        } else {
          input = '<input type="number" data-key="' + f.key + '" value="' + val + '"' +
            (f.min !== undefined ? ' min="' + f.min + '"' : '') +
            (f.max !== undefined ? ' max="' + f.max + '"' : '') +
            (f.step !== undefined ? ' step="' + f.step + '"' : '') + '>';
        }
        html.push('<div class="row"><label>' + f.label +
          (f.hint ? '<span class="hint">' + f.hint + '</span>' : '') + '</label>' + input + '</div>');
      });
      html.push('</div>');
    });

    html.push('<div class="footer">',
      '<button class="btn-reset">↺ 重設為預設值</button>',
      '<button class="btn-close">✓ 關閉</button>',
      '</div></div>');

    var modal = document.createElement('div');
    modal.id = 'srsSettingsModal';
    modal.innerHTML = html.join('');
    document.body.appendChild(modal);

    // 綁定
    function commit() {
      var newObj = loadAll();
      modal.querySelectorAll('[data-key]').forEach(function (el) {
        var k = el.dataset.key;
        if (el.type === 'checkbox') newObj[k] = el.checked;
        else if (el.type === 'number') newObj[k] = parseFloat(el.value);
        else newObj[k] = el.value;
      });
      saveAll(newObj);
    }
    modal.querySelectorAll('[data-key]').forEach(function (el) {
      el.addEventListener('change', commit);
    });
    modal.querySelector('.btn-close').onclick = function () { modal.remove(); };
    modal.querySelector('.btn-x').onclick = function () { modal.remove(); };
    modal.querySelector('.btn-reset').onclick = function () {
      if (confirm('確定要重設所有 SRS 參數為預設值嗎？')) window.__resetSrs();
    };
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.remove();
    });
  }

  window.__openSrsSettings = renderModal;

  // ==== 注入到「設定與管理」中心，並移除側邊欄 SRS 按鈕 ====
  function injectButton() {
    // 1. 移除舊版側邊欄按鈕
    var oldSide = document.getElementById('srsSideBtn');
    if (oldSide) oldSide.remove();

    // 2. 移除舊版錯誤位置按鈕
    var oldHubEntry = document.getElementById('srsHubEntry');
    if (oldHubEntry) oldHubEntry.remove();

    // 3. 找設定中心 Modal
    var hub = document.getElementById('settingsHubModal');
    if (!hub) return false;

    // 4. 已插入過就停止
    if (document.getElementById('srsHubCard')) return true;

    // 5. 找「學習資料統計」卡片
    var all = Array.prototype.slice.call(hub.querySelectorAll('div,section,article'));

    var statsCard = all.find(function (el) {
      var txt = el.textContent || '';
      return txt.includes('學習資料統計') &&
             txt.includes('筆記本數量') &&
             txt.includes('弱點單字');
    });

    // 6. 如果找不到精準卡片，就找含「學習資料統計」的最小區塊
    if (!statsCard) {
      statsCard = all.find(function (el) {
        return (el.textContent || '').includes('學習資料統計');
      });
    }

    // 7. 建立 SRS 卡片
    var card = document.createElement('div');
    card.id = 'srsHubCard';
    card.style.cssText =
      'background:#fff;border:1px solid #eadfca;border-radius:10px;' +
      'padding:16px;margin:14px 0;box-sizing:border-box;';

    card.innerHTML =
      '<h3 style="margin:0 0 10px;color:#a68a56;font-size:17px;border-bottom:1px dotted #d8c8a8;padding-bottom:8px;">' +
        '🧠 SRS 學習參數' +
      '</h3>' +
      '<p style="margin:0 0 12px;color:#777;font-size:13px;line-height:1.6;">' +
        '調整 Anki 風格複習參數：每日新卡、複習上限、熟練門檻、忘記次數、音訊與計時器。' +
      '</p>' +
      '<button id="openSrsSettingsFromHub" class="btn" style="' +
        'background:#a68a56;color:#fff;border:0;border-radius:6px;' +
        'padding:8px 14px;cursor:pointer;font-size:13px;' +
      '">' +
        '🧠 開啟 SRS 學習參數' +
      '</button>';

    // 8. 插入位置：學習資料統計下面；找不到就放在設定中心最後
    if (statsCard && statsCard.parentNode) {
      statsCard.insertAdjacentElement('afterend', card);
    } else {
      var box =
        hub.querySelector('.box') ||
        hub.querySelector('[class*=box]') ||
        hub.querySelector('[style*=background]') ||
        hub.firstElementChild ||
        hub;

      box.appendChild(card);
    }

    // 9. 綁定開啟事件
    var openBtn = document.getElementById('openSrsSettingsFromHub');
    if (openBtn) {
      openBtn.onclick = function () {
        renderModal();
      };
    }

    return true;
  }
  }

  function boot() {
    setTimeout(function () {
      injectButton();
      // 每 3 秒重試（settingsHubModal 是 lazy 生成）
      setInterval(injectButton, 3000);
      console.log(TAG, 'ready', VER);
      console.log(TAG, '💡 開啟面板：__openSrsSettings() | 讀值：__getSrs("masterThreshold")');
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
