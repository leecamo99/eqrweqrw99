/* word-click-play-patch.js v20260710-1
   Click any word in article → auto play family (verb tenses, noun plural, etc.)
   - Uses Google Cloud TTS Chirp3 HD
   - Detects POS (verb/noun/adj) from db.learn if available
   - Cached per surface form
   - Cancels previous playback automatically
*/

(function () {

  'use strict';

  const KEY_LS = 'notebook_google_cloud_tts_key_v1';
  const SET_LS = 'notebook_google_cloud_tts_settings_v1';

  const cache = new Map();

  let currentAudio = null;
  let currentSession = 0;

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SET_LS) || '{}');
    } catch (e) {
      return {};
    }
  }

  function stopAll() {

    try {
      window.speechSynthesis?.cancel();
    } catch (e) {}

    if (currentAudio) {

      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (e) {}

      currentAudio = null;
    }
  }

  // ---- 不規則變化字典（動詞） ----
  const IRREGULAR = {
    'be':       ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
    'have':     ['has', 'had', 'having'],
    'do':       ['does', 'did', 'done', 'doing'],
    'go':       ['goes', 'went', 'gone', 'going'],
    'make':     ['makes', 'made', 'making'],
    'take':     ['takes', 'took', 'taken', 'taking'],
    'come':     ['comes', 'came', 'come', 'coming'],
    'see':      ['sees', 'saw', 'seen', 'seeing'],
    'get':      ['gets', 'got', 'gotten', 'getting'],
    'give':     ['gives', 'gave', 'given', 'giving'],
    'find':     ['finds', 'found', 'finding'],
    'think':    ['thinks', 'thought', 'thinking'],
    'know':     ['knows', 'knew', 'known', 'knowing'],
    'run':      ['runs', 'ran', 'running'],
    'write':    ['writes', 'wrote', 'written', 'writing'],
    'read':     ['reads', 'read', 'reading'],
    'eat':      ['eats', 'ate', 'eaten', 'eating'],
    'drink':    ['drinks', 'drank', 'drunk', 'drinking'],
    'sleep':    ['sleeps', 'slept', 'sleeping'],
    'buy':      ['buys', 'bought', 'buying'],
    'bring':    ['brings', 'brought', 'bringing'],
    'catch':    ['catches', 'caught', 'catching'],
    'teach':    ['teaches', 'taught', 'teaching'],
    'send':     ['sends', 'sent', 'sending'],
    'begin':    ['begins', 'began', 'begun', 'beginning'],
    'break':    ['breaks', 'broke', 'broken', 'breaking'],
    'choose':   ['chooses', 'chose', 'chosen', 'choosing'],
    'drive':    ['drives', 'drove', 'driven', 'driving'],
    'fall':     ['falls', 'fell', 'fallen', 'falling'],
    'feel':     ['feels', 'felt', 'feeling'],
    'fly':      ['flies', 'flew', 'flown', 'flying'],
    'forget':   ['forgets', 'forgot', 'forgotten', 'forgetting'],
    'hold':     ['holds', 'held', 'holding'],
    'keep':     ['keeps', 'kept', 'keeping'],
    'leave':    ['leaves', 'left', 'leaving'],
    'lose':     ['loses', 'lost', 'losing'],
    'mean':     ['means', 'meant', 'meaning'],
    'meet':     ['meets', 'met', 'meeting'],
    'pay':      ['pays', 'paid', 'paying'],
    'put':      ['puts', 'putting'],
    'say':      ['says', 'said', 'saying'],
    'sell':     ['sells', 'sold', 'selling'],
    'sit':      ['sits', 'sat', 'sitting'],
    'stand':    ['stands', 'stood', 'standing'],
    'swim':     ['swims', 'swam', 'swum', 'swimming'],
    'tell':     ['tells', 'told', 'telling'],
    'understand': ['understands', 'understood', 'understanding'],
    'win':      ['wins', 'won', 'winning'],
    'grow':     ['grows', 'grew', 'grown', 'growing'],
    'speak':    ['speaks', 'spoke', 'spoken', 'speaking'],
    'wear':     ['wears', 'wore', 'worn', 'wearing'],
    'sing':     ['sings', 'sang', 'sung', 'singing'],
    'ride':     ['rides', 'rode', 'ridden', 'riding'],
    'rise':     ['rises', 'rose', 'risen', 'rising']
  };

  // ---- 動詞三態 ----
  function verbForms(word) {

    word = String(word || '').toLowerCase().trim();

    if (!word) return [];

    if (IRREGULAR[word]) return IRREGULAR[word].slice();

    const out = [];

    // -s
    let s = word + 's';
    if (/(s|x|z|ch|sh)$/.test(word)) s = word + 'es';
    else if (/[^aeiou]y$/.test(word)) s = word.slice(0, -1) + 'ies';
    out.push(s);

    // -ing
    let ing = word + 'ing';
    if (word.endsWith('e') && !word.endsWith('ee'))
      ing = word.slice(0, -1) + 'ing';
    else if (/[^aeiou][aeiou][^aeiouwyx]$/.test(word))
      ing = word + word.slice(-1) + 'ing';
    out.push(ing);

    // -ed
    let ed = word + 'ed';
    if (word.endsWith('e')) ed = word + 'd';
    else if (/[^aeiou]y$/.test(word)) ed = word.slice(0, -1) + 'ied';
    else if (/[^aeiou][aeiou][^aeiouwyx]$/.test(word))
      ed = word + word.slice(-1) + 'ed';
    out.push(ed);

    return out;
  }

  // ---- 名詞複數 ----
  function nounPlural(word) {

    word = String(word || '').toLowerCase().trim();

    if (!word) return [];

    let plural = word + 's';

    if (/(s|x|z|ch|sh)$/.test(word)) plural = word + 'es';

    else if (/[^aeiou]y$/.test(word))
      plural = word.slice(0, -1) + 'ies';

    else if (word.endsWith('fe'))
      plural = word.slice(0, -2) + 'ves';

    else if (word.endsWith('f'))
      plural = word.slice(0, -1) + 'ves';

    return [plural];
  }

  // ---- 形容詞副詞 ----
  function adjAdverb(word) {

    word = String(word || '').toLowerCase().trim();

    if (!word) return [];

    let adv;

    if (word.endsWith('y')) adv = word.slice(0, -1) + 'ily';
    else if (word.endsWith('le')) adv = word.slice(0, -1) + 'y';
    else if (word.endsWith('ic')) adv = word + 'ally';
    else adv = word + 'ly';

    return [adv];
  }

  // ---- 建立家族 ----
  function buildFamily(inputWord) {

    let lastSurface = '';
    let lemma = inputWord;
    let pos = '';
    let variants = {};

    try {

      if (typeof debugLearn === 'function') {

        const item = debugLearn(inputWord);

        if (item) {
          lastSurface = item.lastSurface || '';
          lemma = item.lemma || item.word || inputWord;
          pos = String(item.pos || item.partOfSpeech || '').toLowerCase();
          variants = item.variants || {};
        }
      }

    } catch (e) {}

    const list = [];
    const seen = new Set();

    function add(w) {
      w = String(w || '').trim();
      if (!w) return;
      const k = w.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      list.push(w);
    }

    if (lastSurface) add(lastSurface);
    Object.keys(variants).forEach(add);
    add(lemma);

    // 根據詞性加變化
    if (/verb|v\./.test(pos)) {
      verbForms(lemma).forEach(add);
    } else if (/noun|n\./.test(pos)) {
      nounPlural(lemma).forEach(add);
    } else if (/adj|adjective/.test(pos)) {
      adjAdverb(lemma).forEach(add);
    }
    // 未知詞性：只唸 lastSurface + lemma

    return list;
  }

  // ---- Google Cloud TTS ----
  async function synthesizeGoogle(word) {

    const key = localStorage.getItem(KEY_LS) || '';
    if (!key) throw new Error('No Google Cloud TTS API Key');

    const s = loadSettings();
    const voiceName = s.voice || 'en-US-Chirp3-HD-Aoede';
    const languageCode = voiceName.split('-').slice(0, 2).join('-') || 'en-US';

    const body = {
      input: { text: word },
      voice: { languageCode, name: voiceName },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: Number(s.rate || 0.92)
      }
    };

    const res = await fetch(
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=' +
        encodeURIComponent(key),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    const raw = await res.text();

    if (!res.ok) throw new Error(raw.slice(0, 160));

    const data = JSON.parse(raw);

    if (!data.audioContent) throw new Error('No audioContent');

    const bin = atob(data.audioContent);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'audio/mpeg' });
  }

  function playBlob(blob, sessionId) {

    return new Promise((resolve, reject) => {

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        if (sessionId !== currentSession) return reject('canceled');
        resolve();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        reject('audio error');
      };

      audio.play().catch(reject);
    });
  }

  const delay = ms => new Promise(r => setTimeout(r, ms));

  async function speakOne(word, sessionId) {

    if (sessionId !== currentSession) return;

    if (cache.has(word)) {
      try {
        await playBlob(cache.get(word), sessionId);
        return;
      } catch (e) {}
    }

    try {
      const blob = await synthesizeGoogle(word);
      cache.set(word, blob);
      await playBlob(blob, sessionId);
    } catch (e) {
      console.warn('[WordClickPlay] fail:', word, e);
    }
  }

  async function speakFamily(inputWord) {

    inputWord = String(inputWord || '').trim();
    if (!inputWord) return;

    stopAll();
    currentSession++;

    const sessionId = currentSession;
    const family = buildFamily(inputWord);

    console.log('[WordClickPlay]', inputWord, '→', family);

    for (const w of family) {
      if (sessionId !== currentSession) break;
      await speakOne(w, sessionId);
      await delay(280);
    }
  }

  // ---- 綁定文章單字點擊 ----
  // 假設文章單字有 .word class 或在 .article/.content 內
  // 這裡用最保險：任何 span/em/b 內的字都能被點

  document.addEventListener('click', (e) => {

    const target = e.target;
    if (!target) return;

    // 避免點按鈕、輸入框
    if (target.closest('button, input, textarea, select, a')) return;

    // 避免點 WORD NOTE 或側欄
    if (target.closest('#dockBody, #sidebar, #dock, .word-note')) return;

    // 取出被點的字（用選取範圍或最近的 span）
    let word = '';

    // 方案 A：如果點在 <span class="word"> 上
    const span = target.closest('span.word, span.token, em, b');
    if (span) word = span.textContent;

    // 方案 B：如果沒有，就用滑鼠位置取字
    if (!word && window.getSelection) {

      const sel = window.getSelection();
      if (sel && sel.toString().trim()) {
        word = sel.toString().trim();
      }
    }

    // 方案 C：如果都沒有，用最土的方式：取點擊點附近的英文字
    if (!word) {

      const range = document.caretRangeFromPoint?.(e.clientX, e.clientY)
        || (document.caretPositionFromPoint?.(e.clientX, e.clientY)
              ? (() => {
                  const p = document.caretPositionFromPoint(e.clientX, e.clientY);
                  const r = document.createRange();
                  r.setStart(p.offsetNode, p.offset);
                  r.setEnd(p.offsetNode, p.offset);
                  return r;
                })()
              : null);

      if (range) {
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          const pos = range.startOffset;

          // 向左向右擴充到單字邊界
          let start = pos, end = pos;
          while (start > 0 && /[A-Za-z'-]/.test(text[start - 1])) start--;
          while (end < text.length && /[A-Za-z'-]/.test(text[end])) end++;
          word = text.slice(start, end);
        }
      }
    }

    word = String(word || '').trim();

    if (!word || !/^[A-Za-z'-]+$/.test(word)) return;

    console.log('[WordClickPlay] click →', word);

    speakFamily(word);

  }, true);

  console.log('[WordClickPlay] ready');

})();
