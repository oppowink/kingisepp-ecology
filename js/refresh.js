(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    // Decorative assets belong to their sections; do not inject them beside headings.
    document.querySelectorAll('.shapka-logo__nazvanie > *').forEach(function (node, i) {
      node.style.setProperty('--wave-delay', i * 24 + 'ms');
    });
  });
})();
