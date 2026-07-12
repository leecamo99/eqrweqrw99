/* gemini-word-lookup-patch.js  v20260713-4
   修正：
   1) 移除不存在的 model (3.5-flash / flash-latest)
   2) 強化 JSON 解析（剝 ```json fence）
   3) 429 冷卻：單 key 冷卻 20 分鐘
   4) 批次查詢降速：每字間隔 800ms、失敗立即停止批次
   5) 本地快取 24 小時，避免重複查同一字
   6) 整合 __geminiQuota 監控面板記錄
   7) 讀取實際的 notebook_gemini_api_key_v1 / notebook_gemini_keys_v1
*/*(function () {
  'use strict';
  c*nst TAG = '[GeminiLookup]';
  cons* VER = 'v20260713-4';

  const MOD*LS*= ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-flash'];

  const KEY_COOL*OWN_MS = 20 * 60 * 1000;
  const C*CHE_TTL_MS    = 24 * 60 * 60** 1000;
  const BATCH_GAP_MS    = *00;
  const CALL_GAP_MS     = 300;*
  const _cool = {};
  const*isCool = i => _cool[i] && (Date.no*() - _cool[i] < KEY_COOLDOWN_MS);
* const markCool = i => { _*ool[i] = Date.now(); console.warn(*AG, 'key ' + (i+1) + ' 冷* 20 分鐘'); };

  function cacheGet(*ord) {
    try {
      const raw =*localStorage.getItem('gemini_looku*_cache_'*+ word.toLowerCase());
      if (!*aw) { window.__geminiQuota && wind*w.__geminiQuota.recordCache(false)* return null; }
      const*o = JSON.parse(raw);
      if (Dat*.now() - o.t > CACHE_TTL_MS) { win*ow.__geminiQuota && window.__gemin*Quota.recordCache(*alse); return null; }
      window*__geminiQuota && window.__geminiQu*ta.recordCache(true);
      return*o.d;
    } catch (e) {
      windo*.__gemini*uota && window.__geminiQuota.recor*Cache(false);
      return null;
 *  }
  }
  function cacheSet(word, *ata) {
    try {
      localStorag*.setItem('gemini*lookup_cache_' + word.toLowerCase(*,
        JSON.stringify({ t: Date*now(), d: data }));
    } catch (e* {}
  }

  function*getKeys() {
    var candidates = [
      'notebook_gemini_api_key_v1',
      'notebook_gemini_keys_v1',
      'notebook_gemini_key_v1',
      'gemini_api_keys',
      'gemini_api_key'
    ];
    var keys = [];*    for (var idx = 0; idx * candidates.length; idx++) {
     *var raw = localStorage.getItem(can*idates[idx]);
      if (!raw) cont*nue;
      if (raw.trim().charAt(0* === '[') {
        try {
        * var arr = JSON.parse(raw);
      *   if (Array.isArray(arr)) {
     *      for (var j = 0; j < arr.leng*h; j++) {
              if (arr[j]* keys.push(String(arr[j]).trim());*            }
          }
        * continue;
        } catch (e) {}
*     }
      var parts = raw.split*/[\n,;]+/);
      for (var k = 0; * < parts.length; k++) {
        va* t = parts[k].trim();
        if (*) keys.push(t);*      }
    }
    var seen = {};
 *  var valid = [];
    for (var m =*0; m < keys.length; m++) {
      v*r kk = keys[m];*      if (kk.indexOf('AIza') === 0*&& !seen[kk]) {
        seen[kk] =*1;
        valid.push(kk);
      }*    }
    return valid;*  }

  function safeParseJSON(text* {
    if (!text) return null;
   *var t = String(text).trim()
      *replace(/^```*?:json)?\s*/i, '')
      .replace(*\s*```$/, '')
      .trim();
    v*r m = t.match(/\*[\s\S]*\}/);
    if (m) t = m[0];
    t = t.replace(/,\s*([}\]])/g, '$1');
    try { return*JSON.parse(t*; } catch (e) { return null; }
  }*
  async function callGemini(word,*key, keyIdx, model) {
    var url * 'https://generativelanguage.googleapis.com/v1beta/models/' + model +*':generateContent?key=' + key;
   *var prompt = '請以 JSON 回答英文單字 "' + *ord + '"，只回 JSON：\*{"pos":"詞性 n./v./adj.*等","tw":"繁中最常見意思","*x":"英文例句","tw_ex":"例句繁中翻譯"}';
    *ar res = await fetch(url, {
      *ethod: 'POST',
      headers: { 'C*ntent-Type': 'application/json' },*      body: JSON.stringify({
     *  contents: [{ parts: [{ text: prompt }] }],
        generationConfig* { temperature: 0.2, maxOutputToke*s: 300 }
      })
    });

    if *res.status === 429) {
      window*__geminiQuota && window.__geminiQu*ta.recordCall(keyIdx, '429');
    * markCool(keyIdx);
      throw new*Error('RATE_LIMIT');
    }
    if **es.status === 404) {
      window.*_geminiQuota && window.__geminiQuo*a.recordCall(keyIdx, 'fail');
    * throw new Error('MODEL_NOT_F*UND');
    }
    if (!res.ok) {
  *   window.__geminiQuota && window.*_geminiQuota.recordCall(keyIdx, 'f*il');
      throw new Error('*TTP_' + res.status);
    }

    va* data = await res.json();
    var *ext = (data && data.candidates && *ata.candidates[0] && data.candidat*s[0].content && data.candidates[0]*content.parts && data.candidates[0].content.parts[0] && data.candidat*s[0].content.parts[0].text) || '';*    var parsed = safeParseJSON(tex*);
    if (!parsed) {
      window*__geminiQuota && window.__geminiQu*ta.recordCall(keyIdx, 'fail');
   *  throw new Error('PARSE_F*IL');
    }

    window.__geminiQu*ta && window.__geminiQuota.recordC*ll(keyIdx, 'ok');
    return parse*;
  }

  async function lookupWord*ithGemini(word) {
    if (!word) r*turn null;
    var cached = cacheG*t(word);
    if (cached) { console*log(TAG, '📦*快取命中: ' + word); return cached; }
*    var keys = getKeys();
    if (*keys.length) { console.warn(TAG* '沒有 API key'); return null; }

  * for (var i = 0; i < keys.length; *++) {
      if (isCool(i)) { conso*e.*og(TAG, '跳過冷卻 key ' + (i+1)); cont*nue; }
      for (var m = 0; m < M*DELS.length; m++) {
        var mo*el = MODELS[m];*        console.log(TAG, '查詢: ' + *ord + ' 用 key ' + (i+1) + ' model:*' + model);
        try*{
          var r = await callGemi*i(word, keys[i], i, model);
      *   cacheSet(word, r);
          co*sole.log(TAG, '✅ ' + word + ' 成* (' + model + ')');
          retu*n r;
        } catch (e) {
       *  if (e.message === 'RATE_LIMIT') *reak;
          if (e.message === *MODEL_NOT*FOUND') continue;
          consol*.warn(TAG, model + ' 失敗: ' + e.mes*age);
        }
        await new *romise(function (r) { setTimeout(*, CALL_GAP_MS); });
      }
    }
*   console.warn(TAG, '❌ ' + word +*' 全部失敗');
    return null;
  }

  *sync function batchL*okupWithGemini(words) {
    if (!A*ray.isArray(words) || !words.lengt*) return {};
    var result = {};
*   var total = words.length;
    c*nsole.log(T*G, '🔍 批次啟動：' + total + ' 字');

  * var todo = [];
    for (var i = 0* i < words.length; i++) {
      va**w = words[i];
      var c = cacheG*t(w);
      if (c) result[w] = c;
*     else todo.push(w);
    }
    *onsole.log(TAG, '📦 快取命中 * + (total - todo.length) + ' / ' +*total + '，剩 ' + todo.length + ' 字要*');

    var rateLimit*it = 0;
    for (var j = 0; j < to*o.length; j++) {
      var w2 = to*o[j];
      console.log(TAG, (j+1)*+ '/' + todo.length +*' - 查詢: ' + w2);
      var r2 = aw*it lookupWordWithGemini(w2);
     *if (r2) { result[w2] = r2* rateLimitHit = 0; }
      else {
*       rateLimitHit++;
        if *rateLimitHit >= 3) {
          con*ole.warn(TAG, '* 連續 ' + rateLimitHit + ' 個失敗，中斷批次'*;
          break;
        }
     *}
      await new*Promise(function (r) { setTimeout(*, BATCH_GAP_MS); });
    }
    con*ole.log(TAG, '🎉 批次完成，成功 ' + Objec*.*eys(result).length + ' / ' + total*;
    return result;
  }

  window*lookupWordWithGemini  = lookupWord*ithGemini;
  window.batchLookupWit*G*mini = batchLookupWithGemini;
  co*sole.log(TAG, 'ready', VER);
  con*ole.log(TAG, '全域函式*');
  console.log(TAG, '  lookupWo*dWithGemini("word")  - 查詢單字');
  c*nsole.log(TAG, '  batch*ookupWithGemini([...])  - 批次查詢');
*)();
