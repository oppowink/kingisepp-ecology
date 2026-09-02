// education.js — лёгкое обучение волонтёра и пробный тест
(function () {
  'use strict';

  var QUESTIONS = [
    {
      id: 'q1',
      text: 'Что помогает оценить ФА листа?',
      options: [
        { value: 'color', label: 'Только цвет листа' },
        { value: 'symmetry', label: 'Различия между левой и правой стороной' },
        { value: 'weather', label: 'Погоду в день съёмки' }
      ],
      correct: 'symmetry'
    },
    {
      id: 'q2',
      text: 'Что должно быть в одной заявке волонтёра?',
      options: [
        { value: 'one_tree', label: 'Одна точка, одно дерево и 30 листьев' },
        { value: 'many_trees', label: 'Несколько деревьев в одной заявке' },
        { value: 'any_count', label: 'Любое число фото' }
      ],
      correct: 'one_tree'
    },
    {
      id: 'q3',
      text: 'Какой лист лучше переснять или заменить?',
      options: [
        { value: 'clean', label: 'Целый лист без пятен и дырок' },
        { value: 'damaged', label: 'Лист с дырками, пятнами или сильным подсыханием' },
        { value: 'visible', label: 'Лист, полностью видимый в кадре' }
      ],
      correct: 'damaged'
    },
    {
      id: 'q4',
      text: 'Какое фото подходит для дальнейшей проверки?',
      options: [
        { value: 'top', label: 'Лист снят сверху, на светлом фоне, целиком' },
        { value: 'hand', label: 'Лист держат пальцами в воздухе' },
        { value: 'dark', label: 'Лист лежит на тёмном пёстром фоне' }
      ],
      correct: 'top'
    },
    {
      id: 'q5',
      text: 'Когда точка может стать видимой на карте?',
      options: [
        { value: 'after_upload', label: 'Сразу после загрузки' },
        { value: 'after_checks', label: 'После модератора и автоматической проверки' },
        { value: 'after_photo', label: 'После одной фотографии дерева' }
      ],
      correct: 'after_checks'
    }
  ];

  var PASS_SCORE = 4;
  var SLIDE_DELAY_MS = 5000;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

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
    var delayTimer = null;

    function showMessage(text, state) {
      if (!result) return;
      result.textContent = text || '';
      result.dataset.state = state || '';
      result.hidden = !text;
    }

    function clearSlideDelay() {
      if (delayTimer) {
        window.clearInterval(delayTimer);
        delayTimer = null;
      }
    }

    function startSlideDelay() {
      clearSlideDelay();
      var action = current === slides.length - 1 ? toTest : next;
      if (!action || action.hidden) return;

      var defaultText = current === slides.length - 1 ? 'Перейти к пробному тесту' : 'Дальше';
      var lockedText = current === slides.length - 1 ? 'К тесту через ' : 'Дальше через ';
      var availableAt = Date.now() + SLIDE_DELAY_MS;

      function tick() {
        var secondsLeft = Math.ceil((availableAt - Date.now()) / 1000);
        if (secondsLeft > 0) {
          action.disabled = true;
          action.textContent = lockedText + secondsLeft + ' сек.';
          return;
        }
        clearSlideDelay();
        action.disabled = false;
        action.textContent = defaultText;
      }

      tick();
      delayTimer = window.setInterval(tick, 250);
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
      next.disabled = false;
      toTest.disabled = false;
      next.textContent = 'Дальше';
      toTest.textContent = 'Перейти к пробному тесту';
      startSlideDelay();
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

    renderQuestions();

    back.addEventListener('click', function () {
      renderSlide(current - 1);
    });
    next.addEventListener('click', function () {
      if (next.disabled) return;
      renderSlide(current + 1);
    });
    toTest.addEventListener('click', function () {
      if (toTest.disabled) return;
      clearSlideDelay();
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

      if (!passed) {
        showMessage('Пока не зачёт: ' + score + '/' + QUESTIONS.length + '. Нужно минимум ' + PASS_SCORE + '. Перечитайте блоки и попробуйте ещё раз.', 'error');
        return;
      }

      showMessage('Пробный тест пройден: ' + score + '/' + QUESTIONS.length + '.', 'success');
      showDone();
    });

    renderSlide(0);
  });
})();
