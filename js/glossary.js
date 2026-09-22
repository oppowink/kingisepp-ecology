// Короткие пояснения в тексте статьи. Открываются нажатием на термин.
(function () {
  'use strict';
  var definitions = {
    'fluctuating-asymmetry': 'Небольшие случайные различия между левой и правой сторонами листа. Здесь их оценивают по парным промерам и используют как показатель стабильности развития.',
    'calculated-estimates': 'Значение, вычисленное по исходным данным и модели. Это оценка транспортной нагрузки, а не прямое измерение концентрации загрязнителей.',
    'correlation-analysis': 'Способ проверить направление и силу статистической связи. Сама по себе корреляция не доказывает, что один показатель вызвал изменение другого.',
    'bioindication': 'Наблюдения за живыми организмами, по состоянию которых можно судить об условиях среды. В этом проекте изучают листья берёзы.',
    'methodology': 'Общие правила сбора и анализа образцов. Благодаря им результаты разных участников можно сопоставлять.'
  };
  document.addEventListener('DOMContentLoaded', function () {
    var terms = Array.from(document.querySelectorAll('[data-glossary]'));
    var opened = null;
    function close() {
      if (!opened) return;
      opened.term.setAttribute('aria-expanded', 'false');
      opened.term.classList.remove('termin--aktivny');
      opened.note.remove();
      opened = null;
    }
    terms.forEach(function (term) {
      var definition = definitions[term.getAttribute('data-glossary')];
      if (!definition) return;
      term.setAttribute('aria-expanded', 'false');
      term.setAttribute('aria-label', term.textContent.trim() + ': показать пояснение');
      term.addEventListener('click', function () {
        if (opened && opened.term === term) { close(); return; }
        close();
        var note = document.createElement('span');
        note.className = 'termin-opisanie';
        note.setAttribute('role', 'note');
        note.textContent = definition;
        term.insertAdjacentElement('afterend', note);
        term.setAttribute('aria-expanded', 'true');
        term.classList.add('termin--aktivny');
        opened = { term: term, note: note };
      });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && opened) { var term = opened.term; close(); term.focus(); }
    });
    document.addEventListener('click', function (event) {
      if (opened && !opened.note.contains(event.target) && !opened.term.contains(event.target)) close();
    });
  });
})();
