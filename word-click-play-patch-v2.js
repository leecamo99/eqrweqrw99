/* word-click-play-patch-v2.js v20260710-2
   Click a word in article → play by POS rules.
   - Verb: full family (base, 3rd, -ing, past, past participle)
   - Noun: singular + plural
   - Adjective / Adverb: only the clicked word, no expansion
   - Others: only the clicked word
   - Uses Google Cloud TTS Chirp3 HD
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

  // ---------- 不規則動詞 [base, 3rd, past, pastParticiple, ing] ----------
  const IRREGULAR = {
    'be':       ['be', 'is', 'was', 'been', 'being'],
    'have':     ['have', 'has', 'had', 'had', 'having'],
    'do':       ['do', 'does', 'did', 'done', 'doing'],
    'go':       ['go', 'goes', 'went', 'gone', 'going'],
    'make':     ['make', 'makes', 'made', 'made', 'making'],
    'take':     ['take', 'takes', 'took', 'taken', 'taking'],
    'come':     ['come', 'comes', 'came', 'come', 'coming'],
    'see':      ['see', 'sees', 'saw', 'seen', 'seeing'],
    'get':      ['get', 'gets', 'got', 'gotten', 'getting'],
    'give':     ['give', 'gives', 'gave', 'given', 'giving'],
    'find':     ['find', 'finds', 'found', 'found', 'finding'],
    'think':    ['think', 'thinks', 'thought', 'thought', 'thinking'],
    'know':     ['know', 'knows', 'knew', 'known', 'knowing'],
    'run':      ['run', 'runs', 'ran', 'run', 'running'],
    'write':    ['write', 'writes', 'wrote', 'written', 'writing'],
    'read':     ['read', 'reads', 'read', 'read', 'reading'],
    'eat':      ['eat', 'eats', 'ate', 'eaten', 'eating'],
    'drink':    ['drink', 'drinks', 'drank', 'drunk', 'drinking'],
    'sleep':    ['sleep', 'sleeps', 'slept', 'slept', 'sleeping'],
    'buy':      ['buy', 'buys', 'bought', 'bought', 'buying'],
    'bring':    ['bring', 'brings', 'brought', 'brought', 'bringing'],
    'catch':    ['catch', 'catches', 'caught', 'caught', 'catching'],
    'teach':    ['teach', 'teaches', 'taught', 'taught', 'teaching'],
    'send':     ['send', 'sends', 'sent', 'sent', 'sending'],
    'begin':    ['begin', 'begins', 'began', 'begun', 'beginning'],
    'break':    ['break', 'breaks', 'broke', 'broken', 'breaking'],
    'choose':   ['choose', 'chooses', 'chose', 'chosen', 'choosing'],
    'drive':    ['drive', 'drives', 'drove', 'driven', 'driving'],
    'fall':     ['fall', 'falls', 'fell', 'fallen', 'falling'],
    'feel':     ['feel', 'feels', 'felt', 'felt', 'feeling'],
    'fly':      ['fly', 'flies', 'flew', 'flown', 'flying'],
    'forget':   ['forget', 'forgets', 'forgot', 'forgotten', 'forgetting'],
    'hold':     ['hold', 'holds', 'held', 'held', 'holding'],
    'keep':     ['keep', 'keeps', 'kept', 'kept', 'keeping'],
    'leave':    ['leave', 'leaves', 'left', 'left', 'leaving'],
    'lose':     ['lose', 'loses', 'lost', 'lost', 'losing'],
    'mean':     ['mean', 'means', 'meant', 'meant', 'meaning'],
    'meet':     ['meet', 'meets', 'met', 'met', 'meeting'],
    'pay':      ['pay', 'pays', 'paid', 'paid', 'paying'],
    'say':      ['say', 'says', 'said', 'said', 'saying'],
    'sell':     ['sell', 'sells', 'sold', 'sold', 'selling'],
    'sit':      ['sit', 'sits', 'sat', 'sat', 'sitting'],
    'stand':    ['stand', 'stands', 'stood', 'stood', 'standing'],
    'swim':     ['swim', 'swims', 'swam', 'swum', 'swimming'],
    'tell':     ['tell', 'tells', 'told', 'told', 'telling'],
    'understand': ['understand', 'understands', 'understood', 'understood', 'understanding'],
    'win':      ['win', 'wins', 'won', 'won', 'winning'],
    'grow':     ['grow', 'grows', 'grew', 'grown', 'growing'],
    'speak':    ['speak', 'speaks', 'spoke', 'spoken', 'speaking'],
    'wear':     ['wear', 'wears', 'wore', 'worn', 'wearing'],
    'sing':     ['sing', 'sings', 'sang', 'sung', 'singing'],
    'ride':     ['ride', 'rides', 'rode', 'ridden', 'riding'],
    'rise':     ['rise', 'rises', 'rose', 'risen', 'rising'],
    'put':      ['put', 'puts', 'put', 'put', 'putting']
  };

  // ---------- 動詞五態產生 ----------
  function verbForms(lemma) {

    lemma = String(lemma || '').toLowerCase().trim();
    if (!lemma) return [];

    if (IRREGULAR[lemma]) {
      return IRREGULAR[lemma].slice();
    }

    // Regular verb: base, 3rd, past, pastParticiple, ing
    const base = lemma;

    // 3rd person singular
    let third = base + 's';
    if (/(s|x|z|ch|sh)$/.test(base)) third = base + 'es';
    else if (/[^aeiou]y$/.test(base)) third = base.slice(0, -1) + 'ies';

    // -ing
    let ing = base + 'ing';
    if (base.endsWith('e') && !base.endsWith('ee'))
      ing = base.slice(0, -1) + 'ing';
    else if (/[^aeiou][aeiou][^aeiouwyx]$/.test(base))
      ing = base + base.slice(-1) + 'ing';

    // past / past participle (regular = same)
    let past = base + 'ed';
    if (base.endsWith('e')) past = base + 'd';
    else if (/[^aeiou]y$/.test(base)) past = base.slice(0, -1) + 'ied';
    else if (/[^aeiou][aeiou][^aeiouwyx]$/.test(base))
      past = base + base.slice(-1) + 'ed';

    const pastPart = past;

    return [base, third, past, pastPart, ing];
  }

  // ---------- 名詞複數 ----------
  function nounForms(lemma) {

    lemma = String(lemma || '').toLowerCase().trim();
    if (!lemma) return [];

    let plural = lemma + 's';

    if (/(s|x|z|ch|sh)$/.test(lemma))
      plural = lemma + 'es';
    else if (/[^aeiou]y$/.test(lemma))
      plural = lemma.slice(0, -1) + 'ies';
    else if (lemma.endsWith('fe'))
      plural = lemma.slice(0, -2) + 'ves';
    else if (lemma.endsWith('f'))
      plural = lemma.slice(0, -1) + 'ves';

    return [lemma, plural];
  }

  // ---------- 判斷詞性 ----------
  function detectPOS(clickedWord) {

    let pos = '';
    let lemma = clickedWord;
    let variants = {};

    try {
      if (typeof debugLearn === 'function') {
        const item = debugLearn(clickedWord);
        if (item) {
          pos = String(item.pos || item.partOfSpeech || '').toLowerCase();
          lemma = item.lemma || item.word || clickedWord;
          variants = item.variants || {};
        }
      }
    } catch (e) {}

    return { pos, lemma, variants };
  }

  // ---------- 建立要唸的清單 ----------
  function buildToSpeak(inputWord) {

    const { pos, lemma } = detectPOS(inputWord);

    const list = [];
    const seen = new Set();
    const add = (w) => {
      w = String(w || '').trim();
      if (!w) return;
      const k = w.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      list.push(w);
    };

    if (/verb|v\./.test(pos)) {
      verbForms(lemma).forEach(add);
    } else if (/noun|n\./.test(pos)) {
      nounForms(lemma).forEach(add);
    } else {
      // 形容詞、副詞、其他：只唸點到的字
      add(inputWord);
    }

    return list;
  }

  // ---------- Google Cloud TTS ----------
  async function synthesizeGoogle(word) {

    const key = localStorage.getItem(KEY_LS) || '';
    if (!key) throw new Error('No API Key');

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

  function playBlob(blob, sid) {

    return new Promise((resolve, reject) => {

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        if (sid !== currentSession) return reject('canceled');
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

  async function speakOne(word, sid) {

    if (sid !== currentSession) return;

    if (cache.has(word)) {
      try {
        await playBlob(cache.get(word), sid);
        return;
      } catch (e) {}
    }

    try {
      const blob = await synthesizeGoogle(word);
      cache.set(word, blob);
      await playBlob(blob, sid);
    } catch (e) {
      console.warn('[WordClickPlay] fail:', word, e);
    }
  }

  async function speakSmart(inputWord) {

    inputWord = String(inputWord || '').trim();
    if (!inputWord) return;

    stopAll();
    currentSession++;
    const sid = currentSession;

    const list = buildToSpeak(inputWord);

    console.log('[WordClickPlay]', inputWord, '→', list);

    for (const w of list) {
      if (sid !== currentSession) break;
      await speakOne(w, sid);
      await delay(280);
    }
  }

  // ---------- 綁定文章單字點擊 ----------
  document.addEventListener('click', (e) => {

    const target = e.target;
    if (!target) return;

    if (target.closest('button, input, textarea, select, a')) return;
    if (target.closest('#dockBody, #sidebar, #dock, .word-note')) return;

    let word = '';

    const span = target.closest('span.word, span.token, em, b');
    if (span) word = span.textContent;

    if (!word && window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) word = sel.toString().trim();
    }

    if (!word) {

      let range = null;

      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if (document.caretPositionFromPoint) {
        const p = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (p) {
          range = document.createRange();
          range.setStart(p.offsetNode, p.offset);
          range.setEnd(p.offsetNode, p.offset);
        }
      }

      if (range) {
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          const pos = range.startOffset;
          let s = pos, en = pos;
          while (s > 0 && /[A-Za-z'-]/.test(text[s - 1])) s--;
          while (en < text.length && /[A-Za-z'-]/.test(text[en])) en++;
          word = text.slice(s, en);
        }
      }
    }

    word = String(word || '').trim();
    if (!word || !/^[A-Za-z'-]+$/.test(word)) return;

    speakSmart(word);

  }, true);

  console.log('[WordClickPlay v2] ready');

})();
