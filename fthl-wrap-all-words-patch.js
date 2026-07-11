/* fthl-wrap-all-words-patch.js v20260711-1
   Wrap all English words (including stopwords) as .hl-target span.
   So FTHL can highlight every spoken word, not just .mark ones.
*/

(function () {

  'use strict';

  function log() {
    try {
      console.log.apply(console, ['[FTHLWrap]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  var WRAP_CLASS = 'hl-target';

  function wrapArticle() {

    var article = document.querySelector('.card .en');
    if (!article) return;

    if (article.dataset.fthlWrapped === '1') return;

    var walker = document.createTreeWalker(
      article,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {

          // 跳過已被 .mark 或 .hl-target 包起來的
          var parent = node.parentNode;
          if (!parent) return NodeFilter.FILTER_REJECT;

          if (parent.classList && (
            parent.classList.contains('mark') ||
            parent.classList.contains('hl-target')
          )) {
            return NodeFilter.FILTER_REJECT;
          }

          // 只處理有英文字的節點
          if (!/[A-Za-z]/.test(node.nodeValue)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);

    var wrapped = 0;

    nodes.forEach(function (textNode) {

      var text = textNode.nodeValue;

      // 找出所有英文字並包裹
      var fragment = document.createDocumentFragment();
      var re = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
      var lastEnd = 0;
      var match;

      while ((match = re.exec(text)) !== null) {

        // 前面的純文字
        if (match.index > lastEnd) {
          fragment.appendChild(
            document.createTextNode(text.slice(lastEnd, match.index))
          );
        }

        // 用 span 包字
        var span = document.createElement('span');
        span.className = WRAP_CLASS;
        span.setAttribute('data-key', match[0]);
        span.textContent = match[0];

        fragment.appendChild(span);
        lastEnd = re.lastIndex;
        wrapped++;
      }

      // 剩下的純文字
      if (lastEnd < text.length) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastEnd))
        );
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    });

    article.dataset.fthlWrapped = '1';

    log('wrapped', wrapped, 'non-mark words as .hl-target');
  }

  // 每次文章可能重新 render 時要重跑
  var tries = 0;
  var t = setInterval(function () {

    tries++;

    var article = document.querySelector('.card .en');
    if (!article) return;

    // 有 mark，代表主程式 render 完了
    if (article.querySelectorAll('.mark[data-key]').length > 0 &&
        article.dataset.fthlWrapped !== '1') {
      wrapArticle();
    }

    if (tries > 120) clearInterval(t);

  }, 400);

  log('ready v20260711-1');

})();
