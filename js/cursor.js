(function () {
  'use strict';
  var scriptUrl = document.currentScript && document.currentScript.src;
  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.remove('kursor-vklyuchen');
    document.querySelectorAll('[data-component="kursor"]').forEach(function (node) { node.remove(); });

    var mouse = window.matchMedia('(hover: hover) and (pointer: fine)');
    var cursor = '';
    var loading = false;
    var root = document.documentElement;
    var source = new URL('../img/icons/leaf-cursor.png', scriptUrl || new URL('js/cursor.js', location.href));
    function apply() {
      root.classList.toggle('eco-leaf-cursor', mouse.matches && Boolean(cursor));
      if (!mouse.matches || cursor || loading) return;
      loading = true;
      var leaf = new Image();
      leaf.onload = function () {
        try {
          // Браузеру нужна маленькая картинка курсора, исходный PNG не меняем.
          var canvas = document.createElement('canvas');
          canvas.width = canvas.height = 32;
          var context = canvas.getContext('2d');
          if (!context) return;
          context.imageSmoothingQuality = 'high';
          context.drawImage(leaf, 0, 0, 32, 32);
          cursor = 'url("' + canvas.toDataURL('image/png') + '") 6 5';
          root.style.setProperty('--eco-cursor', cursor);
          root.classList.toggle('eco-leaf-cursor', mouse.matches);
        } catch (_) {
          root.classList.remove('eco-leaf-cursor');
        }
      };
      leaf.src = source.href;
    }
    apply();
    if (mouse.addEventListener) mouse.addEventListener('change', apply);
  });
})();
