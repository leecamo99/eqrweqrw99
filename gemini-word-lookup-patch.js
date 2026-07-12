/* gemini-word-lookup-patch.js v20260712-1
   Uses Gemini API to lookup word details (translation, definition, example, synonyms).
   Automatically retries with different Gemini models if rate limited.
*/

(function () {

  'use strict';

  var GEMINI_KEY_STORAGE = 'notebook_gemini_key_v1';

  // 使用你 API 支援的模型（跟 article-ai-chat 一樣的清單）
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

    return '請針對英文單字「' + word + '」提供以下資訊：\n\n' +
      '1. 詞性（用縮寫如 n. v. adj. adv. 等）\n' +
      '2. 繁體中文翻譯（最多 3 個常用意思，用「；」分隔）\n' +
      '3. 英文定義（簡潔，一句話）\n' +
      '4. 常用同義字（3-5 個，用「, 」分隔）\n' +
      '5. 例句（1 個自然的英文例句）\n\n' +
      '重要規則：\n' +
      '- 輸出必須是純 JSON 格式\n' +
      '- 不要使用 Markdown 語法（不要用 ```json 或 ** 或 [] 等符號）\n' +
      '- 直接輸出 JSON，不要有任何說明文字\n\n' +
      '格式：\n' +
      '{"pos":"詞性","tw":"翻譯","definition":"英文定義","synonyms":"同義字","example":"例句"}\n\n' +
      '請立刻輸出 JSON：';
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
          temperature: 0.3,
          maxOutputTokens: 500
        }
      })
    });

    if (!res.ok) {
      var errText = await res.text();
      var err = new Error('Gemini API ' + res.status);
      err.status = res.status;
      err.body = errText;
      throw err;
    }

    var data = await res.json();
    var text = data.candidates?.[0]?.content?.parts?.map(function (p) { return p.text; }).join('') || '';

    if (!text) throw new Error('Gemini 沒有回應');

    // 移除可能的 Markdown 代碼區塊
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    text = text.r*place(/^```\**/, '').replace(/```\s*$/, '').trim();

    // 解析 JSON
    try {
      return JSON.parse(text);
    } catch (e) {
      log('parse error:', text.slice(0, 100));
      throw new Error('無法解析 Gemini 回應');
    }
  }

  async function lookupWord(word) {

    // 取所有可用 keys
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

      // 檢查 key 是否可用
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

          errors.push({ ki: ki, model: model, status: e.status });

          if (e.status === 429) {
            if (typeof window.markGeminiKey429 === 'function') {
              window.markGeminiKey429(key);
            }
            break;   // 換下一個 key
          }

          if (e.status === 404) continue;
          if (e.status >= 500) { await sleep(1000); continue; }

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

    // 找到單字
    var lemma = surfaceOrLemma;
    if (typeof window.lemmatizeWord === 'function') {
      var info = window.lemmatizeWord(surfaceOrLemma);
      lemma = info.lemma || surfaceOrLemma;
    }

    var x = db.learn[lemma] || db.learn[surfaceOrLemma];
    if (!x) return;

    // 已經有完整資料就跳過
    var hasTw = x.tw && !String(x.tw).includes('未建') && !String(x.tw).includes('查詢中');
    if (hasTw && x.example && x.synonyms && x.pos) {
      log('已完整，跳過:', lemma);
      return;
    }

    if (x.loading) return;

    x.loading = true;
    x.updatedAt = Date.now();

    // 保存 loading state
    localStorage.setItem('notebook_platform_v3', JSON.stringify(db));

    // 呼叫 Gemini
    try {

      var result = await lookupWord(lemma);

      // 更新資料
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

        // 觸發 UI 更新
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

  // Hook clickWord：點單字後自動用 Gemini 補完
  var origClickWord = window.clickWord;

  if (typeof origClickWord === 'function') {

    window.clickWord = function (surface) {

      var result = origClickWord.call(this, surface);

      // 200ms 後檢查是否需要 Gemini 補完
      setTimeout(function () {
        updateWordData(surface);
      }, 200);

      return result;
    };

    log('clickWord hooked');
  }

  // 匯出全域函式
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

    for (var i = 0; i < needCheck.length; i++) {
      console.log((i + 1) + '/' + needCheck.length + ' - 查詢:', needCheck[i]);
      await updateWordData(needCheck[i]);
      await sleep(1500);   // 每個字間隔 1.5 秒
    }

    console.log('全部完成！');
  };

  log('ready v20260712-1');
  log('全域函式:');
  log('  lookupWordWithGemini("word") - 查詢單字');
  log('  batchLookupWithGemini(10) - 批次查詢前 10 個弱點單字');

})();
