/* article-audio-cloud-cache-patch.js v20260711-1
   Mode C: Auto generate + auto upload to GitHub /audio/
   Added:
     1. Sidebar notebook title shows "✓ 已 Cache"
     2. Cached label is light gray and small
     3. After upload success, badge updates immediately
     4. Existing GitHub audio will be detected by HEAD check
*/

(function () {
  'use strict';
*  const OWNER  = 'leecamo99';
  co*st REPO   = 'eqrweqrw99';
  const *RANCH = 'main';
  const DIR    = '*udio';

  const STORE       = 'not*book_platform_v3';
  const KEY_TTS*LS  = 'notebook_google_cloud_tts_k*y_v1';
  const KEY_SET_LS  = 'note*ook_google_cloud_tts_settings_v1';*  const KEY_GH_TOKEN = 'notebook_g*thub_token_v1';

  const CACHE_IND*X_KEY = 'notebook_article_audio_ca*he_index_v1';

  let currentAudio * null;
  const checkingIds = new S*t();

  function log(...a) {
    c*nsole.log('[ArticleAudioC]', ...a)*
  }

  function esc(s) {
    retu*n String(s || '').replace(/[<>&"']*g, c => ({
      '<': '&lt;',
    * '>': '&gt;',
      '&': '&amp;',
*     '"': '&quot;',
      "'": ''
*   }[c]));
  }

  function getDB()*{
    try {
      const d = JSON.p*rse(localStorage.getItem(STORE) ||*'{}');
      d.notebooks = d.noteb*oks || [];
      d.learn = d.learn*|| {};
      return d;
    } catch*(e) {
      return { notebooks: []* learn: {} };
    }
  }

  functio* getCacheIndex() {
    try {
     *return JSON.parse(localStorage.get*tem(CACHE_INDEX_KEY) || '{}');
   *} catch (e) {
      return {};
   *}
  }

  function saveCacheIndex(x* {
    localStorage.setItem(CACHE_*NDEX_KEY, JSON.stringify(x || {}))*
  }

  function markCached(id, me*a) {
    const idx = getCacheIndex*);

    idx[id] = Object.assign({
*     cached: true,
      id,
     *at: Date.now()
    }, meta || {});*
    saveCacheIndex(idx);
    refr*shCacheBadgesSoon();
  }

  functi*n notebookText(nb) {
    if (!nb) *eturn '';

    return (nb.cards ||*[]).map(c => {
      return [
        c.title || '',
        String(c.text || '').replace(/\{\{|\}\}/g, *')
      ].join('\n');
    }).join*'\n\n').replace(/\s+/g, ' ').trim(*;
  }

  function getCurrentNotebo*k() {
    try {
      if (typeof d* !== 'undefined' && typeof cur !==*'undefined') {
        return db.n*tebooks.find(x => x.id === cur) ||*null;
      }
    } catch (e) {}

*   const d = getDB();
    return d*notebooks && d.notebooks[0] ? d.no*ebooks[0] : null;
  }

  function *etCurrentArticleText() {
    const*nb = getCurrentNotebook();

    co*st textFromNotebook = notebookText*nb);
    if (textFromNotebook) ret*rn textFromNotebook;

    const ar*icle =
      document.getElementBy*d('cardContent') ||
      document*querySelector('.article-body') ||
*     document.querySelector('.card*) ||
      document.body;

    ret*rn String(article?.innerText || ''*.trim();
  }

  async function art*cleId(text) {
    const enc = new *extEncoder().encode(String(text ||*'').slice(0, 400));
    const hash*= await crypto.subtle.digest('SHA-*56', enc);
    const arr = Array.f*om(new Uint8Array(hash));
    cons* hex = arr.map(b => b.toString(16)*padStart(2, '0')).join('');
    re*urn 'a_' + hex.slice(0, 20);
  }

* function rawAudioUrl(id) {
    re*urn `https://raw.githubusercontent*com/${OWNER}/${REPO}/${BRANCH}/${D*R}/${id}.mp3`;
  }

  function api*udioUrl(id) {
    return `https://*pi.github.com/repos/${OWNER}/${REP*}/contents/${DIR}/${id}.mp3`;
  }
*  async function checkGitHubAudio(*d, nbName) {
    if (!id) return n*ll;

    const idx = getCacheIndex*);
    if (idx[id] && idx[id].cach*d) {
      return idx[id].url || r*wAudioUrl(id);
    }

    if (chec*ingIds.has(id)) return null;
    c*eckingIds.add(id);

    const url * rawAudioUrl(id);

    try {
     *const res = await fetch(url, { met*od: 'HEAD', cache: 'no-store' });
*      if (res.ok) {
        markCa*hed(id, {
          url,
         *name: nbName || ''
        });
   *    return url;
      }

      ret*rn null;
    } catch (e) {
      r*turn null;
    } finally {
      c*eckingIds.delete(id);
    }
  }

 *function loadTTSSettings() {
    t*y {
      return JSON.parse(localS*orage.getItem(KEY_SET_LS) || '{}')*
    } catch (e) {
      return {}*
    }
  }

  async function synth*sizeGoogle(text) {
    const key =*localStorage.getItem(KEY_TTS_LS) |* '';
    if (!key) throw new Error*'No TTS API Key');

    const s = *oadTTSSettings();
    const voiceN*me = s.voice || 'en-US-Chirp3-HD-A*ede';
    const lang = voiceName.s*lit('-').slice(0, 2).join('-') || *en-US';

    const body = {
      *nput: { text },
      voice: { lan*uageCode: lang, name: voiceName },*      audioConfig: {
        audio*ncoding: 'MP3',
        speakingRa*e: Number(s.rate || 0.92)
      }
*   };

    const res = await fetch*
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=' * encodeURIComponent(key),
      {
*       method: 'POST',
        hea*ers: { 'Content-Type': 'applicatio*/json' },
        body: JSON.strin*ify(body)
      }
    );

    cons* raw = await res.text();
    if (!*es.ok) throw new Error('TTS ' + re*.status + ': ' + raw.slice(0, 160)*;

    const data = JSON.parse(raw*;
    if (!data.audioContent) thro* new Error('No audioContent');

  * const bin = atob(data.audioConten*);
    const bytes = new Uint8Arra*(bin.length);

    for (let i = 0;*i < bin.length; i++) {
      bytes*i] = bin.charCodeAt(i);
    }

   *return new Blob([bytes], { type: '*udio/mpeg' });
  }

  function spl*tText(text) {
    text = String(te*t || '').replace(/\s+/g, ' ').trim*);

    const CHUNK = 400;
    con*t out = [];

    let i = 0;

    w*ile (i < text.length) {
      let *nd = Math.min(i + CHUNK, text.leng*h);

      if (end < text.length) *
        const dot = text.lastInde*Of('.', end);
        const comma * text.lastIndexOf(',', end);
     *  const cut = Math.max(dot, comma)*

        if (cut > i + 120) end =*cut + 1;
      }

      const part*= text.slice(i, end).trim();
     *if (part) out.push(part);

      i*= end;
    }

    return out;
  }
