(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.shapka-logo__nazvanie > *').forEach(function (node, i) { node.style.setProperty('--wave-delay', i * 24 + 'ms'); });
    var logo = document.querySelector('.shapka-logo');
    if (logo) logo.addEventListener('pointerdown', function () { logo.classList.add('logo-wave'); setTimeout(function () { logo.classList.remove('logo-wave'); }, 1100); });
    var title = document.querySelector('.jump-in, [data-converge-title]');
    if (title) {
      var scene = document.createElement('div'); scene.className = 'converge'; title.parentNode.insertBefore(scene, title); scene.appendChild(title);
      ['img/leaf1.png', 'img/icons/map-point-active.png', 'img/home/aktualnost/avtomobil-hd.png', 'img/leaf2.png', 'img/home/aktualnost/berezy.png'].forEach(function (src) { var img = document.createElement('img'); img.src = src; img.alt = ''; img.setAttribute('aria-hidden', 'true'); scene.appendChild(img); });
      var scheduled = false;
      function update() {
        scheduled = false; if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        var r = scene.getBoundingClientRect(), progress = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * .85)));
        scene.querySelectorAll('img').forEach(function (img, i) { img.style.setProperty('--dx', (i % 2 ? -1 : 1) * progress * Math.min(70, r.width * .08) + 'px'); img.style.setProperty('--dy', (i > 1 ? -1 : 1) * progress * 35 + 'px'); img.style.setProperty('--tilt', progress * (i % 2 ? 15 : -15) + 'deg'); });
      }
      addEventListener('scroll', function () { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }, { passive: true }); update();
    }
  });
})();
