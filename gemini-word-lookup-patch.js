/* gemini-word-lookup-patch.js  v20260713-3
   修正：
   1) 移除不存在的 model (3.5-flash / flash-latest)
   2) 強化 JSON 解析（剝 ```json fence）
   3) 429 冷卻：單 key 冷卻 20 分鐘、全域 60 秒節流
   4) 批次查詢降速：每字間隔 800ms、失敗立即停止批次
   5) 本地快取 24 小時，避免重複查同一字
   6) 整合 __geminiQuota 監控面板記錄（optional chaining 安全呼叫）
*/
(function () {
  'use strict';
 *const TAG = '[GeminiLookup]';
  co*st VER = 'v20260713-3';

  // ✅ 只留*方合法 model
  const MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-flash'];

  const KEY_COOLDOWN_MS = *0 * 60 * 1000;
  const CACHE_TTL_M*    = 24 * 60 * 60 * 1000;
  const*BATCH_GAP_MS    = 800;   // 批次每字間隔*  const CALL_GAP_MS     = 300;   /* 單次呼叫間隔

  const _cool = {};
  con*t isCool = i => _cool[i] && (Date.*ow() - _cool[i] < KEY_COOLDOWN_MS)*
  const markCool = i => { _cool[i] = Date.now(); console.warn(TAG, `*ey ${i+1} 冷卻 20 分鐘`); };

  // ---* 本地快取 ----
  function cacheGet(wor*) {
    try {
      const raw = lo*al*torage.getItem('gemini_lookup_cach*_' + word.toLowerCase());
      if*(!raw) {
        window.__geminiQu*ta?.recordCache(false);   */ 👈 快取 miss
        return null;
*     }
      const o = JSON.parse(*aw);
      if (*ate.now() - o.t > CACHE_TTL_MS) {
*       window.__geminiQuota?.recor*Cache(false);   // 👈 過期也* miss
        return null;
      }*      window.__geminiQuota?.record*ache(true);      // 👈 命中
      re*urn o.d;
    } catch {
      windo**__geminiQuota?.recordCache(false);*      return null;
    }
  }
  fun*tion cacheSet(word, data) {
    tr* {
      localStorage.setItem('gem*ni_lookup*cache_' + word.toLowerCase(),
    *   JSON.stringify({ t: Date.now(),*d: data }));
    } catch {}
  }

 *function getKeys() {
    const ra* = localStorage.getItem('gemini_ap*_keys') || localStorage.getItem('g*mini_api_key') || '';
    return r*w.split(/[\n,;]+/).map(s => s.trim*)).filter(Boolean);
  }

  functio* safeParseJSON(text) {
    if (!te*t) return null;*    let t = String(text).trim()
  *   .replace(/^```(?:json)?\s*/i, '*)
      .replace(/\s*```$*, '')
      .trim();
    const m = t.match(/\{[\s\S]*\}/);
    if (m) t = m[0];
    t = t.replace(/,\s*([}\]])/g, '$1');
    try { retu*n JSON.parse(t); } catch { return *ull; }
  }

  async function*callGemini(word, key, keyIdx, mode*) {
    const url = `https://gener*tivelanguage.googleapis.com/v1beta*models/${model}:generateContent?ke*=*{key}`;
    const prompt = `請以 JSO* 回答英文*字 "${word}"，只回 JSON：
{"pos":"詞性 *./v./adj. 等","tw":"繁中最*見意思","ex":"英文例句","tw*ex":"例句繁中翻譯"}`;
    const res = aw*it fetch(url, {
      method: 'POS*',
      headers* { 'Content-Type': 'application/js*n' },
      body: JSON.stringify({*        contents: [{ parts: [{ text: prompt }] }],
        generation*onfig: { temperature: 0.2, maxOutp*tTokens: 300 }
      })
    });

 *  if (res.status === 429) {
      *indow.__geminiQuota?.recordCall(ke*Idx, '429');   // 👈 記錄 429
      *arkCool(keyIdx);
      throw new E*ror('RATE_LIMIT');
    }
    if (r*s.status === 404)*{
      window.__geminiQuota?.reco*dCall(keyIdx, 'fail');  // 👈 記錄失敗*      throw new Error('MODEL_N*T_FOUND');
    }
    if (!res.ok) *
      window.__geminiQuota?.recor*Call(keyIdx, 'fail');  // 👈 記錄失*
      throw new Error('HTTP_' + r*s.status);
    }

    const data =*await res.json();
    const text =*data?.candidates?.[0]?.content?.pa**s?.[0]?.text || '';
    const pars*d = safeParseJSON(text);
    if (!*arsed) {
      window.__geminiQuot*?.recordCall(keyIdx, *fail');  // 👈 解析失敗
      throw ne* Error('PARSE_FAIL');
    }

    w*ndow.__geminiQuota?.recordCall(key*dx, *ok');      // 👈 記錄成功
    return p*rsed;
  }

  // ---- 單字查詢 ----
  a*ync function lookupWordWithGemini(*ord* {
    if (!word) return null;
   *const cached = cacheGet(word);
   *if (cached) { console.log(TAG, `📦*快取命中: ${word}`); return c*ched; }

    const keys = getKeys(*;
    if (!keys.length) { console.*arn(TAG, '沒有 API key'); return nul*; }

    for (let i = 0;*i < keys.length; i++) {
      if (*sCool(i)) { console.log(TAG, `跳過冷卻*key ${i+1}`); continue; }
      fo* (const model of MODELS)*{
        console.log(TAG, `查詢: ${*ord} 用 key ${i+1} model: ${model}`*;
        *ry {
          const r = await cal*Gemini(word, keys[i], i, model);
 *        cacheSet(word, r);
       *  console.log(TAG, `✅ ${word} 成功 (*{model})`);*          return r;
        } catc* (e) {
          if (e.message ===*'RATE_LIMIT') break;
          if *e.message === 'MODEL_NOT_FOUND') c*ntinue;*          console.warn(TAG, `${mod*l} 失敗:`, e.message);
        }
   *    await new Promise(r => setTime*ut(r, CALL_GAP_MS));
      }
    }*    console.warn(TAG, `❌ ${word} 全*失敗`);
    return null;
  }

  // -*-- 批次查詢（弱點單字）----
  async function*bat*hLookupWithGemini(words) {
    if *!Array.isArray(words) || !words.le*gth) return {};
    const result =*{};
    const total = words.length*
    console.log(TAG, `*� 批次啟動：${total} 字`);

    // 先扣掉已快*的
    const todo = [];
    words.f*rEach(w => {
      const c = c*cheGet(w);
      if (c) result[w] * c;
      else todo.push(w);
    }*;
    console.log(TAG, `📦 快取命中 ${*otal*- todo.length} / ${total}，剩 ${todo*length} 字要查`);

    let rateLimitH*t = 0;
    for (let i = 0; i < tod*.length; i++) {
      const w = to*o[i];
      console.log(TAG, `${i+*}/${todo.length} - 查詢: ${w}`);
   *  const*r = await lookupWordWithGemini(w);*      if (r) { result[w] = r; rate*imitHit = 0; }
      else {
      * rateLimitHit++;
        // 連* 3 個失敗就中斷批次（大概全 key 都冷卻了）
        *f (rateLimitHit >= 3* {
          console.warn(TAG, `⛔ *續 ${rateLimitHit} 個失敗，中斷批次以保護 quot*`);*          break;
        }
      }*      await new Promise(r => setTi*eout(r, BATCH_GAP_MS));
    }
    *onsole.log(TAG, `🎉 批次完成，*功 ${Object.keys(result).length} / *{total}`);
    return result;
  }
*  window.lookupWordWithGemini  = l*okupWordWithGemini;
  window.batch**okupWithGemini = batchLookupWithGe*ini;
  console.log(TAG, 'ready', V*R);
  console.log(TAG, '全域函式:');
 *console.log(TAG,*'  lookupWordWithGemini("word")  -*查詢單字');
  console.log(TAG, '  batc*LookupWithGemini([...])  - 批次查*');
})();
