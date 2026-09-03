// games.js — логика трёх игр «Экологического детектива»
(function () {
  'use strict';

  var ROAD_STEPS = [
    { title: 'Первое наблюдение', image: 'img/games/detective_road_1_observation.jpg', text: 'У берёзы возле оживлённой дороги часть листьев выглядит менее ровной. Как начать исследование?', options: ['Сразу объявить дорогу причиной', 'Записать наблюдение и подобрать точки для сравнения', 'Спросить у прохожих, загрязнён ли воздух'], correct: 1, explanation: 'Наблюдение помогает сформулировать гипотезу, но не доказывает причину. Нужны сопоставимые точки и единые правила сбора.' },
    { title: 'Выбор дерева', image: 'img/games/detective_road_2_tree.jpg', text: 'Какое дерево подходит для сопоставимого набора?', options: ['Любое дерево с похожими листьями', 'Взрослая берёза повислая без сильных видимых повреждений', 'Самая маленькая берёза во дворе'], correct: 1, explanation: 'Один вид и сходное состояние деревьев уменьшают влияние посторонних различий на результат.' },
    { title: 'Отбор листьев', image: 'img/games/detective_road_3_collection.jpg', text: 'Как собрать материал с выбранного дерева?', options: ['Взять 30 листьев по правилу отбора с одного дерева', 'Выбрать 10 самых ровных листьев', 'Смешать листья трёх соседних деревьев'], correct: 0, explanation: 'Одна заявка соответствует одному дереву и 30 листьям. Выбор только «красивых» листьев и смешение деревьев искажают выборку.' },
    { title: 'Фотография', image: 'img/games/detective_road_4_photo.jpg', text: 'Как подготовить лист для съёмки?', options: ['Снять его в руке на фоне улицы', 'Положить расправленным на светлый фон и снять строго сверху', 'Снять несколько листьев одной кучкой'], correct: 1, explanation: 'Ровный фон, полный контур и съёмка сверху позволяют корректно проверить форму листа.' },
    { title: 'Паспорт точки', image: 'img/games/detective_road_5_passport.jpg', text: 'Что особенно важно записать рядом с дорогой?', options: ['Только название улицы', 'Координаты дерева, расстояние до дороги и интенсивность движения', 'Любимую марку автомобиля наблюдателя'], correct: 1, explanation: 'Паспорт территории сохраняет условия наблюдения и позволяет позднее сопоставить точки.' },
    { title: 'Повреждённый лист', image: 'img/games/detective_road_6_damage.jpg', text: 'На листе отсутствует часть пластинки после укуса насекомого. Что делать?', options: ['Дорисовать край мысленно', 'Отнести повреждение к ФА', 'Отметить повреждение и не использовать лист как нормальный'], correct: 2, explanation: 'Утрата ткани и асимметрия развития — разные признаки. Повреждённый лист нельзя выдавать за нормальный.' },
    { title: 'Вывод', image: 'img/games/detective_road_7_conclusion.jpg', text: 'У дорожной точки ФА выше, чем у контрольной. Как сформулировать результат?', options: ['Дорога точно вызвала все изменения', 'Обнаружено различие, которое нужно проверить статистически и на других точках', 'Результат ничего не значит'], correct: 1, explanation: 'Различие поддерживает исследовательскую гипотезу, но причинный вывод требует повторов, статистики и учёта других факторов.' }
  ];

  var LEAVES = [
    { path: 'img/games/leaf_normal_1.png', title: 'Лист 1', category: 'normal', explanation: 'Пластинка целая, контур читается, выраженных повреждений нет. Такой лист можно включать в основной набор.' },
    { path: 'img/games/leaf_damaged_1.png', title: 'Лист 2', category: 'damaged', explanation: 'Часть края утрачена. Это повреждение, а не проявление флуктуирующей асимметрии.' },
    { path: 'img/games/leaf_asymmetric_1.png', title: 'Лист 3', category: 'asymmetric', explanation: 'Ткань целая, но левая и правая стороны заметно различаются по форме.' },
    { path: 'img/games/leaf_normal_2.png', title: 'Лист 4', category: 'normal', explanation: 'Небольшая естественная неровность допустима: лист целый и пригоден для промеров.' },
    { path: 'img/games/leaf_damaged_2.png', title: 'Лист 5', category: 'damaged', explanation: 'Пятна и подсыхание мешают оценивать исходную форму листовой пластинки.' },
    { path: 'img/games/leaf_asymmetric_2.png', title: 'Лист 6', category: 'asymmetric', explanation: 'Целый контур позволяет увидеть различие сторон без влияния утраченной ткани.' },
    { path: 'img/games/leaf_normal_3.png', title: 'Лист 7', category: 'normal', explanation: 'Лист полностью виден и не имеет признаков, требующих исключения.' },
    { path: 'img/games/leaf_damaged_3.png', title: 'Лист 8', category: 'damaged', explanation: 'Отверстия от фитофагов относятся к повреждениям и должны отмечаться отдельно.' },
    { path: 'img/games/leaf_asymmetric_3.png', title: 'Лист 9', category: 'asymmetric', explanation: 'Стороны различаются, но пластинка не оборвана и не объедена.' }
  ];

  var APPLICATIONS = [
    { title: 'Заявка из городского парка', fields: [['Фотографии', '1 дерево и 30 листьев'], ['Координаты', 'Указаны на месте сбора'], ['Паспорт', 'Заполнен полностью'], ['Качество', 'Листья сняты сверху на светлом фоне']], decision: 'approve', explanation: 'Комплект полный, происхождение данных понятно, фотографии позволяют продолжить проверку. Заявку можно одобрить на первичном этапе.' },
    { title: 'Заявка с площади', fields: [['Фотографии', '1 дерево и 28 листьев'], ['Координаты', 'Указаны'], ['Паспорт', 'Заполнен'], ['Качество', 'Два снимка размыты']], decision: 'reject', explanation: 'Для точки требуется ровно 30 пригодных фотографий. Нужно отклонить заявку с понятной причиной и предложить участнику дополнить набор.' },
    { title: 'Заявка у дороги', fields: [['Фотографии', '1 дерево и 30 листьев'], ['Координаты', 'Указаны'], ['Паспорт', 'Расстояние до дороги не заполнено'], ['Качество', 'На части листьев не виден край']], decision: 'reject', explanation: 'Неполный паспорт и обрезанный контур мешают сопоставлению и измерению. Заявку следует вернуть на исправление, указав обе причины.' }
  ];

  var GAME_ORDER = ['road', 'leaves', 'moderator'];
  var categoryNames = { normal: 'Нормальный', damaged: 'Повреждённый', asymmetric: 'Асимметричный' };
  var catalog;
  var screen;
  var content;
  var progress;
  var runAll = false;
  var currentGame = '';
  var stepIndex = 0;
  var leafScore = 0;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  function showGame(name, allMode) {
    currentGame = name;
    runAll = Boolean(allMode);
    stepIndex = 0;
    leafScore = 0;
    catalog.hidden = true;
    screen.hidden = false;
    renderCurrent();
    screen.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function answerButtons(options) {
    return '<div class="games-varianty">' + options.map(function (label, index) {
      return '<button class="games-variant" data-answer="' + index + '" type="button"><span class="games-variant__bukva">' + String.fromCharCode(65 + index) + '</span><span>' + escapeHtml(label) + '</span></button>';
    }).join('') + '</div>';
  }

  function bindAnswer(correctIndex, explanation, afterAnswer) {
    content.querySelectorAll('[data-answer]').forEach(function (button) {
      button.addEventListener('click', function () {
        var selected = Number(button.dataset.answer);
        content.querySelectorAll('[data-answer]').forEach(function (item) { item.disabled = true; });
        button.dataset.selected = 'true';
        var box = document.getElementById('gamesExplanation');
        box.innerHTML = '<strong>' + (selected === correctIndex ? 'Подход верный.' : 'Здесь есть важная деталь.') + '</strong> ' + escapeHtml(explanation);
        box.hidden = false;
        var next = document.getElementById('gamesNext');
        next.hidden = false;
        if (afterAnswer) afterAnswer(selected === correctIndex);
        next.focus();
      });
    });
    document.getElementById('gamesNext').addEventListener('click', function () {
      stepIndex += 1;
      renderCurrent();
    });
  }

  function renderRoad() {
    if (stepIndex >= ROAD_STEPS.length) {
      renderFinish('Детектив у дороги завершён', 'Вы прошли путь от первого наблюдения до аккуратного научного вывода.', [
        'Внешний вид листа помогает поставить вопрос, но не доказывает причину.',
        'Сопоставимость зависит от единого вида, правил отбора и полного паспорта точки.',
        'Честный вывод отделяет наблюдение, статистическую связь и причинное объяснение.'
      ]);
      return;
    }
    var item = ROAD_STEPS[stepIndex];
    progress.textContent = 'Детектив у дороги · шаг ' + (stepIndex + 1) + ' из ' + ROAD_STEPS.length;
    content.innerHTML = '<article class="games-zadanie"><p class="games-zadanie__meta">Полевое расследование</p><h2>' + escapeHtml(item.title) + '</h2><!-- TODO: фото ' + escapeHtml(item.image) + ' --><div class="games-foto-zaglushka games-foto-zaglushka--road" role="img" aria-label="Место для изображения этапа"><span>' + escapeHtml(item.image) + '</span></div><p class="games-zadanie__tekst">' + escapeHtml(item.text) + '</p>' + answerButtons(item.options) + '<p class="games-obyasnenie" hidden id="gamesExplanation"></p><button class="knopka-osnovnaya games-next" hidden id="gamesNext" type="button">Дальше</button></article>';
    bindAnswer(item.correct, item.explanation);
  }

  function renderLeaves() {
    if (stepIndex >= LEAVES.length) {
      renderFinish('Сортировка завершена', 'Совпало с методикой: ' + leafScore + ' из ' + LEAVES.length + '. Это не рейтинг, а подсказка, какие признаки стоит ещё раз сравнить.', [
        'Повреждение означает утрату или изменение ткани после формирования листа.',
        'Асимметрия оценивается только тогда, когда исходный контур можно корректно увидеть.',
        'Сомнительный лист лучше отметить и передать модератору, а не угадывать.'
      ]);
      return;
    }
    var leaf = LEAVES[stepIndex];
    progress.textContent = 'Сортировщик листьев · карточка ' + (stepIndex + 1) + ' из ' + LEAVES.length;
    content.innerHTML = '<article class="games-zadanie"><div class="games-leaf-layout"><div><!-- TODO: фото ' + escapeHtml(leaf.path) + ' --><div class="games-foto-zaglushka" role="img" aria-label="Место для фотографии ' + escapeHtml(leaf.title) + '"><span>' + escapeHtml(leaf.title) + '<br/>' + escapeHtml(leaf.path) + '</span></div></div><div><p class="games-zadanie__meta">Определите основной признак</p><h2>' + escapeHtml(leaf.title) + '</h2><p class="games-zadanie__tekst">К какой категории относится этот лист?</p><div class="games-categories">' + Object.keys(categoryNames).map(function (key) { return '<button class="games-category" data-category="' + key + '" type="button">' + categoryNames[key] + '</button>'; }).join('') + '</div><p class="games-obyasnenie" hidden id="gamesExplanation"></p><button class="knopka-osnovnaya games-next" hidden id="gamesNext" type="button">Следующий лист</button></div></div></article>';
    content.querySelectorAll('[data-category]').forEach(function (button) {
      button.addEventListener('click', function () {
        var correct = button.dataset.category === leaf.category;
        if (correct) leafScore += 1;
        content.querySelectorAll('[data-category]').forEach(function (item) { item.disabled = true; });
        button.dataset.selected = 'true';
        var box = document.getElementById('gamesExplanation');
        box.innerHTML = '<strong>' + (correct ? 'Категория выбрана верно.' : 'Верная категория: ' + categoryNames[leaf.category] + '.') + '</strong> ' + escapeHtml(leaf.explanation);
        box.hidden = false;
        var next = document.getElementById('gamesNext');
        next.hidden = false;
        next.focus();
      });
    });
    document.getElementById('gamesNext').addEventListener('click', function () { stepIndex += 1; renderCurrent(); });
  }

  function renderModerator() {
    if (stepIndex >= APPLICATIONS.length) {
      renderFinish('Проверка заявок завершена', 'Модератор не ищет «идеальные» результаты. Его задача — убедиться, что данные собраны по правилам и пригодны для следующего этапа.', [
        'Одобряется качество и комплектность данных, а не желаемое значение ФА.',
        'Отклонение всегда сопровождается конкретной исправимой причиной.',
        'На карту заявка попадает только после предусмотренных этапов проверки.'
      ]);
      return;
    }
    var application = APPLICATIONS[stepIndex];
    progress.textContent = 'Модератор на час · заявка ' + (stepIndex + 1) + ' из ' + APPLICATIONS.length;
    content.innerHTML = '<article class="games-zadanie"><p class="games-zadanie__meta">Первичная проверка</p><h2>' + escapeHtml(application.title) + '</h2><dl class="games-zayavka">' + application.fields.map(function (field) { return '<div><dt>' + escapeHtml(field[0]) + '</dt><dd>' + escapeHtml(field[1]) + '</dd></div>'; }).join('') + '</dl><div class="games-reshenie"><button class="knopka-osnovnaya" data-decision="approve" type="button">Одобрить</button><button class="knopka-vtorichnaya" data-decision="reject" type="button">Отклонить</button></div><p class="games-obyasnenie" hidden id="gamesExplanation"></p><button class="knopka-osnovnaya games-next" hidden id="gamesNext" type="button">Следующая заявка</button></article>';
    content.querySelectorAll('[data-decision]').forEach(function (button) {
      button.addEventListener('click', function () {
        var correct = button.dataset.decision === application.decision;
        content.querySelectorAll('[data-decision]').forEach(function (item) { item.disabled = true; });
        button.dataset.selected = 'true';
        var box = document.getElementById('gamesExplanation');
        box.innerHTML = '<strong>' + (correct ? 'Решение обосновано.' : 'Стоит пересмотреть комплектность.') + '</strong> ' + escapeHtml(application.explanation);
        box.hidden = false;
        var next = document.getElementById('gamesNext');
        next.hidden = false;
        next.focus();
      });
    });
    document.getElementById('gamesNext').addEventListener('click', function () { stepIndex += 1; renderCurrent(); });
  }

  function renderFinish(title, text, conclusions) {
    progress.textContent = 'Игра завершена';
    var gamePosition = GAME_ORDER.indexOf(currentGame);
    var hasNext = runAll && gamePosition < GAME_ORDER.length - 1;
    content.innerHTML = '<section class="games-itog"><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(text) + '</p><ul class="games-vyvody">' + conclusions.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul><p>В реальном проекте те же правила помогают превратить фотографию листа в проверяемое наблюдение на карте.</p><div class="games-itog__deystviya">' + (hasNext ? '<button class="knopka-osnovnaya" id="gamesContinue" type="button">Следующая игра</button>' : '') + '<button class="knopka-vtorichnaya" id="gamesCatalogButton" type="button">Выбрать другую игру</button><a class="knopka-tekst" href="about.html">Как участвовать в проекте</a></div></section>';
    if (hasNext) document.getElementById('gamesContinue').addEventListener('click', function () { showGame(GAME_ORDER[gamePosition + 1], true); });
    document.getElementById('gamesCatalogButton').addEventListener('click', showCatalog);
  }

  function renderCurrent() {
    if (currentGame === 'road') renderRoad();
    else if (currentGame === 'leaves') renderLeaves();
    else renderModerator();
  }

  function showCatalog() {
    runAll = false;
    currentGame = '';
    screen.hidden = true;
    catalog.hidden = false;
    catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('DOMContentLoaded', function () {
    catalog = document.getElementById('gamesCatalog');
    screen = document.getElementById('gamesScreen');
    content = document.getElementById('gamesContent');
    progress = document.getElementById('gamesProgress');
    if (!catalog || !screen || !content || !progress) return;

    document.querySelectorAll('[data-game-start]').forEach(function (button) {
      button.addEventListener('click', function () { showGame(button.dataset.gameStart, false); });
    });
    document.getElementById('gamesStartAll').addEventListener('click', function () { showGame('road', true); });
    document.getElementById('gamesChoose').addEventListener('click', function () {
      catalog.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var first = catalog.querySelector('[data-game-start]');
      if (first) first.focus({ preventScroll: true });
    });
    document.getElementById('gamesBackToCatalog').addEventListener('click', showCatalog);
  });
})();
