// cursor.js — кастомный курсор сайта
(function () {
  'use strict';

  // отключаем на тач-устройствах и при reduced motion
  if (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('DOMContentLoaded', function () {
    var cursor = document.querySelector('[data-component="kursor"]');
    if (!cursor) return;

    // пробуем подгрузить картинку курсора, если не загрузилась — удаляем
    var probe = new Image();
    probe.onload = function () { document.body.classList.add('kursor-vklyuchen'); };
    probe.onerror = function () { cursor.remove(); };
    probe.src = 'img/icons/leaf-cursor.png';

    // движение мыши — обновляем позицию курсора
    document.addEventListener('pointermove', function (event) {
      cursor.style.left = event.clientX + 'px';
      cursor.style.top = event.clientY + 'px';
      cursor.classList.add('vidim');
    }, { passive: true });

    // при наведении на интерактивные элементы — увеличиваем
    document.addEventListener('pointerover', function (event) {
      var interactive = event.target.closest('a, button, input, textarea, select, label[for], [data-cursor-interactive]');
      cursor.classList.toggle('kursor--interaktivny', Boolean(interactive));
    });

    // при уходе с элемента — скрываем, если не на другой интерактивный
    document.addEventListener('pointerout', function (event) {
      if (!event.relatedTarget) cursor.classList.remove('vidim', 'kursor--interaktivny');
    });

    // при потере фокуса окна — скрываем курсор
    window.addEventListener('blur', function () { cursor.classList.remove('vidim'); });
  });
})();