*  async function mergeBlobs(blobs)*{
    const buffers = [];

    for*(const b of blobs) {
      buffers*push(new Uint8Array(await b.arrayB*ffer()));
    }

    return new Bl*b(buffers, { type: 'audio/mpeg' })*
  }

  async function blobToBase6*(blob) {
    return new Promise((r*solve, reject) => {
      const r * new FileReader();

      r.onload*= () => {
        const s = String*r.result || '');
        resolve(s*split(',')[1] || '');
      };

  *   r.onerror = reject;
      r.rea*AsDataURL(blob);
    });
  }

  as*nc function uploadToGitHub(id, blo*) {
    const token = localStorage*getItem(KEY_GH_TOKEN);

    if (!t*ken) {
      throw new Error('缺 Gi*Hub Token。請先在選單設定 Token。');
    }
*    const b64 = await blobToBase64*blob);
    const url = apiAudioUrl*id);

    let sha = undefined;

  * try {
      const check = await f*tch(url + `?ref=${BRANCH}`, {
    *   headers: {
          Authorizat*on: `Bearer ${token}`,
          A*cept: 'application/vnd.github+json*
        }
      });

      if (ch*ck.ok) {
        const j = await c*eck.json();
        sha = j.sha;
 *    }
    } catch (e) {}

    cons* body = {
      message: `auto: ad* audio ${id}`,
      content: b64,*      branch: BRANCH
    };

    i* (sha) body.sha = sha;

    const *es = await fetch(url, {
      meth*d: 'PUT',
      headers: {
       *Authorization: `Bearer ${token}`,
*       Accept: 'application/vnd.gi*hub+json',
        'Content-Type':*'application/json'
      },
      *ody: JSON.stringify(body)
    });
