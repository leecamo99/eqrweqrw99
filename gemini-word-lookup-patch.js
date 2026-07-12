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
      '3. 所有**都用純文字\n' +
      '4. 例句要用完整雙**括住，內部沒有雙引號\n' +
      '5. 如果內文需**號，用「」代替\n\n' +
      '範例格式：\n' +
**    '{"pos":"n**,"tw":"章節；部分","definition":"A dis**nct part of something","synonyms"**part,**ortion, segment","example":"The b**k has ten sections."}\n\n' +
    **'請**輸出「' + word + '」的 JSON：';
  }

  **nction robustParseJSON(text) {**    if (!text) return null;

    ** 移除常見包裝
    text = text.trim();
 ** text = text.replace(/^```json***/i, '').replace(/```\s*$/, '');
*** text = text.replace(/^```\s*/, ***.replace(/```\s*$/**'');
    text = text.trim();

   **/ 找到第一個 { 和最後一個 }
    var start =**ext.indexOf('**);
    var end = text.lastIndexOf**}');

    if (start === -1 || end**== -1) return null;

    var json**xt = text.slice(start, end + 1);
**   // 策略 **直接 parse
    try {
      return J**N.parse(jsonText);
    } catch (e**{}

    // 策略 2：修復常**誤（單引號、多餘逗號、換行）
    try {
      va**f**ed = jsonText
        .replace(/\**\n/g, ' ')           // 移除換行
    **  .replace(/,\s*}*** '}')            // 移除物件尾多餘逗號
  ***   .replace(/,\s***g, ']')            // 移除陣列尾多餘逗號
 **     .replace(/'/g, '"');        **     // 單引號轉雙引號

      return JS**.parse(fixed);
    } catch (e) {}**    // 策略 3：用 regex 抽出各個欄位
    tr**{**     var result = {};

      var **elds = ['pos', 'tw', 'definition', 'synonyms', 'example'];
      fie**s.forEach(function (f) {
        ****配 "field":"..." 或 "field": "..."
        var re = new RegExp('"' + f + '"\\s***\s*"([^"]*)"', 'i');
        var *** jsonText.match(re);
        if *** result[f] = m[1];
      });

  *** if (Object.keys(result).length***0) return result;
    } catch (e***}

    return null;
  }

  async***nction callGemini(word, key, mod*** {

    var prompt = buildPrompt***rd);
    var url***'https://generativelanguage.googleapis.com/v1beta/models/' + model ***:generateContent';

    var res ***wait fetch(url, {
      method: ***ST',
      ***ders: {
        'Content-Type': ***plication/json',
        'x-goog***i-key': key
      },
      body:***ON.stringify({
        contents:*** role: 'user', parts: [{ text: prompt }] }],
        generationConf*** {
          temperature: 0.2,
 ***      maxOutputTokens: 500,
    ***   responseMimeType: 'applicatio***son'   // ★ 強制 JSON 格式（Gemini 2.***支援***       }
      })
    });

    i***!res.ok) {
      var errText = a***t res.text();
      var err = ne***rror('API ' + res.status);
     ****.status = res.status;
      err.***y = errText;
      throw err;
  ***

    var data = await res.json(***    var text = data.candidates?.***?.content?.parts?.map(function (***{ return p.text; }).join('') || ***

    if (!text) throw new Error***emini 沒有回應');

    var parsed = ***ustParseJSON(text);

    if (!pa***d) {
      log('解析失敗，原始回應:', tex***lice(0, 200));
      throw new E***r('無法解析 Gemini 回應');***  }

    return parsed;
  }

  a***c function lookupWord(word) {

 ***var keys;
    if (typeof window.***GeminiKeys === 'function') {
   ***keys = window.getGe***iKeys();
    } else {
      var ***gle = localStorage.getItem(GEMIN***EY_STORAGE);
      keys = single***[single] : [];
    ***    if (keys.length === 0) {
   ***throw new Error('請先設定 Gemini API***y');
    }

    var errors = [];***   for (var ki = 0; ki < keys.le***h; ki++) {

      var key = keys***];

      if (typeof window.getG***niKeyStatus === 'function') {
  ***   var statuses = window.getGemi***eyStatus();
        var status =***atuses.find(function (s) { retur***.keyFull === key; });
        if***tatus && !status.available) cont***e;
      }

      for (var mi = ***mi < MODEL_LIST.length; mi++) {
***      var model = MODEL_LIST[mi]***        try {

          log('查詢*** word, '用 key', ki + 1, 'model:'***odel);

          var result = a***t callGemini(word, key, model);
***        if (typeof window.markGe***iKeyOk === 'function') {
       ***  window.markGeminiKeyOk(key);
 ***      }

          return result***        } catch (e) {

         ***rors.push({ ki: ki, model: model***tatus: e.status, msg: e.message ***

          if (e.status === 429***
            if (typeof window.m***GeminiKey429 === 'function') {
 ***          window.markGeminiKey42***ey);
            }
            b***k;
          }

          if (e.***tus === 404) continue;
         *** (e.status >= 500) { await sleep***00); continue; }

          // J*** parse 失敗，換個 model 試
          i***e.message.indexOf('無法解析') !== -1*** e.message.indexOf('parse') !== *** {
            continue;
       ***}

          throw e;
        }
***   }
    }

    throw new Error(*** API Key 都無法使用');
  }

  async f***tion updateWordData(surfaceOrLem*** {

    var db;
    try {
      ***= JSON.parse(localStorage.getIte***notebook_platform_v3') || '{}');***  } catch (e) { return; }

    i***!db.learn) return;

    var lemm*** surfaceOrLemma;
    if (typeof ***dow.lemmatizeWord === 'function'***
      var info = window.lemmati***ord(surfaceOrLemma);
      lemma***info.lemma || surfaceOrLemma;
  ***

    var x = db.learn[lemma] ||***.learn[surfaceOrLemma];
    if (*** return;

    var hasTw = x.tw &***String(x.tw).includes('未建') && !***ing(x.tw).includes('查詢中');
    i***hasTw && x.example && x.synonyms*** x.pos) {
      log('已完整，跳過:', l***a);
      return;
    }

    if ***loading) return;

    x.lo***ng = true;
    x.updatedAt = Dat***ow();
    localStorage.setItem('***ebook_platform_v3', JSON.stringi***db));

    try {

      var resu***= await lookup***d(lemma);

      var db2 = JSON.***se(localStorage.getItem('noteboo***latform_v3'));
      if (db2.lea***lemma]) {

        if***esult.tw) db2.learn[lemma].tw = ***ult.tw;
        if (result.pos) ***.learn[lemma].pos = result.pos;
***     if (result.definition) db2.***r***emma].tip = result.definition;
 ***    if (result.example) db2.lear***emma].example = result.example;
***     if (result.synonyms) db2.le***[lemma].synonyms =***sult.synonyms;

        db2.lear***emma].loading = false;
        d***learn[lemma].source = 'Gemini';
***     db2.learn[lemma].updatedAt ****te.now();

        localStorage.***Item('notebook_platform_v3', JSO***tringify(db2));

        log('已更***, lemma, '→', result.tw);

     ******(typeof window.showWord === 'fun***on') {
          try { window.sh***ord(lemma); } catch (e) {}
     ***}
        if (typeof window.rend***apture === 'function') {
       ***try { window.renderCapture(); } ***ch (e) {}
        }
      }

   ***catch (e) {

      log('查詢失敗:', ***ma, e.message);

      var db3 =***ON.parse(localStorage.getItem('n***book_platform_v3'));
      if (d***learn[lemma]) {
        db3.lear***emma].loading = false;
        l***lStorage.setItem('notebook_platf***_v3', JSON.stringify(db3));
    ***
    }
  }

  var origClickWord ***indow.clickWord;

  if (typ*** origClickWord === 'function') {***   window.clickWord = function (***face) {

      var result = orig***ckWord.call(this, surface);

   ***setTimeout(function () {
       ***dateWord***a(surface);
      }, 200);

    ***eturn result;
    };

    log('c***kWord hooked');
  }

  window.lo***pWordWithGemini = upd***WordData;

  window.batchLookupW***Gemini = async function (limit) ***    var db = JSON.parse(localSto***e.getItem('notebook_platform_v3'***| '{}');
    var needCheck = [];***   Object.values(db.learn || {})***rEach(function (word) {
      va***asTw = word.tw && !String(word.t***includes('未建') && !String(word.t***includes('查詢中');
      if (word.***tured && !word.known && (!hasTw ***!word.example || !word.synonyms)***
        needCheck.push(word.lem***|| word.word);
      }
    });

*** if (limit) needCheck = needChec***lice(0, limit);

    console.log***要查詢的單字:', needCheck.length);

  ***ar success = 0;
    var failed =***

    for (var i = 0; i < needCh***.length; i++) {
      console.lo***i + 1) + '/' + needCheck.length *** - 查詢:', needCheck[i]);
      tr***
        await updateWordData(ne***heck[i]);
        success++;
   ***} catch (e***
        failed++;
      }
     ***ait sleep(1500);
    }

    cons***.log('全部完成！成功:', success, '失敗:',***iled);
  ***
  log('ready v20260712-2');
  l***'全域函式:');
  log('  lookupWordWit***m***("word") - 查詢單字');
  log('  batc***okupWithGemini(10) - 批次查詢前 10 個***字');

})();
