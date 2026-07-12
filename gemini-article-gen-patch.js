/* gemini-article-gen-patch.js v2
   用 Gemini 3.5 Flash 生成個人化英文文章
*/
(function () {

  'use strict';

  var API_KEY_STORAGE = 'gemini_api_key';
  var MODEL = 'gemini-3.5-flash';  // ← 改成 3.5-flash

  function getKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  }

  async function generateArticle(prompt) {

    var key = getKey();
    if (!key) {
      var input = window.prompt('請貼上 Gemini API Key（AIza... 開頭）');
      if (!input) return null;
      localStorage.setItem(API_KEY_STORAGE, input.trim());
      key = input.trim();
    }

    var res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL +
      ':generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1000
          }
        })
      }
    );

    if (!res.ok) {
      var errText = await res.text();
      alert('Gemini 失敗 ' + res.status + ':\n' + errText.substring(0, 200));
      return null;
    }

    var data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  function getWeakWords(n) {
    try {
      var db = JSON.parse(localStorage.getItem('notebook_platform_v3') || '{}');
      var learn = db.learn || {};
      var arr = Object.values(learn)
        .filter(function (w) {
          return w.lastReviewedAt === 0 || (w.correctRate || 0) < 0.7;
        })
        .slice(0, n || 10);
      return arr.map(function (w) { return w.lemma || w.word; });
    } catch (e) { return []; }
  }

  window.geminiGenerate = async function (topic) {
    var words = getWeakWords(10);
    var wordList = words.length ? words.join(', ') : 'travel, culture, technology';

    var prompt =
      'Write a short English article (200 words) about "' + (topic || 'daily life') + '".\n' +
      'MUST use these vocabulary words naturally: ' + wordList + '.\n' +
      'Level: B1-B2. Split into 3 paragraphs.';

    console.log('[Gemini] prompt:', prompt);
    var text = await generateArticle(prompt);
    console.log('[Gemini] result:\n\n' + text);
    return text;
  };

  window.geminiResetKey = function () {
    localStorage.removeItem(API_KEY_STORAGE);
    console.log('[Gemini] Key 已清除');
  };

  console.log('[Gemini] ready v2 (' + MODEL + ')');
  console.log('  用法: await geminiGenerate("your topic")');
  console.log('  重設: geminiResetKey()');

})();
