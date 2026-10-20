(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var scene = document.querySelector('[data-home-scene]');
    if (!scene || typeof IntersectionObserver !== 'function') return;

    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;

    var observer;
    var stopped = false;
    function finish() {
      stopped = true;
      scene.classList.remove('home-scene--waiting', 'home-scene--playing');
      if (observer) observer.disconnect();
    }

    function play() {
      if (stopped || motion.matches) return finish();
      scene.classList.remove('home-scene--waiting');
      scene.classList.add('home-scene--playing');
    }

    try {
      observer = new IntersectionObserver(function (entries) {
        if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
        observer.disconnect();
        var images = Array.from(scene.querySelectorAll('img'));
        Promise.allSettled(images.map(function (image) {
          return typeof image.decode === 'function' ? image.decode() : Promise.resolve();
        })).then(play).catch(finish);
      }, { threshold: 0.25 });
      scene.classList.add('home-scene--waiting');
      observer.observe(scene);
      scene.addEventListener('animationend', function (event) {
        if (event.target.classList.contains('home-scene__exhaust')) finish();
      });
      motion.addEventListener('change', function (event) {
        if (event.matches) finish();
      });
    } catch (_) {
      finish();
    }
  });
})();
