/* wordnote-verb-info-patch.js v20260710-1
   Improves WORD NOTE display for verbs.
   - Correct POS if verb is misclassified
   - Add full tense table (base / 3rd / past / past participle / -ing)
   - Add active/passive hints
*/

(function () {

  'use strict';

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

  function looksLikeVerb(lemma) {

    lemma = String(lemma || '').toLowerCase().trim();
    if (!lemma) return false;

    if (IRREGULAR[lemma]) return true;

    // 常見動詞結尾（heuristic）
    if (/(ate|ify|ize|ise)$/.test(lemma)) return true;

    // 短且能接 ing 的多半是動詞
    // 這裡採保守：交給 db.learn 的 lastForm 是否是 -ed / -ing 判斷
    return false;
  }

  function verbForms(lemma) {

    lemma = String(lemma || '').toLowerCase().trim();

    if (IRREGULAR[lemma]) return IRREGULAR[lemma].slice();

    const base = lemma;

    let third = base + 's';
    if (/(s|x|z|ch|sh)$/.test(base)) third = base + 'es';
    else if (/[^aeiou]y$/.test(base)) third = base.slice(0, -1) + 'ies';

    let ing = base + 'ing';
    if (base.endsWith('e') && !base.endsWith('ee'))
      ing = base.slice(0, -1) + 'ing';
    else if (/[^aeiou][aeiou][^aeiouwyx]$/.test(base))
      ing = base + base.slice(-1) + 'ing';

    let past = base + 'ed';
    if (base.endsWith('e')) past = base + 'd';
    else if (/[^aeiou]y$/.test(base)) past = base.slice(0, -1) + 'ied';
    else if (/[^aeiou][aeiou][^aeiouwyx]$/.test(base))
      past = base + base.slice(-1) + 'ed';

    return [base, third, past, past, ing];
  }

  function passiveOf(pastPart) {
    return 'be ' + pastPart;
  }

  function enhance() {

    const dock = document.getElementById('dockBody');
    if (!dock) return;
    if (dock.dataset.verbEnhanced === '1') return;

    const wordEl = dock.querySelector('.wordbig, h1');
    if (!wordEl) return;

    const surface = String(wordEl.textContent || '').trim();
    if (!surface) return;

    // 找 lemma
    let lemma = surface;
    let existingPos = '';

    try {
      if (typeof debugLearn === 'function') {
        const item = debugLearn(surface);
        if (item) {
          lemma = item.lemma || item.word || surface;
          existingPos = String(item.pos || '').toLowerCase();
        }
      }
    } catch (e) {}

    // 判斷是否為動詞
    // 條件：IRREGULAR 有 / heuristic / 或當前 surface 是 -ing/-ed
    const surfaceLike =
      /(ing|ed|es|s)$/.test(surface.toLowerCase()) &&
      surface.toLowerCase() !== lemma;

    const isVerb = looksLikeVerb(lemma) || surfaceLike;

    if (!isVerb) {
      dock.dataset.verbEnhanced = '1';
      return;
    }

    const forms = verbForms(lemma);

    if (!forms.length) {
      dock.dataset.verbEnhanced = '1';
      return;
    }

    const [base, third, past, pastPart, ing] = forms;

    // 建立資訊塊
    const box = document.createElement('div');
    box.style.cssText = `
      margin-top:8px;
      padding:8px;
      background:#1f2937;
      color:#f4f4f5;
      border-radius:8px;
      border:1px solid #374151;
      font-size:13px;
    `;

    box.innerHTML = `
      <div style="color:#f4d27a;font-weight:bold;margin-bottom:6px">
        動詞資訊（verb）
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 12px">
        <div style="color:#9ca3af">原形</div><div>${base}</div>
        <div style="color:#9ca3af">第三人稱單數</div><div>${third}</div>
        <div style="color:#9ca3af">過去式</div><div>${past}</div>
        <div style="color:#9ca3af">過去分詞</div><div>${pastPart}</div>
        <div style="color:#9ca3af">現在分詞（-ing）</div><div>${ing}</div>
        <div style="color:#9ca3af">主動</div><div>${base}</div>
        <div style="color:#9ca3af">被動</div><div>${passiveOf(pastPart)}</div>
      </div>
    `;

    dock.appendChild(box);
    dock.dataset.verbEnhanced = '1';
  }

  // 監聽 dockBody 變化：每次新單字都重跑
  const target = document.body;
  const obs = new MutationObserver(() => {

    const dock = document.getElementById('dockBody');
    if (!dock) return;

    // 若 dockBody 內容變了，就重置 flag
    const currentWord =
      dock.querySelector('.wordbig, h1')?.textContent?.trim() || '';

    if (dock.dataset.lastWord !== currentWord) {
      dock.dataset.lastWord = currentWord;
      dock.dataset.verbEnhanced = '';
    }

    enhance();
  });

  obs.observe(target, { childList: true, subtree: true });

  console.log('[WordNoteVerbInfo] ready');

})();
