// home.js — scroll-сцены главной и анимация актуальности
(function () {
  'use strict';

  // отключаем анимации при reduced motion или на тач-устройствах
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileQuery = window.matchMedia('(max-width: 760px)');

  // вспомогательные функции для плавной интерполяции
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function smoother(value) {
    var t = clamp(value, 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function phase(progress, from, to) {
    return smoother(clamp((progress - from) / Math.max(.001, to - from), 0, 1));
  }

  // вычисление прогресса секции относительно окна
  function sceneProgress(section) {
    var rect = section.getBoundingClientRect();
    var viewport = Math.max(1, window.innerHeight);
    var start = viewport * .90;
    var finish = -viewport * .25;
    return clamp((start - rect.top) / Math.max(1, start - finish), 0, 1);
  }

  // расчёт целевых значений для текущего скролла
  function targetForScene(section) {
    var p = sceneProgress(section);
    var width = window.innerWidth;
    var enter = phase(p, .015, .31);
    var illustrationEnter = phase(p, .055, .35);
    var isLast = section.classList.contains('glavnaya-scena--poslednyaya');
    var isActuality = section.dataset.scena === 'aktualnost';
    var exit = isLast ? 0 : phase(p, .78, .995);
    var blockFade = isLast ? 1 : (1 - phase(p, .84, .99) * .96);
    var illustrationFade = isLast ? 1 : (1 - phase(p, .84, .99) * .96);

    return {
      blockX: (1 - enter) * width * .66 - exit * width * 1.05,
      illustrationX: isActuality ? 0 : (1 - illustrationEnter) * width * .52 - exit * width * 1.05,
      blockOpacity: clamp(phase(p, .015, .18) * blockFade, 0, 1),
      illustrationOpacity: clamp(phase(p, isActuality ? .02 : .05, .22) * illustrationFade, 0, 1)
    };
  }

  function almostEqual(a, b) { return Math.abs(a - b) < .08; }
  function approach(current, target, factor) { return current + (target - current) * factor; }

  // инициализация scroll-сцен
  function initScrollScenes() {
    if (reduceMotion || mobileQuery.matches) return;

    var states = Array.from(document.querySelectorAll('.glavnaya-scena')).map(function (section) {
      return {
        section: section,
        block: section.querySelector('.glavnaya-blok'),
        illustration: section.querySelector('.glavnaya-illyustraciya'),
        current: null,
        target: null
      };
    }).filter(function (state) { return state.block && state.illustration; });
    if (!states.length) return;

    var animationFrame = 0;
    function updateTargets() {
      states.forEach(function (state) {
        state.target = targetForScene(state.section);
        if (!state.current) state.current = Object.assign({}, state.target);
      });
      requestAnimation();
    }
    function draw() {
      var moving = false;
      states.forEach(function (state) {
        var current = state.current;
        var target = state.target;
        if (!current || !target) return;
        current.blockX = approach(current.blockX, target.blockX, .115);
        current.illustrationX = approach(current.illustrationX, target.illustrationX, .105);
        current.blockOpacity = approach(current.blockOpacity, target.blockOpacity, .15);
        current.illustrationOpacity = approach(current.illustrationOpacity, target.illustrationOpacity, .14);

        state.block.style.transform = 'translate3d(' + current.blockX.toFixed(2) + 'px,0,0)';
        state.illustration.style.transform = 'translate3d(' + current.illustrationX.toFixed(2) + 'px,0,0)';
        state.block.style.opacity = current.blockOpacity.toFixed(3);
        state.illustration.style.opacity = current.illustrationOpacity.toFixed(3);

        moving = moving ||
          !almostEqual(current.blockX, target.blockX) ||
          !almostEqual(current.illustrationX, target.illustrationX) ||
          !almostEqual(current.blockOpacity, target.blockOpacity) ||
          !almostEqual(current.illustrationOpacity, target.illustrationOpacity);
      });
      animationFrame = moving ? requestAnimationFrame(draw) : 0;
    }
    function requestAnimation() { if (!animationFrame) animationFrame = requestAnimationFrame(draw); }

    window.addEventListener('scroll', updateTargets, { passive: true });
    window.addEventListener('resize', updateTargets);
    updateTargets();
  }

  // анимация актуальности — включается при появлении блока
  function initActualitySequence() {
    var stage = document.querySelector('[data-aktualnost-scena]');
    if (!stage) return;
    if (reduceMotion) {
      stage.classList.add('aktualnost-aktivna');
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= .32) {
          stage.classList.remove('aktualnost-aktivna');
          void stage.offsetWidth;
          stage.classList.add('aktualnost-aktivna');
        } else if (!entry.isIntersecting) {
          stage.classList.remove('aktualnost-aktivna');
        }
      });
    }, { threshold: [0, .32, .65] });
    observer.observe(stage);
  }

  // запускаем анимацию призыва только при появлении фразы в окне
  function initJumpIn() {
    var items = document.querySelectorAll('.jump-in');
    if (!items.length) return;
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      items.forEach(function (item) { item.classList.add('jump-in--visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('jump-in--visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .55 });
    items.forEach(function (item) { observer.observe(item); });
  }

  // запуск при загрузке DOM
  document.addEventListener('DOMContentLoaded', function () {
    initScrollScenes();
    initActualitySequence();
    initJumpIn();
  });
})();
