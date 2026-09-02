// glossary.js - определения научных терминов и подсказки
(function () {
  'use strict';

  var glossary = {
    'fluctuating-asymmetry': {
      definition: 'Небольшие случайные различия между левой и правой сторонами двусторонне симметричного признака. В проекте их оценивают по парным промерам листа и используют как показатель стабильности его развития.'
    },
    'calculated-estimates': {
      definition: 'Значение, полученное вычислением по исходным данным и принятой модели, а не прямым приборным измерением. В проекте таким способом оценивается транспортная нагрузка.'
    },
    'correlation-analysis': {
      definition: 'Статистический анализ, который показывает направление и силу связи между показателями. Наличие корреляции само по себе не доказывает причинно-следственную связь.'
    },
    'bioindication': {
      definition: 'Данные о состоянии или реакции живого организма, по которым судят об условиях окружающей среды. В проекте таким биологическим индикатором служат листья берёзы повислой.'
    },
    'methodology': {
      definition: 'Единый набор правил и последовательность действий для сбора, подготовки и анализа образцов. Соблюдение одной методики позволяет корректно сопоставлять результаты разных участников.'
    }
  };

  var terms = [];
  var overlay = null;
  var tooltip = null;
  var tooltipText = null;
  var activeTerm = null;
  var pinned = false;
  var demoMode = false;
  var scrollLocked = false;
  var closeTimer = 0;
  var resizeFrame = 0;

  function supportsHover() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function createTooltip() {
    overlay = document.createElement('div');
    overlay.className = 'termin-overlay';
    overlay.id = 'terminOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);

    tooltip = document.createElement('div');
    tooltip.className = 'termin-tooltip';
    tooltip.id = 'terminTooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.innerHTML = '<span class="termin-tooltip__tekst"></span>';
    document.body.appendChild(tooltip);
    tooltipText = tooltip.querySelector('.termin-tooltip__tekst');

    tooltip.addEventListener('mouseenter', function () {
      window.clearTimeout(closeTimer);
    });
    tooltip.addEventListener('mouseleave', function () {
      if (!pinned && !demoMode) scheduleHide();
    });

    overlay.addEventListener('click', function () {
      hide(true);
    });
  }

  function setScrollLock(lock) {
    if (lock && !scrollLocked) {
      var scrollbar = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbar > 0) document.body.style.paddingRight = scrollbar + 'px';
      document.body.classList.add('termin-podskazka-otkryta');
      scrollLocked = true;
    } else if (!lock && scrollLocked) {
      document.body.classList.remove('termin-podskazka-otkryta');
      document.body.style.paddingRight = '';
      scrollLocked = false;
    }
  }

  function setOverlay(open) {
    if (!overlay) return;
    overlay.classList.toggle('vidim', Boolean(open));
    overlay.setAttribute('aria-hidden', String(!open));
    setScrollLock(open);
  }

  function positionTooltip() {
    if (!activeTerm || !tooltip || !tooltip.classList.contains('vidim')) return;

    var termRect = activeTerm.getBoundingClientRect();
    var tipRect = tooltip.getBoundingClientRect();
    var gap = 10;
    var edge = 12;
    var topSpace = termRect.top;
    var bottomSpace = window.innerHeight - termRect.bottom;
    var placeAbove = topSpace >= tipRect.height + gap || topSpace > bottomSpace;
    var top = placeAbove ? termRect.top - tipRect.height - gap : termRect.bottom + gap;
    var left = termRect.left + termRect.width / 2 - tipRect.width / 2;

    left = Math.max(edge, Math.min(left, window.innerWidth - tipRect.width - edge));
    top = Math.max(edge, Math.min(top, window.innerHeight - tipRect.height - edge));

    tooltip.style.left = Math.round(left) + 'px';
    tooltip.style.top = Math.round(top) + 'px';
  }

  function show(term, pin, demo) {
    var key = term && term.getAttribute('data-glossary');
    var item = key && glossary[key];
    if (!item) return;

    window.clearTimeout(closeTimer);
    if (activeTerm && activeTerm !== term) {
      activeTerm.classList.remove('termin--aktivny');
      activeTerm.setAttribute('aria-expanded', 'false');
    }

    activeTerm = term;
    pinned = Boolean(pin);
    demoMode = Boolean(demo);
    tooltipText.textContent = item.definition;
    term.classList.add('termin--aktivny');
    term.setAttribute('aria-expanded', 'true');
    tooltip.setAttribute('aria-hidden', 'false');
    tooltip.classList.add('vidim');
    setOverlay(pinned || demoMode || !supportsHover());
    positionTooltip();
    window.requestAnimationFrame(positionTooltip);
  }

  function hide(force) {
    if ((pinned || demoMode) && !force) return;
    window.clearTimeout(closeTimer);
    pinned = false;
    demoMode = false;
    if (activeTerm) {
      activeTerm.classList.remove('termin--aktivny');
      activeTerm.setAttribute('aria-expanded', 'false');
    }
    activeTerm = null;
    tooltip.classList.remove('vidim');
    tooltip.setAttribute('aria-hidden', 'true');
    setOverlay(false);
  }

  function scheduleHide() {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(function () { hide(false); }, 120);
  }

  function initTerms() {
    terms = Array.from(document.querySelectorAll('[data-glossary]'));
    if (!terms.length) return;
    createTooltip();

    terms.forEach(function (term, index) {
      var key = term.getAttribute('data-glossary');
      var item = glossary[key];
      if (!item) return;
      var describedBy = 'termin-opisanie-' + index;
      term.setAttribute('aria-haspopup', 'true');
      term.setAttribute('aria-expanded', 'false');
      term.setAttribute('aria-label', term.textContent.trim() + '. Показать определение');
      term.setAttribute('aria-describedby', describedBy);

      var sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.id = describedBy;
      sr.textContent = item.definition;
      term.insertAdjacentElement('afterend', sr);

      term.addEventListener('mouseenter', function () {
        if (supportsHover()) show(term, false, false);
      });
      term.addEventListener('mouseleave', function () {
        if (supportsHover() && !pinned) scheduleHide();
      });
      term.addEventListener('focus', function () { show(term, false, false); });
      term.addEventListener('blur', function () {
        if (!pinned) scheduleHide();
      });
      term.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (activeTerm === term && pinned) hide(true);
        else show(term, true, false);
      });
      term.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          hide(true);
          term.blur();
        }
      });
    });

    document.addEventListener('click', function (event) {
      if (!activeTerm || !pinned) return;
      if (tooltip.contains(event.target) || activeTerm.contains(event.target)) return;
      hide(true);
    });

    window.addEventListener('scroll', function () {
      if (!activeTerm || demoMode) return;
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(function () {
        if (pinned) positionTooltip();
        else hide(true);
      });
    }, { passive: true });

    window.addEventListener('resize', function () {
      if (!activeTerm) return;
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(positionTooltip);
    });
  }

  function initTutorial() {
    if (!terms.length) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var seenKey = 'eco-terminy-demonstraciya-v2';
    var target = terms[0];
    var dot = document.createElement('span');
    var note = document.createElement('p');
    var shown = false;
    var timers = [];

    dot.className = 'termin-demo-tochka';
    dot.setAttribute('aria-hidden', 'true');
    note.className = 'termin-demo-podpis';
    note.setAttribute('aria-hidden', 'true');
    note.innerHTML = supportsHover()
      ? 'Наведите на <strong>выделенное слово</strong> - рядом появится определение.'
      : 'Нажмите на <strong>выделенное слово</strong> - рядом появится определение.';
    document.body.appendChild(dot);
    document.body.appendChild(note);

    function later(fn, ms) {
      timers.push(window.setTimeout(fn, ms));
    }

    function cleanup() {
      timers.forEach(window.clearTimeout);
      timers = [];
      note.classList.remove('vidim');
      dot.classList.remove('vidim');
      if (demoMode) hide(true);
      later(function () {
        dot.remove();
        note.remove();
      }, reduceMotion ? 0 : 220);
    }

    function reveal() {
      if (shown || sessionStorage.getItem(seenKey) === '1') return;
      var rect = target.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;

      shown = true;
      sessionStorage.setItem(seenKey, '1');

      if (reduceMotion) {
        show(target, false, true);
        note.classList.add('vidim');
        later(cleanup, 5000);
        return;
      }

      var targetX = rect.left + Math.min(rect.width * .62, rect.width - 4);
      var targetY = rect.top + rect.height * .54;
      dot.style.left = Math.round(targetX + 62) + 'px';
      dot.style.top = Math.round(targetY + 34) + 'px';
      dot.classList.add('vidim');

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          dot.style.left = Math.round(targetX) + 'px';
          dot.style.top = Math.round(targetY) + 'px';
        });
      });

      later(function () {
        show(target, false, true);
        note.classList.add('vidim');
      }, 650);
      later(function () {
        dot.classList.remove('vidim');
      }, 1450);
      later(cleanup, 6200);
    }

    function onScroll() {
      if (window.scrollY < 18) return;
      reveal();
      if (shown) window.removeEventListener('scroll', onScroll);
    }

    if (sessionStorage.getItem(seenKey) !== '1') {
      window.addEventListener('scroll', onScroll, { passive: true });
    } else {
      dot.remove();
      note.remove();
    }

    terms.forEach(function (term) {
      ['mouseenter', 'focus', 'click'].forEach(function (eventName) {
        term.addEventListener(eventName, function () {
          if (shown) cleanup();
        }, { once: true });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTerms();
    initTutorial();
  });
})();
