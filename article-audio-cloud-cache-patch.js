(async () => {

  console.log('=== 檢查 article-audio-cloud-cache-patch ===');

  console.log('window.__articleAudioCache__:', typeof window.__articleAudioCache__);

  if (window.__articleAudioCache__) {
    console.log('  .play      =', typeof window.__articleAudioCache__.play);
    console.log('  .has       =', typeof window.__articleAudioCache__.has);
    console.log('  .id        =', typeof window.__articleAudioCache__.id);
    console.log('  .getMeta   =', typeof window.__articleAudioCache__.getMeta);
    console.log('  .forceRegen=', typeof window.__articleAudioCache__.forceRegen);
  }

  try {
    var res = await fetch('./article-audio-cloud-cache-patch.js?v=20260711-1', { cache: 'no-store' });
    var t = await res.text();

    console.log('http:', res.status, 'len:', t.length);
    console.log('---- HEAD (前 240) ----');
    console.log(t.slice(0, 240));
    console.log('---- TAIL (後 240) ----');
    console.log(t.slice(-240));
    console.log('包含 forceRegen 字串?', t.indexOf('forceRegen') >= 0);
    console.log('包含 v3.1 字串?', t.indexOf('v20260710-3.1') >= 0);
  } catch (e) {
    console.error('fetch err:', e);
  }

})();
