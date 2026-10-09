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
      hero.classList.remove('hero-intro--animating');
      if (timer) window.clearTimeout(timer);
      if (motion.removeEventListener) motion.removeEventListener('change', motionChanged);
    }
    function motionChanged(event) { if (event.matches) finish(); }
    function play(node, keyframes, duration, delay) {
      var animation = node.animate(keyframes, { duration:duration, delay:delay, easing:'cubic-bezier(0.22, 1, 0.36, 1)', fill:'backwards', iterations:1 });
      animations.push(animation);
    }
    try {
      var count = 0;
      words.forEach(function (word) {
        var fragment = document.createDocumentFragment();
        Array.from(word.textContent).forEach(function (letter) {
          var span = document.createElement('span'); span.className='hero-intro__letter'; span.textContent=letter;
          span.style.setProperty('--hero-letter-index', count++); fragment.appendChild(span);
        });
        word.replaceChildren(fragment);
      });
      hero.querySelectorAll('.hero-intro__letter').forEach(function (letter, index) {
        play(letter, [{opacity:0,transform:'translate3d(-6px, 14px, 0) rotate(-3deg)'},{opacity:1,transform:'translate3d(0, 0, 0) rotate(0deg)'}],300,index*18);
      });
      play(hero.querySelector('.hero-intro__place'),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],250,180);
      play(hero.querySelector('.hero-intro__tagline'),[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],240,340);
      var plane = hero.querySelector('.hero-intro__leaves');
      var travel = plane.getBoundingClientRect().width;
      var mobile = window.matchMedia('(max-width:760px)').matches;
      var leaves = hero.querySelectorAll('.hero-intro__leaf');
      function path(end, y, rotation) {
        return [
          {opacity:0,transform:'translate3d(-40px,-14px,0) rotate(-20deg)',offset:0},
          {opacity:1,transform:'translate3d('+travel*.12+'px,-3px,0) rotate(-8deg)',offset:.16},
          {opacity:1,transform:'translate3d('+travel*.52+'px,-12px,0) rotate(12deg)',offset:.58},
          {opacity:0,transform:'translate3d('+end+'px,'+y+'px,0) rotate('+rotation+'deg)',offset:1}
        ];
      }
      play(leaves[0],path(travel+40,9,30),1060,0);
      play(leaves[1],path(travel+50,5,24),1020,80);
      if (!mobile) {
        var end = (travel - 34) - travel*.02;
        // The static position is right:2%; animate relative to that position.
        play(leaves[2],[
          {opacity:0,transform:'translate3d('+(-end-30)+'px,-12px,0) rotate(-18deg)',offset:0},
          {opacity:1,transform:'translate3d('+(-end*.66)+'px,-4px,0) rotate(-4deg)',offset:.25},
          {opacity:1,transform:'translate3d('+(-end*.24)+'px,-10px,0) rotate(22deg)',offset:.7},
          {opacity:1,transform:'translate3d(0,0,0) rotate(14deg)',offset:1}
        ],1060,80);
      }
      hero.classList.add('hero-intro--animating');
      timer = window.setTimeout(finish,1200);
      if (motion.addEventListener) motion.addEventListener('change',motionChanged);
      Promise.all(animations.map(function (animation) { return animation.finished; })).then(finish).catch(finish);
    } catch (_) { finish(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
