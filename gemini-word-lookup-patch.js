/* gemini-word-lookup-patch.js v20260712-2
   v2: Robust JSON parsing with multiple fallback strategies
*/

(function () {

  'use strict';

  var GEMINI_KEY_STORAGE = 'notebook_gemini_key_v1';

  var MODEL_LIST = [
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite'
  ];

  function log() {
    try {
      console.log.apply(console, ['[GeminiLookup]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function buildPrompt(word) {

    return '請針對英文單字「' + word + '」提供資訊，以純 JSON 格式回應，不要有任何其他文字或 Markdown 符號。\n\n' +
      '需要的欄位：\n' +
      '- pos：詞性縮寫（n. v. adj. adv. 等）\n' +
      '- tw：繁體中文翻譯（最多 3 個意思，用「；」分隔）\n' +
      '- definition：簡潔英文定義\n' +
      '- synonyms：3-5 個同義字，用「, 」分隔\n' +
      '- example：一個自然的例句\n\n' +
      '規則：\n' +
      '1. 直接輸出 JSON，不要用 ```json 包裝\n' +
      '2. 不要用 Markdown 符號（**, __, [] 等）\n' +
      '3. 所有欄位都用純文字\n' +
      '4. 例句要用完整雙引號括住，內部沒有雙引號\n' +
      '5. 如果內文需要引號，用「」代替\n\n' +
      '範例格式：\n' +
      '{"pos":"n.","tw":"章節；部分","definition":"A distinct part of something","synonyms":"part, portion, segment","example":"The book has ten sections."}\n\n' +
      '請立刻輸出「' + word + '」的 JSON：';
  }

  function robustParseJSON(text) {

    if (!text) return null;

    // 移除常見包裝
    text = text.trim();
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    text = text.replace(/^```\s*/, '').replace(/```\s*$/, '');
    text = text.trim();

    // 找到第一個 { 和最後一個 }
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');

    if (start === -1 || end === -1) return null;

    var jsonText = text.slice(start, end + 1);

    // 策略 1：直接 parse
    try {
      return JSON.parse(jsonText);
    } catch (e) {}

    // 策略 2：修復常見錯誤（單引號、多餘逗號、換行）
    try {
      var fixed = jsonText
        .replace(/\r?\n/g, ' ')           // 移除換行
        .replace(/,\s*}/g, '}')            // 移除物件尾多餘逗號
        .replace(/,\s*]/g, ']')            // 移除陣列尾多餘逗號
        .replace(/'/g, '"');               // 單引號轉雙引號

      return JSON.parse(fixed);
    } catch (e) {}

    // 策略 3：用 regex 抽出各個欄位
    try {
      var result = {};

      var fields = ['pos', 'tw', 'definition', 'synonyms', 'example'];
      fields.forEach(function (f) {
        // 匹配 "field":"..." 或 "field": "..."
        var re = new RegExp('"' + f + '"\\s*:\\s*"([^"]*)"', 'i');
        var m = jsonText.match(re);
        if (m) result[f] = m[1];
      });

      if (Object.keys(result).length > 0) return result;
    } catch (e) {}

    return null;
  }

  async function callGemini(word, key, model) {

    var prompt = buildPrompt(word);
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';

    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
          responseMimeType: 'application/json'   // ★ 強制 JSON 格式（Gemini 2.0+ 支援）
        }
      })
    });

    if (!res.ok) {
      var errText = await res.text();
      var err = new Error('API ' + res.status);
      err.status = res.status;
      err.body = errText;
      throw err;
    }

    var data = await res.json();
    var text = data.candidates?.[0]?.content?.parts?.map(function (p) { return p.text; }).join('') || '';

    if (!text) throw new Error('Gemini 沒有回應');

    var parsed = robustParseJSON(text);

    if (!parsed) {
      log('解析失敗，原始回應:', text.slice(0, 200));
      throw new Error('無法解析 Gemini 回應');
    }

    return parsed;
  }

  async function lookupWord(word) {

    var keys;
    if (typeof window.getGeminiKeys === 'function') {
      keys = window.getGeminiKeys();
    } else {
      var single = localStorage.getItem(GEMINI_KEY_STORAGE);
      keys = single ? [single] : [];
    }

    if (keys.length === 0) {
      throw new Error('請先設定 Gemini API Key');
    }

    var errors = [];

    for (var ki = 0; ki < keys.length; ki++) {

      var key = keys[ki];

      if (typeof window.getGeminiKeyStatus === 'function') {
        var statuses = window.getGeminiKeyStatus();
        var status = statuses.find(function (s) { return s.keyFull === key; });
        if (status && !status.available) continue;
      }

      for (var mi = 0; mi < MODEL_LIST.length; mi++) {

        var model = MODEL_LIST[mi];

        try {

          log('查詢:', word, '用 key', ki + 1, 'model:', model);

          var result = await callGemini(word, key, model);

          if (typeof window.markGeminiKeyOk === 'function') {
            window.markGeminiKeyOk(key);
          }

          return result;

        } catch (e) {

          errors.push({ ki: ki, model: model, status: e.status, msg: e.message });

          if (e.status === 429) {
            if (typeof window.markGeminiKey429 === 'function') {
              window.markGeminiKey429(key);
            }
            break;
          }

          if (e.status === 404) continue;
          if (e.status >= 500) { await sleep(1000); continue; }

          // JSON parse 失敗，換個 model 試
          if (e.message.indexOf('無法解析') !== -1 || e.message.indexOf('parse') !== -1) {
            continue;
          }

          throw e;
        }
      }
    }

    throw new Error('所有 API Key 都無法使用');
  }

  async function updateWordData(surfaceOrLemma) {

    var db;
    try {
      db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
    } catch (e) { return; }

    if (!db.learn) return;

    var lemma = surfaceOrLemma;
    if (typeof window.lemmatizeWord === 'function') {
      var info = window.lemmatizeWord(surfaceOrLemma);
      lemma = info.lemma || surfaceOrLemma;
    }

    var x = db.learn[lemma] || db.learn[surfaceOrLemma];
    if (!x) return;

    var hasTw = x.tw && !String(x.tw).includes('未建') && !String(x.tw).includes('查詢中');
    if (hasTw && x.example && x.synonyms && x.pos) {
      log('已完整，跳過:', lemma);
      return;
    }

    if (x.loading) return;

    x.loading = true;
    x.updatedAt = Date.now();
    localStorage.setItem('notebook_platform_v3', JSON.stringify(db));

    try {

      var result = await lookupWord(lemma);

      var db2 = JSON.parse(localStorage.getItem('notebook_platform_v3'));
      if (db2.learn[lemma]) {

        if (result.tw) db2.learn[lemma].tw = result.tw;
        if (result.pos) db2.learn[lemma].pos = result.pos;
        if (result.definition) db2.learn[lemma].tip = result.definition;
        if (result.example) db2.learn[lemma].example = result.example;
        if (result.synonyms) db2.learn[lemma].synonyms = result.synonyms;

        db2.learn[lemma].loading = false;
        db2.learn[lemma].source = 'Gemini';
        db2.learn[lemma].updatedAt = Date.now();

        localStorage.setItem('notebook_platform_v3', JSON.stringify(db2));

        log('已更新:', lemma, '→', result.tw);

        if (typeof window.showWord === 'function') {
          try { window.showWord(lemma); } catch (e) {}
        }
        if (typeof window.renderCapture === 'function') {
          try { window.renderCapture(); } catch (e) {}
        }
      }

    } catch (e) {

      log('查詢失敗:', lemma, e.message);

      var db3 = JSON.parse(localStorage.getItem('notebook_platform_v3'));
      if (db3.learn[lemma]) {
        db3.learn[lemma].loading = false;
        localStorage.setItem('notebook_platform_v3', JSON.stringify(db3));
      }
    }
  }

  var origClickWord = window.clickWord;

  if (typeof origClickWord === 'function') {

    window.clickWord = function (surface) {

      var result = origClickWord.call(this, surface);

      setTimeout(function () {
        updateWordData(surface);
      }, 200);

      return result;
    };

    log('clickWord hooked');
  }

  window.lookupWordWithGemini = updateWordData;

  window.batchLookupWithGemini = async function (limit) {

    var db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
    var needCheck = [];

    Object.values(db.learn || {}).forEach(function (word) {
      var hasTw = word.tw && !String(word.tw).includes('未建') && !String(word.tw).includes('查詢中');
      if (word.captured && !word.known && (!hasTw || !word.example || !word.synonyms)) {
        needCheck.push(word.lemma || word.word);
      }
    });

    if (limit) needCheck = needCheck.slice(0, limit);

    console.log('需要查詢的單字:', needCheck.length);

    var success = 0;
    var failed = 0;

    for (var i = 0; i < needCheck.length; i++) {
      console.log((i + 1) + '/' + needCheck.length + ' - 查詢:', needCheck[i]);
      try {
        await updateWordData(needCheck[i]);
        success++;
      } catch (e) {
        failed++;
      }
      await sleep(1500);
    }

    console.log('全部完成！成功:', success, '失敗:', failed);
  };

  log('ready v20260712-2');
  log('全域函式:');
  log('  lookupWordWithGemini("word") - 查詢單字');
  log('  batchLookupWithGemini(10) - 批次查詢前 10 個弱點單字');

})();
