/* wordnote-3tenses-patch.js v20260710-2
   Show a "3 tenses" box in WORD NOTE:
     base / past / past participle
   Click the box → speak them in sequence via __speakOneWord__.
   -ing is NOT included.
*/

(function () {

  'use strict';

  // 內建不規則動詞：[base, past, past participle]
  const IRREGULAR = {
    'be':       ['be', 'was', 'been'],
    'have':     ['have', 'had', 'had'],
    'do':       ['do', 'did', 'done'],
    'go':       ['go', 'went', 'gone'],
    'make':     ['make', 'made', 'made'],
    'take':     ['take', 'took', 'taken'],
    'come':     ['come', 'came', 'come'],
    'see':      ['see', 'saw', 'seen'],
    'get':      ['get', 'got', 'gotten'],
    'give':     ['give', 'gave', 'given'],
    'find':     ['find', 'found', 'found'],
    'think':    ['think', 'thought', 'thought'],
    'know':     ['know', 'knew', 'known'],
    'run':      ['run', 'ran', 'run'],
    'write':    ['write', 'wrote', 'written'],
    'read':     ['read', 'read', 'read'],
    'eat':      ['eat', 'ate', 'eaten'],
    'drink':    ['drink', 'drank', 'drunk'],
    'sleep':    ['sleep', 'slept', 'slept'],
    'buy':      ['buy', 'bought', 'bought'],
    'bring':    ['bring', 'brought', 'brought'],
    'catch':    ['catch', 'caught', 'caught'],
    'teach':    ['teach', 'taught', 'taught'],
    'send':     ['send', 'sent', 'sent'],
    'begin':    ['begin', 'began', 'begun'],
    'break':    ['break', 'broke', 'broken'],
    'choose':   ['choose', 'chose', 'chosen'],
    'drive':    ['drive', 'drove', 'driven'],
    'fall':     ['fall', 'fell', 'fallen'],
    'feel':     ['feel', 'felt', 'felt'],
    'fly':      ['fly', 'flew', 'flown'],
    'forget':   ['forget', 'forgot', 'forgotten'],
    'hold':     ['hold', 'held', 'held'],
    'keep':     ['keep', 'kept', 'kept'],
    'leave':    ['leave', 'left', 'left'],
    'lose':     ['lose', 'lost', 'lost'],
    'mean':     ['mean', 'meant', 'meant'],
    'meet':     ['meet', 'met', 'met'],
    'pay':      ['pay', 'paid', 'paid'],
    'say':      ['say', 'said', 'said'],
    'sell':     ['sell', 'sold', 'sold'],
    'sit':      ['sit', 'sat', 'sat'],
    'stand':    ['stand', 'stood', 'stood'],
    'swim':     ['swim', 'swam', 'swum'],
    'tell':     ['tell', 'told', 'told'],
    'understand': ['understand', 'understood', 'understood'],
    'win':      ['win', 'won', 'won'],
    'grow':     ['grow', 'grew', 'grown'],
    'speak':    ['speak', 'spoke', 'spoken'],
    'wear':     ['wear', 'wore', 'worn'],
    'sing':     ['sing', 'sang', 'sung'],
    'ride':     ['ride', 'rode', 'ridden'],
    'rise':     ['rise', 'rose', 'risen'],
    'put':      ['put', 'put', 'put']
  };

  // 規則動詞 → base / past / past participle（規則字 past == past participle）
  function ruleForms(base) {

    base = base.toLowerCase();

    let past = base + 'ed';

    if (base.endsWith('e')) past = base + 'd';

    else if (/[^aeiou]y$/.test(base))
      past = base.slice(0, -1) + 'ied';

    else if (/[^aeiou][aeiou][^aeiouwyx]$/.test(base))
      past = base + base.slice(-1) + 'ed';

    return [base, past, past];
  }

  function threeTenses(lemma) {

    lemma = String(lemma || '').toLowerCase().trim();
    if (!lemma) return null;

    if (IRREGULAR[lemma]) return IRREGULAR[lemma].slice();

    // 保守判斷：常見動詞字尾才自動產生
    if (/(ate|ify|ize|ise)$/.test(lemma)) return ruleForms(lemma);

    return null;
  }

  async function speakSequence(words) {

    if (!Array.isArray(words) || !words.length) return;

    const speak = window.__speakOneWord__;

    if (typeof speak !== 'function') {
      console.warn('[3Tenses] __speakOneWord__ not ready');
      return;
    }

    for (const w of words) {

      try {
        await speak(w);
        await new Promise(r => setTimeout(r, 260));
      } catch (e) {
        console.warn('[3Tenses] fail:', w, e);
      }
    }
  }

  function enhance() {

    const dock = document.getElementById('dockBody');
    if (!dock) return;

    const wordEl = dock.querySelector('.wordbig, h1');
    if (!wordEl) return;

    const surface = String(wordEl.textContent || '').trim();
    if (!surface) return;

    if (dock.dataset.tensesFor === surface) return;

    const old = dock.querySelector('#wordNoteVerbBox');
    if (old) old.remove();

    let lemma = surface;

    try {
      if (typeof debugLearn === 'function') {
        const item = debugLearn(surface);
        if (item) lemma = item.lemma || item.word || surface;
      }
    } catch (e) {}

    const forms = threeTenses(lemma);

    dock.dataset.tensesFor = surface;

    if (!forms) return;

    const [base, past, pp] = forms;

    const box = document.createElement('div');
    box.id = 'wordNoteVerbBox';

    box.style.cssText = `
      margin-top:8px;
      padding:8px 10px;
      background:#1f2937;
      color:#f4f4f5;
      border-radius:8px;
      border:1px solid #374151;
      font-size:13px;
      cursor:pointer;
      user-select:none;
    `;

    box.innerHTML = `
      <div style="color:#f4d27a;font-weight:bold;margin-bottom:4px">
        動詞三態（點此區連續發音）
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <span>原形：<b>${base}</b></span>
        <span>過去式：<b>${past}</b></span>
        <span>過去分詞：<b>${pp}</b></span>
      </div>
    `;

    box.onclick = () => {
      speakSequence([base, past, pp]);
    };

    dock.appendChild(box);
  }

  const obs = new MutationObserver(() => enhance());
  obs.observe(document.body, { childList: true, subtree: true });

  console.log('[WordNote3Tenses v2] ready');

})();
