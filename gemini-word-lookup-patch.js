/* gemini-word-lookup-patch.js  v20260713-2
   修正：
   1) 移除不存在的 model (3.5-flash / flash-latest)
   2) 強化 JSON 解析（剝 ```json fence）
   3) 429 冷卻：單 key 冷卻 20 分鐘、全域 60 秒節流
   4) 批次查詢降速：每字間隔 800ms、失敗立即停止批次
   5) 本地快取 24 小時，避免重複查同一字
*/
(function () {
  'use strict';
 *const*TAG = '[GeminiLookup]';
  const VE* = 'v20260713-2';

  // ✅ 只留官方合* model
  const MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-flash'];

  const KEY_COOLDOWN_MS = 20 * 60 * 1000;
  const CAC*E_TTL_MS    = 24 * 60 * 60 * 1000;*  const BATCH_GAP_MS    = 800;   */ 批次每字間隔
  const CALL_GAP_MS     =*300;   // 單次呼叫間隔

  const _cool*= {};
  const isCool = i => _cool[i] && (Date.now() - _cool[i] < KEY_*OOLD*WN_MS);
  const markCool = i => { *cool[i] = Date.now(); console.warn*TAG, `key ${i+1} 冷卻*20 分鐘`); };

  // ---- 本地快取 ----
 *function cacheGet(word) {
    try *
      const ra* = localStorage.getItem('gemini_lo*kup_cache_' + word.toLowerCase());*      if (!raw) return null;
     *const o = JSON.parse(*aw);
      if (Date.now() - o.t > *ACHE_TTL_MS) return null;
      re*urn o.d;
    } catch { return null* }
  }
  function cacheSet(*ord, data) {
    try {
      local*torage.setItem('gemini_lookup_cach*_' + word.toLowerCase(),
        J*ON.stringify({*t: Date.now(), d: data }));
    } *atch {}
  }

  function getKeys() *
    const raw = localStorage.getI*em('gemini_api_keys') || localStor*ge.getItem('gemini_api_key') || ''*
    return raw.split(/[\n,;]+/).m*p(s => s.trim()).filter(Boolean);
* }

  function safeParseJS*N(text) {
    if (!text) return nu*l;
    let t = String(text).trim()*      .replace(/^```(?:json)?\s**i, '')
      .replace(/\s*```$/, '')
      .trim();
    const m = t.match(/\{[\s\S]*\}/);
    if (m) t = m[0];
    t = t.replace(/,\s*([}\]])/g, '$1');
    try { return*JSON.parse(t); } catch { return nu*l; }*  }

  async function callGemini(w*rd, key, keyIdx, model) {
    cons* url = `https://generativelanguage*google*pis.com/v1beta/models/${model}:gen*rateContent?key=${key}`;
    const*prompt = `請以 JSON 回*英文單字 "${word}"，只回 JSON：
{"pos":"詞性*n*/v./adj. 等","tw":"繁中最常見*思","ex":"英文例句","tw_ex":"例句繁中翻譯"}`;*    const res = await*fetch(url, {
      method: 'POST',*      headers: { 'Content-Type': '*pplication/json' },
      body: JS*N.stringify({
        contents: [{ parts: [{ text: prompt }] }],
    *   generationConfig: { temperature* 0.2, maxOutputTokens: 300 }
     *})
    });
    if (res.status === *29) { markCool(keyIdx); throw new *rror('RATE_LIMIT'); }
    if (res.*tatus === 404) throw new Error('MO*EL_NOT_FO*ND');
    if (!res.ok) throw new E*ror('HTTP_' + res.status);
    con*t data = await res.json();
    con*t text = data?.candidates?.[0]?.co*tent?.parts?.[0]?.text || '';
    *onst parsed = safeParseJSON(text);*    if (!parsed) throw new Error('*ARSE_FAIL');
    return parsed;
  *

  // ---- 單字查詢 ----
  async func*ion lookupWordWithGemini(word) {
 *  if (!word) return null;
    cons* cached = cacheGet(word);
    if (*ached) { console.log(TAG, `📦 快取命中* ${word}`); return cached; }

    *onst*keys = getKeys();
    if (!keys.le*gth) { console.warn(TAG, '沒有 API k*y'); return null; }

    for (let * = 0; i < keys.length; i++) {*      if (isCool(i)) { console.log*TAG, `跳過冷卻 key ${i+1}`); continue;*}
      for (const model of MODELS* {
        console.log(T*G, `查詢: ${word} 用 key ${i+1} model* ${model}`);
        try {
       *  const r = await callGemini(word,*keys[i], i, model);
          cach*Set(word, r);
          console.lo*(TAG, `✅ ${word} 成功 (${model})`);
*         return r;
        } catch*(e) {
          if (e.message === *RATE_LIMIT') break;
          if (*.message === 'MODEL_NOT_FOUND') co*tinue;
          console.warn(TAG,*`${model} 失敗:*, e.message);
        }
        aw*it new Promise(r => setTimeout(r, *ALL_GAP_MS));
      }
    }
    co*sole.warn(TAG, `❌*${word} 全部失敗`);
    return null;
 *}

  // ---- 批次查詢（弱點單字*----
  async function batchLookupW*thGemini(words) {
    if (!Array.i*Array(words) || !words.length) ret*rn {*;
    const result = {};
    const*total = words.length;
    console.*og(TAG, `🔍 批次啟動*${total} 字`);

    // 先扣掉已快取的
    *onst tod* = [];
    words.forEach(w => {
  *   const c = cacheGet(w);
      if*(c) result[w] = c;
      *lse todo.push(w);
    });
    cons*le.log(TAG, `📦 快取命中 ${total - tod*.length} / ${total}*剩 ${todo.length} 字要查`);

    let r*teLimitHit = *;
    for (let i = 0; i < todo.len*th; i++) {
      const w = todo[i]*
      console.log(TAG, `${i+1}/${*odo.length} - 查*: ${w}`);
      const r = await lo*kupWordWithGemini(w);
      if (r)*{ result[w] = r; rateLimitHit = 0;*}
      else {*        rateLimitHit++;
        //*連續 3 個失敗就中斷批次（大概全 key 都冷卻了*
        if (rateLimitHit >= 3) {
*         console.warn(TAG, `⛔ 連續 $*rateLimitHit} 個失敗，中斷批*以保護 quota`);
          break;
    *   }
      }
      await new Promi*e(r => setTimeout(r, B*TCH_GAP_MS));
    }
    console.lo*(TAG, `🎉 批次完成，成功 ${Object.keys(re*ult).length} /*${total}`);
    return result;
  }*
  window.lookupWordWithGemini  = *ookupWordWithGemini;
  window.batc*LookupWithGemini = batchLookup*ithGemini;
  console.log(TAG, 'rea*y', VER);
  console.log(TAG, '全域函式*');
  console.log(T*G, '  lookupWordWithGemini("word")* - 查詢單字');
  console.log(TAG, '  b*tch*ookupWithGemini([...])  - 批次查詢');
*)();
