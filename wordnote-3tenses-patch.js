/* wordnote-3tenses-patch.js v20260710-1
   Add a 3-tenses row to WORD NOTE: past / past participle / -ing.
   Click the row → play them in sequence via __speakOneWord__.
*/

(function () {

  'use strict';

  const IRREGULAR = {
    'be':       ['was', 'been', 'being'],
    'have':     ['had', 'had', 'having'],
    'do':       ['did', 'done', 'doing'],
    'go':       ['went', 'gone', 'going'],
    'make':     ['made', 'made', 'making'],
    'take':     ['took', 'taken', 'taking'],
    'come':     ['came', 'come', 'coming'],
    'see':      ['saw', 'seen', 'seeing'],
    'get':      ['got', 'gotten', 'getting'],
    'give':     ['gave', 'given', 'giving'],
    'find':     ['found', 'found', 'finding'],
    'think':    ['thought', 'thought', 'thinking'],
    'know':     ['knew', 'known', 'knowing'],
    'run':      ['ran', 'run', 'running'],
    'write':    ['wrote', 'written', 'writing'],
    'read':     ['read', 'read', 'reading'],
    'eat':      ['ate', 'eaten', 'eating'],
    'drink':    ['drank', 'drunk', 'drinking'],
    'sleep':    ['slept', 'slept', 'sleeping'],
    'buy':      ['bought', 'bought', 'buying'],
    'bring':    ['brought', 'brought', 'bringing'],
    'catch':    ['caught', 'caught', 'catching'],
    'teach':    ['taught', 'taught', 'teaching'],
    'send':     ['sent', 'sent', 'sending'],
    'begin':    ['began', 'begun', 'beginning'],
    'break':    ['broke', 'broken', 'breaking'],
    'choose':   ['chose', 'chosen', 'choosing'],
    'drive':    ['drove', 'driven', 'driving'],
    'fall':     ['fell', 'fallen', 'falling'],
    'feel':     ['felt', 'felt', 'feeling'],
    'fly':      ['flew', 'flown', 'flying'],
    'forget':   ['forgot', 'forgotten', 'forgetting'],
    'hold':     ['held', 'held', 'holding'],
    'keep':     ['kept', 'kept', 'keeping'],
    'leave':    ['left', 'left', 'leaving'],
    'lose':     ['lost', 'lost', 'losing'],
    'mean':     ['meant', 'meant', 'meaning'],
    'meet':     ['met', 'met', 'meeting'],
    'pay':      ['paid', 'paid', 'paying'],
    'say':      ['said', 'said', 'saying'],
    'sell':     ['sold', 'sold', 'selling'],
    'sit':      ['sat', 'sat', 'sitting'],
    'stand':    ['stood', 'stood', 'standing'],
    'swim':     ['swam', 'swum', 'swimming'],
    'tell':     ['told', 'told', 'telling'],
    'understand': ['understood', 'understood', 'understanding'],
    'win':      ['won', 'won', 'winning'],
    'grow':     ['grew', 'grown', 'growing'],
    'speak':    ['spoke', 'spoken', 'speaking'],
    'wear':     ['wore', 'worn', 'wearing'],
    'sing':     ['sang', 'sung', 'singing'],
    'ride':     ['rode', 'ridden', 'riding'],
    'rise':     ['rose', 'risen', 'rising'],
    'put':      ['put', 'put', 'putting']
  };

  function ruleForms(base) {

    base = base.toLowerCase();

    // -ing
    let ing = base + 'ing';
    if (base.endsWith('e') && !base.endsWith('ee'))
      ing = base.slice(0, -1) + 'ing';
    else if (/[^aeiou][aeiou][^aeiouwyx]$/.test(base))
      ing = base + base.slice(-1) + 'ing';

    // -ed（過去式 = 過去分詞）
    let past = base + 'ed';
    if (base.endsWith('e')) past = base + 'd';
    else if (/[^aeiou]y$/.test(base)) past = base.slice(0, -1) + 'ied';
    else if (/[^aeiou][aeiou][^aeiouwyx]$/.test(base))
      past = base + base.slice(-1) + 'ed';

    return [past, past, ing];
  }

  function threeTenses(lemma) {

    lemma = String(lemma || '').toLowerCase().trim();

    if (!lemma) return null;

    if (IRREGULAR[lemma]) return IRREGULAR[lemma].slice();

    // 只在看起來像動詞的字才給
    if (/(ate|ify|ize|ise)$/.test(lemma)) return ruleForms(lemma);

    // 保守：不確定就不顯示（避免 spontaneous 也產生三態）
    return null;
  }

  function speakSequence(words) {

    if (!Array.isArray(words) || !words.length) return;

    const speak = window.__speakOneWord__;

    if (typeof speak !== 'function') {
      console.warn('[3Tenses] __speakOneWord__ not ready');
      return;
    }

    (async () => {

      for (const w of words) {

        try {
          await speak(w);
          await new Promise(r => setTimeout(r, 260));
        } catch (e) {
          console.warn('[3Tenses] speak fail', w, e);
        }
      }

    })();
  }

  function enhance() {

    const dock = document.getElementById('dockBody');
    if (!dock) return;

    const wordEl = dock.querySelector('.wordbig, h1');
    if (!wordEl) return;

    const surface = String(wordEl.textContent || '').trim();
    if (!surface) return;

    // 只在同一字內處理一次
    if (dock.dataset.tensesFor === surface) return;

    // 若之前建過，先移除
    const old = dock.querySelector('#wordNoteVerbBox');
    if (old) old.remove();

    // 找 lemma
    let lemma = surface;

    try {
      if (typeof debugLearn === 'function') {
        const item = debugLearn(surface);
        if (item) {
          lemma = item.lemma || item.word || surface;
        }
      }
    } catch (e) {}

    const forms = threeTenses(lemma);

    dock.dataset.tensesFor = surface;

    if (!forms) return;

    const [past, pastPart, ing] = forms;

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
        三態（點此區連續發音）
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <span>過去式：<b>${past}</b></span>
        <span>過去分詞：<b>${pastPart}</b></span>
        <span>-ing：<b>${ing}</b></span>
      </div>
    `;

    box.onclick = () => {
      speakSequence([past, pastPart, ing]);
    };

    dock.appendChild(box);
  }

  // 監聽 dock 更新
  const obs = new MutationObserver(() => enhance());
  obs.observe(document.body, { childList: true, subtree: true });

  console.log('[WordNote3Tenses] ready');

})();