*    const raw = await res.text();
*   if (!res.ok) throw new Error('G*tHub PUT ' + res.status + ': ' + r*w.slice(0, 200));

    markCached(*d, {
      url: rawAudioUrl(id),
 *    source: 'upload'
    });

    *og('uploaded ✓', id);
  }

  funct*on playURL(url) {
    return new P*omise((resolve, reject) => {
     *stopCurrent();

      const audio * new Audio(url);
      currentAudi* = audio;

      audio.onended = (* => {
        if (currentAudio ===*audio) currentAudio = null;
      * resolve();
      };

      audio.*nerror = e => {
        if (curren*Audio === audio) currentAudio = nu*l;
        reject(e);
      };

  *   audio.play().catch(reject);
   *});
  }

  function playBlob(blob)*{
    const url = URL.createObject*RL(blob);
    return playURL(url);*  }

  function stopCurrent() {
  * try {
      window.speechSynthesi*?.cancel();
    } catch (e) {}

  * if (currentAudio) {
      try {
 *      currentAudio.pause();
      * currentAudio.currentTime = 0;
   *  } catch (e) {}

      currentAud*o = null;
    }
  }

  async funct*on playCurrentArticle() {
    cons* nb = getCurrentNotebook();
    co*st text = getCurrentArticleText();*
    if (!text) {
      alert('讀不到*章文字');
      return;
    }

    co*st id = await articleId(text);
   *log('article id:', id);

    setFl*atingButtonState('checking');

   *const cachedUrl = await checkGitHu*Audio(id, nb?.name || '');

    if*(cachedUrl) {
      log('cache hit*→ play GitHub audio');
      markC*ched(id, {
        url: cachedUrl,*        name: nb?.name || '',
    *   source: 'github'
      });

   *  setFloatingButtonState('cached')*
      await playURL(cachedUrl);
 *    return;
    }

    log('cache *iss → generate via Google TTS');
 *  setFloatingButtonState('generati*g');

    const segments = splitTe*t(text);
    const blobs = [];

  * let i = 0;

    for (const seg of*segments) {
      i++;
      setFl*atingButtonState('generating', i, *egments.length);
      log(`synth *{i}/${segments.length}`);

      t*y {
        const b = await synthe*izeGoogle(seg);
        blobs.push*b);
      } catch (e) {
        co*sole.warn('[ArticleAudioC] synth f*il:', e);
      }
    }

    if (!*lobs.length) {
      setFloatingBu*tonState('default');
      alert('*部段落合成失敗');
      return;
    }

  * const merged = await mergeBlobs(b*obs);

    try {
      setFloating*uttonState('uploading');
      awa*t uploadToGitHub(id, merged);
    * catch (e) {
      console.warn('[ArticleAudioC] upload skipped:', e.*essage);
    }

    setFloatingBut*onState('cached');
    await playB*ob(merged);
  }

  function inject*tyle() {
    if (document.getEleme*tById('articleAudioCacheStyle')) r*turn;

    const style = document.*reateElement('style');
    style.i* = 'articleAudioCacheStyle';

    *tyle.textContent = `
      .nb-cac*e-label {
        margin-left: 6px*
        color: #b8b8b8;
        f*nt-size: 11px;
        font-weight* normal;
        letter-spacing: 0*
        opacity: .88;
        whi*e-space: nowrap;
      }

      .n*-cache-label::before {
        con*ent: "✓ ";
      }

      body.dar* .nb-cache-label {
        color: *8f8f8f;
        opacity: .9;
     *}

      .nb.cache-ready b {
     *  color: #d8d0bc;
      }

      .*b.cache-ready small {
        colo*: #aaa18f;
      }

      .nb-cach*-miss {
        display: none;
   *  }
    `;

    document.head.appe*dChild(style);
  }

  function cac*eLabelHTML(id) {
    const idx = g*tCacheIndex();
    const hit = id *& idx[id] && idx[id].cached;

    *eturn hit
      ? `<span class="nb*cache-label" title="此文章音檔已上傳到 GitH*b audio cache">已 Cache</span>`
   *  : `<span class="nb-cache-miss" d*ta-cache-miss="${esc(id || '')}"><*span>`;
  }

  async function note*ookAudioId(nb) {
    const text = *otebookText(nb);
    if (!text) re*urn '';
    return await articleId*text);
  }

  async function rende*NotebookCacheBadges() {
    const * = getDB();

    for (const nb of *.notebooks || []) {
      const te*t = notebookText(nb);
      if (!t*xt) continue;

      const id = aw*it articleId(text);
      const el*= document.querySelector(`.nb[data*nbid="${CSS.escape(nb.id)}"]`);
  *   if (!el) continue;

      const*labelHost = el.querySelector('.nb-*ache-host');
      if (!labelHost)*continue;

      const idx = getCa*heIndex();

      if (idx[id] && i*x[id].cached) {
        labelHost.*nnerHTML = cacheLabelHTML(id);
   *    el.classList.add('cache-ready'*;
        continue;
      }

     *checkGitHubAudio(id, nb.name).then*url => {
        if (!url) return;*
        const el2 = document.quer*Selector(`.nb[data-nbid="${CSS.esc*pe(nb.id)}"]`);
        if (!el2) *eturn;

        const host2 = el2.*uerySelector('.nb-cache-host');
  *     if (host2) host2.innerHTML = *acheLabelHTML(id);

        el2.cl*ssList.add('cache-ready');
      }*;
    }
  }

  let badgeTimer = nu*l;

  function refreshCacheBadgesS*on() {
    clearTimeout(badgeTimer*;
    badgeTimer = setTimeout(rend*rNotebookCacheBadges, 80);
  }

  *unction patchRenderSide() {
    if*(window.__articleAudioCacheRenderS*dePatched__) return;
    window.__*rticleAudioCacheRenderSidePatched_* = true;

    try {
      if (type*f renderSide !== 'function') retur*;

      renderSide = function () *
        const d = getDB();

     *  const activeId = (typeof cur !==*'undefined') ? cur : null;
       *const capturedCount = Object.value*(d.learn || {}).filter(x => x.capt*red && !x.known).length;

        *f (!document.getElementById('nblis*')) return;

        nblist.innerH*ML = d.notebooks.length
          * d.notebooks.map(n => `
          *   <div class="nb ${n.id == active*d ? 'active' : ''}" 
             *     data-nbid="${esc(n.id)}"
    *              onclick="cur='${esc(*.id)}';render()">
                *button class="del" onclick="event.*topPropagation();delNB('${esc(n.id*}')">×</button>
                <b*${esc(n.name)}</b>
               *<span class="nb-cache-host"></span*
                <br>
            *   <small>${esc(n.date)} · ${(n.ca*ds || []).length} 段 · ${capturedCo*nt} 捕獲</small>
              </div*
            `).join('')
         *: '<p style="font-size:12px;color:*bfb5a0">尚無筆記本</p>';

        refre*hCacheBadgesSoon();
      };

    * log('renderSide patched ✓');
    * catch (e) {
      console.warn('[ArticleAudioC] patchRenderSide fail*d:', e);
    }
  }

  let floating*tn = null;

  function setFloating*uttonState(state, i, total) {
    *f (!floatingBtn) return;

    if (*tate === 'checking') {
      float*ngBtn.textContent = '檢查 Cache…';
 *    floatingBtn.style.background =*'#d9d0bc';
      return;
    }

  * if (state === 'cached') {
      f*oatingBtn.textContent = '▶ 全文（已 Ca*he）';
      floatingBtn.style.back*round = '#b7d7a8';
      return;
 *  }

    if (state === 'generating*) {
      floatingBtn.textContent * total ? `生成音檔 ${i}/${total}` : '生*音檔…';
      floatingBtn.style.back*round = '#f4d27a';
      return;
 *  }

    if (state === 'uploading'* {
      floatingBtn.textContent =*'上傳 Cache…';
      floatingBtn.sty*e.background = '#f4d27a';
      re*urn;
    }

    floatingBtn.textCo*tent = '▶ 全文（Cache）';
    floating*tn.style.background = '#f4d27a';
 *}

  function addFloatingButton() *
    if (document.getElementById('*rticleAudioCacheBtn')) return;

  * const btn = document.createElemen*('button');
    btn.id = 'articleA*dioCacheBtn';
    btn.textContent * '▶ 全文（Cache）';

    btn.style.css*ext = `
      position: fixed;
   *  right: 8px;
      bottom: 8px;
 *    z-index: 2147483647;
      pad*ing: 8px 12px;
      border: none;*      border-radius: 8px;
      ba*kground: #f4d27a;
      color: #11*827;
      cursor: pointer;
      *ont-size: 13px;
      font-weight:*bold;
      box-shadow: 0 4px 12px*rgba(0,0,0,.18);
    `;

    btn.o*click = () => {
      playCurrentA*ticle().catch(err => {
        set*loatingButtonState('default');
   *    alert('播放失敗：' + err.message);
*     });
    };

    document.body*appendChild(btn);
    floatingBtn * btn;
  }

  function patchRenderH*ok() {
    try {
      if (typeof *ender !== 'function') return;
    * if (window.__articleAudioCacheRen*erHookPatched__) return;

      wi*dow.__articleAudioCacheRenderHookP*tched__ = true;

      const oldRe*der = render;

      render = func*ion () {
        oldRender.apply(t*is, arguments);
        refreshCac*eBadgesSoon();
      };

      log*'render hook patched ✓');
    } ca*ch (e) {
      console.warn('[ArticleAudioC] patchRenderHook failed:'* e);
    }
  }

  function init() *
    injectStyle();
    patchRende*Side();
    patchRenderHook();
    addFloatingButton();

    setTimeout(() => {
      try {
        if (typeof renderSide === 'function') renderSide();
        refreshCacheBadgesSoon();
      } catch (e) {
        console.warn('[ArticleAudioC] initial badge render failed:', e);
      }
    }, 300);

    window.__playCurrentArticleWithCache__ = playCurrentArticle;
    window.__refreshArticleAudioCacheBadges__ = renderNotebookCacheBadges;

    log('ready v20260711-1');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
