(function () {
  'use strict';
  function initialize() {
    var hero = document.querySelector('[data-hero-intro]');
    if (!hero || hero.dataset.heroInitialized) return;
    hero.dataset.heroInitialized = 'true';
    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || document.visibilityState === 'hidden' || typeof hero.animate !== 'function') return;
    var words = Array.from(hero.querySelectorAll('.hero-intro__word'));
    var animations = [], timer;
    function finish() {
      animations.forEach(function (animation) { animation.cancel(); });
      if (timer) window.clearTimeout(timer);
      if (motion.removeEventListener) motion.removeEventListener('change', motionChanged);
    }
    function motionChanged(event) { if (event.matches) finish(); }
    function play(node, keyframes, duration, delay) {
      var animation = node.animate(keyframes, { duration:duration, delay:delay, easing:'cubic-bezier(0.22, 1, 0.36, 1)', fill:'backwards', iterations:1 });
      animations.push(animation);
    }
    function between(min, max) { return min + Math.random() * (max - min); }
    function transform(x, y, rotation) {
      return 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) rotate(' + rotation.toFixed(2) + 'deg)';
    }
    try {
      words.forEach(function (word) {
        var fragment = document.createDocumentFragment();
        Array.from(word.textContent).forEach(function (letter) {
          var span = document.createElement('span'); span.className='hero-intro__letter'; span.textContent=letter;
          fragment.appendChild(span);
        });
        word.replaceChildren(fragment);
      });
      hero.querySelectorAll('.hero-intro__letter').forEach(function (letter, index) {
        play(letter, [
          {opacity:0,transform:transform(between(-8,-4),between(10,16),between(-4,4))},
          {opacity:1,transform:'translate3d(0,0,0) rotate(0deg)'}
        ],between(285,315),index*18+between(0,3));
      });
      play(hero.querySelector('.hero-intro__place'),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],250,180);
      var plane = hero.querySelector('.hero-intro__leaves');
      var travel = plane.getBoundingClientRect().width;
      var mobile = window.matchMedia('(max-width:760px)').matches;
      var leaves = hero.querySelectorAll('.hero-intro__leaf');
      var sway = mobile ? .65 : 1;
      function path() {
        return [
          {opacity:0,transform:transform(-40,between(-18,-10)*sway,between(-26,-14)),offset:0},
          {opacity:1,transform:transform(travel*between(.09,.15),between(-6,4)*sway,between(-14,4)),offset:.16},
          {opacity:1,transform:transform(travel*between(.4,.46),between(-19,-9)*sway,between(8,24)),offset:.43},
          {opacity:1,transform:transform(travel*between(.69,.75),between(-2,8)*sway,between(-7,13)),offset:.72},
          {opacity:0,transform:transform(travel+50,between(3,11)*sway,between(22,35)),offset:1}
        ];
      }
      play(leaves[0],path(),between(1020,1060),between(0,20));
      play(leaves[1],path(),between(990,1030),between(70,100));
      if (!mobile) {
        var end = (travel - 34) - travel*.02;
        // Последний лист прилетает в свою позицию из CSS и остаётся там.
        play(leaves[2],[
          {opacity:0,transform:transform(-end-30,between(-16,-8),between(-24,-14)),offset:0},
          {opacity:1,transform:transform(-end*between(.62,.69),between(-7,1),between(-9,5)),offset:.25},
          {opacity:1,transform:transform(-end*between(.22,.28),between(-17,-8),between(18,30)),offset:.7},
          {opacity:1,transform:'translate3d(0,0,0) rotate(14deg)',offset:1}
        ],between(1020,1060),between(70,100));
      }
      timer = window.setTimeout(finish,1200);
      if (motion.addEventListener) motion.addEventListener('change',motionChanged);
      Promise.all(animations.map(function (animation) { return animation.finished; })).then(finish).catch(finish);
    } catch (_) { finish(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
