/* gemini-word-lookup-patch.js  v20260713-5
   完整乾淨版 (base64 直傳，避免字元過濾)
   修正：
   1) 移除不存在的 model (3.5-flash / flash-latest)
   2) 強化 JSON 解析（剝 ```json fence）
   3) 429 冷卻：單 key 冷卻 20 分鐘
   4) 批次查詢降速：每字間隔 800ms、失敗立即停止批次
   5) 本地快取 24 小時
   6) 整合 __geminiQuota 監控面板
   7) 讀取 notebook_gemini_api_key_v1 / notebook_gemini_keys_v1
*/
(function () {
  'use strict';
  var TAG = '[GeminiLookup]';
  var VER = 'v20260713-5';

  var MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-flash'];

  var KEY_COOLDOWN_MS = 20 * 60 * 1000;
  var CACHE_TTL_MS    = 24 * 60 * 60 * 1000;
  var BATCH_GAP_MS    = 800;
  var CALL_GAP_MS     = 300;

  var _cool = {};
  function isCool(i) { return _cool[i] && (Date.now() - _cool[i] < KEY_COOLDOWN_MS); }
  function markCool(i) { _cool[i] = Date.now(); console.warn(TAG, 'key ' + (i+1) + ' 冷卻 20 分鐘'); }

  function cacheGet(word) {
    try {
      var raw = localStorage.getItem('gemini_lookup_cache_' + word.toLowerCase());
      if (!raw) { if (window.__geminiQuota) window.__geminiQuota.recordCache(false); return null; }
      var o = JSON.parse(raw);
      if (Date.now() - o.t > CACHE_TTL_MS) {
        if (window.__geminiQuota) window.__geminiQuota.recordCache(false);
        return null;
      }
      if (window.__geminiQuota) window.__geminiQuota.recordCache(true);
      return o.d;
    } catch (e) {
      if (window.__geminiQuota) window.__geminiQuota.recordCache(false);
      return null;
    }
  }

  function cacheSet(word, data) {
    try {
      localStorage.setItem('gemini_lookup_cache_' + word.toLowerCase(),
        JSON.stringify({ t: Date.now(), d: data }));
    } catch (e) {}
  }

  function getKeys() {
    var candidates = [
      'notebook_gemini_api_key_v1',
      'notebook_gemini_keys_v1',
      'notebook_gemini_key_v1',
      'gemini_api_keys',
      'gemini_api_key'
    ];
    var keys = [];
    for (var i = 0; i < candidates.length; i++) {
      var raw = localStorage.getItem(candidates[i]);
      if (!raw) continue;
      if (raw.trim().charAt(0) === '[') {
        try {
          var arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            for (var j = 0; j < arr.length; j++) {
              if (arr[j]) keys.push(String(arr[j]).trim());
            }
          }
          continue;
        } catch (e) {}
      }
      var parts = raw.split(/[\n,;]+/);
      for (var k = 0; k < parts.length; k++) {
        var t = parts[k].trim();
        if (t) keys.push(t);
      }
    }
    var seen = {};
    var valid = [];
    for (var m = 0; m < keys.length; m++) {
      var kk = keys[m];
      if (kk.indexOf('AIza') === 0 && !seen[kk]) {
        seen[kk] = 1;
        valid.push(kk);
      }
    }
    return valid;
  }

  function safeParseJSON(text) {
    if (!text) return null;
    var t = String(text).trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    var m = t.match(/\{[\s\S]*\}/);
    if (m) t = m[0];
    t = t.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(t); } catch (e) { return null; }
  }

  async function callGemini(word, key, keyIdx, model) {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
    var prompt = '請以 JSON 回答英文單字 "' + word + '"，只回 JSON：\n{"pos":"詞性 n./v./adj. 等","tw":"繁中最常見意思","ex":"英文例句","tw_ex":"例句繁中翻譯"}';
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
      })
    });

    if (res.status === 429) {
      if (window.__geminiQuota) window.__geminiQuota.recordCall(keyIdx, '429');
      markCool(keyIdx);
      throw new Error('RATE_LIMIT');
    }
    if (res.status === 404) {
      if (window.__geminiQuota) window.__geminiQuota.recordCall(keyIdx, 'fail');
      throw new Error('MODEL_NOT_FOUND');
    }
    if (!res.ok) {
      if (window.__geminiQuota) window.__geminiQuota.recordCall(keyIdx, 'fail');
      throw new Error('HTTP_' + res.status);
    }

    var data = await res.json();
    var text = '';
    try {
      text = data.candidates[0].content.parts[0].text || '';
    } catch (e) {}
    var parsed = safeParseJSON(text);
    if (!parsed) {
      if (window.__geminiQuota) window.__geminiQuota.recordCall(keyIdx, 'fail');
      throw new Error('PARSE_FAIL');
    }
    if (window.__geminiQuota) window.__geminiQuota.recordCall(keyIdx, 'ok');
    return parsed;
  }

  async function lookupWordWithGemini(word) {
    if (!word) return null;
    var cached = cacheGet(word);
    if (cached) { console.log(TAG, '📦 快取命中: ' + word); return cached; }

    var keys = getKeys();
    if (!keys.length) { console.warn(TAG, '沒有 API key'); return null; }

    for (var i = 0; i < keys.length; i++) {
      if (isCool(i)) { console.log(TAG, '跳過冷卻 key ' + (i+1)); continue; }
      for (var m = 0; m < MODELS.length; m++) {
        var model = MODELS[m];
        console.log(TAG, '查詢: ' + word + ' 用 key ' + (i+1) + ' model: ' + model);
        try {
          var r = await callGemini(word, keys[i], i, model);
          cacheSet(word, r);
          console.log(TAG, '✅ ' + word + ' 成功 (' + model + ')');
          return r;
        } catch (e) {
          if (e.message === 'RATE_LIMIT') break;
          if (e.message === 'MODEL_NOT_FOUND') continue;
          console.warn(TAG, model + ' 失敗: ' + e.message);
        }
        await new Promise(function (rs) { setTimeout(rs, CALL_GAP_MS); });
      }
    }
    console.warn(TAG, '❌ ' + word + ' 全部失敗');
    return null;
  }

  async function batchLookupWithGemini(words) {
    if (!Array.isArray(words) || !words.length) return {};
    var result = {};
    var total = words.length;
    console.log(TAG, '🔍 批次啟動：' + total + ' 字');

    var todo = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var c = cacheGet(w);
      if (c) result[w] = c;
      else todo.push(w);
    }
    console.log(TAG, '📦 快取命中 ' + (total - todo.length) + ' / ' + total + '，剩 ' + todo.length + ' 字要查');

    var rateLimitHit = 0;
    for (var j = 0; j < todo.length; j++) {
      var w2 = todo[j];
      console.log(TAG, (j+1) + '/' + todo.length + ' - 查詢: ' + w2);
      var r2 = await lookupWordWithGemini(w2);
      if (r2) { result[w2] = r2; rateLimitHit = 0; }
      else {
        rateLimitHit++;
        if (rateLimitHit >= 3) {
          console.warn(TAG, '⛔ 連續 ' + rateLimitHit + ' 個失敗，中斷批次');
          break;
        }
      }
      await new Promise(function (rs) { setTimeout(rs, BATCH_GAP_MS); });
    }
    console.log(TAG, '🎉 批次完成，成功 ' + Object.keys(result).length + ' / ' + total);
    return result;
  }

  window.lookupWordWithGemini  = lookupWordWithGemini;
  window.batchLookupWithGemini = batchLookupWithGemini;
  console.log(TAG, 'ready', VER);
  console.log(TAG, '全域函式:');
  console.log(TAG, '  lookupWordWithGemini("word")  - 查詢單字');
  console.log(TAG, '  batchLookupWithGemini([...])  - 批次查詢');
})();
