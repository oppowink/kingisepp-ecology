(function () {
  'use strict';

  if (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('DOMContentLoaded', function () {
    var cursor = document.querySelector('[data-component="kursor"]');
    if (!cursor) return;

    var probe = new Image();
    probe.onload = function () { document.body.classList.add('kursor-vklyuchen'); };
    probe.onerror = function () { cursor.remove(); };
    probe.src = 'img/icons/leaf-cursor.png';

    document.addEventListener('pointermove', function (event) {
      cursor.style.left = event.clientX + 'px';
      cursor.style.top = event.clientY + 'px';
      cursor.classList.add('vidim');
    }, { passive: true });

    document.addEventListener('pointerover', function (event) {
      var interactive = event.target.closest('a, button, input, textarea, select, label[for], [data-cursor-interactive]');
      cursor.classList.toggle('kursor--interaktivny', Boolean(interactive));
    });

    document.addEventListener('pointerout', function (event) {
      if (!event.relatedTarget) cursor.classList.remove('vidim', 'kursor--interaktivny');
    });

    window.addEventListener('blur', function () { cursor.classList.remove('vidim'); });
  });
})();