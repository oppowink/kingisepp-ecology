// game.js — интерактивные экологические кейсы без рейтинга
(function () {
  'use strict';
  var cases = [
    { title: 'Кейс 1. Два дерева у дороги', situation: 'У одного дерева листья выглядят хуже. Можно ли сразу заключить, что причина — автомобильные выбросы?', options: [
      ['Да, внешнего вида достаточно', false, 'Наблюдение важно, но одного визуального признака недостаточно для вывода о причине.'],
      ['Нет, нужно сравнение по единой методике и данные о других факторах', true, 'Верно. Сопоставимые выборки и контекст территории отделяют наблюдение от предположения.'],
      ['Нужно спросить мнение прохожих', false, 'Мнение может подсказать гипотезу, но не заменяет измерения.'] ] },
    { title: 'Кейс 2. Самый красивый лист', situation: 'Для набора хочется выбрать только крупные и ровные листья. Что произойдёт?', options: [
      ['Набор станет качественнее', false, 'Так возникает систематическая ошибка отбора: выборка перестаёт представлять дерево.'],
      ['Результат может искусственно занизить асимметрию', true, 'Верно. Листья отбирают по правилу, а не по желаемому внешнему виду.'],
      ['Ничего, размер листа не связан с выборкой', false, 'Проблема не только в размере, а в преднамеренном отборе удобных образцов.'] ] },
    { title: 'Кейс 3. Повреждение или асимметрия', situation: 'Край листа объеден насекомым. Можно ли измерять его как обычный лист?', options: [
      ['Да, отсутствующую часть можно дорисовать', false, 'Дорисовка создаёт вымышленные данные. Повреждение нужно отметить и исключить по правилу методики.'],
      ['Нет, повреждение мешает оценить исходную форму', true, 'Верно. Флуктуирующая асимметрия и утрата ткани — разные явления.'],
      ['Да, если лист сфотографирован на белом фоне', false, 'Хороший фон не восстанавливает утраченную часть листа.'] ] },
    { title: 'Кейс 4. Точка на карте', situation: 'Участник помнит только название парка и ставит маркер у центрального входа, хотя дерево было в другой части.', options: [
      ['Это допустимо: парк один', false, 'Для повторного наблюдения и связи с объектом нужны координаты именно исследуемого дерева.'],
      ['Нужно вернуться к дереву или подтвердить точное место', true, 'Верно. Точная точка делает наблюдение воспроизводимым.'],
      ['Можно убрать координаты совсем', false, 'Без координат наблюдение нельзя надёжно связать с территорией.'] ] },
    { title: 'Кейс 5. Неожиданный результат', situation: 'Данные не подтверждают любимую гипотезу. Как поступить?', options: [
      ['Подправить несколько значений', false, 'Изменение результатов разрушает проверяемость исследования.'],
      ['Скрыть точку и оставить только удачные', false, 'Выборочная публикация создаёт искажённую картину.'],
      ['Проверить качество, честно описать результат и ограничения', true, 'Верно. Неожиданный результат тоже научно значим, если данные собраны корректно.'] ] }
  ];
  var index = 0;
  var answered = false;
  var title = document.getElementById('igraZagolovok');
  var situation = document.getElementById('igraSituaciya');
  var options = document.getElementById('igraVarianty');
  var response = document.getElementById('igraOtvet');
  var next = document.getElementById('igraDalee');
  var restart = document.getElementById('igraSnachala');
  var progress = document.getElementById('igraProgress');

  function render() {
    answered = false;
    next.disabled = true;
    response.hidden = true;
    response.textContent = '';
    options.replaceChildren();
    var current = cases[index];
    progress.textContent = 'Ситуация ' + (index + 1) + ' из ' + cases.length;
    title.textContent = current.title;
    situation.textContent = current.situation;
    current.options.forEach(function (variant) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'igra-variant';
      button.setAttribute('aria-pressed', 'false');
      button.textContent = variant[0];
      button.addEventListener('click', function () {
        if (answered) return;
        answered = true;
        options.querySelectorAll('button').forEach(function (item) { item.disabled = true; });
        button.setAttribute('aria-pressed', 'true');
        response.textContent = variant[2];
        response.dataset.state = variant[1] ? 'good' : 'think';
        response.hidden = false;
        next.disabled = false;
      });
      options.appendChild(button);
    });
    next.textContent = index === cases.length - 1 ? 'Завершить' : 'Следующий кейс';
  }

  function showFinish() {
    progress.textContent = 'Все ситуации разобраны';
    title.textContent = 'Экологическое мышление начинается с честного вопроса';
    situation.textContent = 'Важно не угадывать «правильный» экологический ответ, а различать наблюдение, измерение, гипотезу и доказательство. Именно поэтому платформа сохраняет паспорт точки и показывает этапы проверки.';
    options.replaceChildren();
    response.hidden = true;
    next.disabled = false;
    next.textContent = 'Перейти к проекту';
    next.dataset.finish = 'true';
  }

  next.addEventListener('click', function () {
    if (next.dataset.finish === 'true') { location.href = 'about.html'; return; }
    if (index === cases.length - 1) { showFinish(); return; }
    index += 1;
    render();
  });
  restart.addEventListener('click', function () { index = 0; delete next.dataset.finish; render(); });
  render();
})();
