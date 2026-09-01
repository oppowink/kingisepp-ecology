// education.js — обучение волонтёра и тест
(function () {
  'use strict';

  var QUESTIONS = [
    {
      id: 'q1',
      text: 'Сколько фотографий листьев нужно загрузить для одной точки?',
      options: [
        { value: '10', label: '10 фотографий' },
        { value: '30', label: '30 фотографий' },
        { value: '60', label: '60 фотографий' }
      ],
      correct: '30'
    },
    {
      id: 'q2',
      text: 'Какой вид дерева используется в основной методике проекта?',
      options: [
        { value: 'maple', label: 'Клён остролистный' },
        { value: 'betula', label: 'Берёза повислая' },
        { value: 'oak', label: 'Дуб черешчатый' }
      ],
      correct: 'betula'
    },
    {
      id: 'q3',
      text: 'Какие листья подходят для основной точки мониторинга?',
      options: [
        { value: 'any', label: 'Любые листья, если их много' },
        { value: 'no_damage', label: 'Неповреждённые листья без дырок и пятен' },
        { value: 'dry', label: 'Только сухие листья с земли' }
      ],
      correct: 'no_damage'
    },
    {
      id: 'q4',
      text: 'Как правильно фотографировать лист?',
      options: [
        { value: 'top_light', label: 'Сверху, на светлом фоне, без сильной тени' },
        { value: 'side_dark', label: 'Сбоку, на любом фоне' },
        { value: 'many_leaves', label: 'Все листья сразу одним кадром' }
      ],
      correct: 'top_light'
    },
    {
      id: 'q5',
      text: 'Где нужно фиксировать координаты?',
      options: [
        { value: 'city_center', label: 'В центре города' },
        { value: 'tree_coords', label: 'Рядом с выбранным деревом' },
        { value: 'home', label: 'Дома после сбора' }
      ],
      correct: 'tree_coords'
    },
    {
      id: 'q6',
      text: 'Что происходит после отправки точки?',
      options: [
        { value: 'map_now', label: 'Она сразу появляется на карте' },
        { value: 'moderation', label: 'Она отправляется на модерацию' },
        { value: 'delete', label: 'Фотографии удаляются' }
      ],
      correct: 'moderation'
    },
    {
      id: 'q7',
      text: 'Когда точка становится публичной на карте?',
      options: [
        { value: 'after_approval', label: 'После подтверждения модератором' },
        { value: 'after_upload', label: 'Сразу после загрузки фото' },
        { value: 'never', label: 'Точки не показываются на карте' }
      ],
      correct: 'after_approval'
    }
  ];

  var PASS_SCORE = 6;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

    await EcoAuth.refreshEducationStatus();

    var slides = Array.from(document.querySelectorAll('[data-obuchenie-slajd]'));
    var counter = document.getElementById('obuchenieSchetchik');
    var back = document.getElementById('obuchenieNazad');
    var next = document.getElementById('obuchenieDalshe');
    var toTest = document.getElementById('obuchenieKTestu');
    var screen = document.getElementById('obuchenieEkran');
    var controls = document.querySelector('.obuchenie-upravlenie');
    var testBlock = document.getElementById('obuchenieTest');
    var questionsBox = document.getElementById('obuchenieVoprosy');
    var form = document.getElementById('obuchenieTestForma');
    var result = document.getElementById('obuchenieTestRezultat');
    var done = document.getElementById('obuchenieZaversheno');

    if (!slides.length || !counter || !back || !next || !toTest || !questionsBox || !form) return;

    var current = 0;

    function showMessage(text, state) {
      if (!result) return;
      result.textContent = text || '';
      result.dataset.state = state || '';
      result.hidden = !text;
    }

    function renderSlide(index) {
      current = Math.max(0, Math.min(index, slides.length - 1));
      slides.forEach(function (slide, slideIndex) {
        slide.hidden = slideIndex !== current;
      });
      counter.textContent = (current + 1) + ' из ' + slides.length;
      back.disabled = current === 0;
      next.hidden = current === slides.length - 1;
      toTest.hidden = current !== slides.length - 1;
    }

    function renderQuestions() {
      questionsBox.innerHTML = QUESTIONS.map(function (question, index) {
        var options = question.options.map(function (option) {
          return '<label class="obuchenie-variant">' +
            '<input required type="radio" name="' + escapeHtml(question.id) + '" value="' + escapeHtml(option.value) + '">' +
            '<span>' + escapeHtml(option.label) + '</span>' +
            '</label>';
        }).join('');
        return '<fieldset class="obuchenie-vopros">' +
          '<legend>' + (index + 1) + '. ' + escapeHtml(question.text) + '</legend>' +
          options +
          '</fieldset>';
      }).join('');
    }

    function selectedAnswers() {
      return QUESTIONS.reduce(function (answers, question) {
        var checked = form.querySelector('input[name="' + question.id + '"]:checked');
        answers[question.id] = checked ? checked.value : '';
        return answers;
      }, {});
    }

    function localScore(answers) {
      return QUESTIONS.reduce(function (score, question) {
        return score + (answers[question.id] === question.correct ? 1 : 0);
      }, 0);
    }

    function showDone() {
      if (screen) screen.hidden = true;
      if (controls) controls.hidden = true;
      counter.hidden = true;
      if (testBlock) testBlock.hidden = true;
      if (done) done.hidden = false;
    }

    if (EcoAuth.isEducationCompleted(user.email)) {
      showDone();
      return;
    }

    renderQuestions();

    back.addEventListener('click', function () {
      renderSlide(current - 1);
    });
    next.addEventListener('click', function () {
      renderSlide(current + 1);
    });
    toTest.addEventListener('click', function () {
      if (screen) screen.hidden = true;
      if (controls) controls.hidden = true;
      counter.hidden = true;
      testBlock.hidden = false;
      showMessage('');
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var answers = selectedAnswers();
      var unanswered = Object.keys(answers).some(function (key) { return !answers[key]; });
      if (unanswered) {
        showMessage('Ответьте на все вопросы теста.', 'error');
        return;
      }

      var score = localScore(answers);
      var passed = score >= PASS_SCORE;
      var saved = await EcoAuth.completeEducation({
        answers: answers,
        score: score,
        total: QUESTIONS.length,
        completed: passed
      });
      var finalScore = Number(saved.score || score);
      var finalTotal = Number(saved.total || QUESTIONS.length);
      var completed = Boolean(saved.completed);

      if (!completed) {
        showMessage('Пока не зачёт: ' + finalScore + '/' + finalTotal + '. Нужно минимум ' + PASS_SCORE + '. Исправьте ответы и попробуйте ещё раз.', 'error');
        return;
      }

      showMessage('Зачёт: ' + finalScore + '/' + finalTotal + '. Обучение сохранено.', 'success');
      showDone();
    });

    renderSlide(0);
  });
})();
