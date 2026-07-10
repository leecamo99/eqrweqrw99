/* hide-wordnote-speak-btn-patch.js v20260710-1
   Hide 🔊 buttons in WORD NOTE dockBody.
*/

(function () {

  'use strict';

  const RE_SPEAK = /🔊|發音/i;

  function hide() {

    const dock = document.getElementById('dockBody');
    if (!dock) return;

    dock.querySelectorAll('button').forEach(btn => {

      if (RE_SPEAK.test(btn.textContent || '')) {
        btn.style.display = 'none';
      }
    });
  }

  setInterval(hide, 500);

  console.log('[HideSpeakBtn] ready');

})();
