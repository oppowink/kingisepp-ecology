// moderator-test.js — отдельный тест допуска модератора без стандартных radio-кнопок
(function () {
  'use strict';

  var TEST = [
    {
      question: 'Что проверяет модератор в первую очередь?',
      options: [
        { value: 'design', label: 'Оформление страницы заявки' },
        { value: 'data_quality', label: 'Качество исходных данных и соответствие методике' },
        { value: 'final_result', label: 'Итоговое экологическое состояние города' }
      ],
      answer: 'data_quality'
    },
    {
      question: 'Какой набор данных соответствует одной заявке?',
      options: [
        { value: 'one_tree_30', label: 'Одна точка, одно дерево, 30 листьев' },
        { value: 'two_trees_30', label: 'Одна точка, два дерева, 30 листьев суммарно' },
        { value: 'any_count', label: 'Любое количество листьев при хороших фотографиях' }
      ],
      answer: 'one_tree_30'
    },
    {
      question: 'Что является основанием для отклонения фотографии?',
      options: [
        { value: 'plain_background', label: 'Светлый однотонный фон' },
        { value: 'cut_leaf', label: 'Лист обрезан краем кадра' },
        { value: 'top_view', label: 'Съёмка строго сверху' }
      ],
      answer: 'cut_leaf'
    },
    {
      question: 'Почему нельзя принимать повреждённые листья для расчёта ФА?',
      options: [
        { value: 'shape_distortion', label: 'Повреждения искажают контур и промеры листа' },
        { value: 'too_beautiful', label: 'Они хуже выглядят на карте' },
        { value: 'file_problem', label: 'Они занимают больше памяти' }
      ],
      answer: 'shape_distortion'
    },
    {
      question: 'Что делать, если координаты не совпадают с описанием точки?',
      options: [
        { value: 'approve', label: 'Одобрить, если листья качественные' },
        { value: 'fix_or_reject', label: 'Не публиковать до исправления или отклонить с причиной' },
        { value: 'delete_coords', label: 'Удалить координаты из заявки' }
      ],
      answer: 'fix_or_reject'
    },
    {
      question: 'Когда точка может появиться на карте?',
      options: [
        { value: 'after_submit', label: 'Сразу после отправки заявки' },
        { value: 'after_human', label: 'После решения модератора' },
        { value: 'after_two_steps', label: 'После проверки модератором и автоматической проверки' }
      ],
      answer: 'after_two_steps'
    },
    {
      question: 'Что нужно указать при отклонении заявки?',
      options: [
        { value: 'reason', label: 'Конкретную причину отклонения' },
        { value: 'no_need', label: 'Ничего, достаточно статуса' },
        { value: 'personal_view', label: 'Личное впечатление от работы участника' }
      ],
      answer: 'reason'
    },
    {
      question: 'Какая ошибка нарушает сопоставимость данных?',
      options: [
        { value: 'same_tree', label: 'Все листья собраны с одного дерева' },
        { value: 'mixed_trees', label: 'В одной заявке смешаны листья разных деревьев' },
        { value: 'exact_date', label: 'Указана точная дата сбора' }
      ],
      answer: 'mixed_trees'
    },
    {
      question: 'Что означает статус ожидания автоматической проверки?',
      options: [
        { value: 'published', label: 'Точка уже опубликована' },
        { value: 'human_done_ai_wait', label: 'Модератор одобрил, но второй этап ещё не завершён' },
        { value: 'rejected', label: 'Заявка отклонена без публикации' }
      ],
      answer: 'human_done_ai_wait'
    },
    {
      question: 'Как снизить субъективность модерации?',
      options: [
        { value: 'fast', label: 'Проверять заявки как можно быстрее' },
        { value: 'checklist', label: 'Использовать единый чеклист и фиксировать причину решения' },
        { value: 'memory', label: 'Опираться на память и общий вид заявки' }
      ],
      answer: 'checklist'
    }
  ];

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

    var form = document.getElementById('moderatorTestForma');
    var questions = document.getElementById('moderatorTestVoprosy');
    var message = document.getElementById('moderatorTestSoobshchenie');
    var certificateButton = document.getElementById('moderatorTestSertifikat');
    var answers = {};

    function showMessage(text, state) {
      if (!message) return;
      message.textContent = text || '';
      message.dataset.state = state || '';
      message.hidden = !text;
    }

    function updateCertificateButton() {
      var passed = EcoAuth.isModeratorExamCompleted && EcoAuth.isModeratorExamCompleted(user.email);
      if (!certificateButton) return;
      certificateButton.disabled = !passed;
    }

    if (!['moderator', 'admin'].includes(user.role)) {
      showMessage('Тест доступен только модераторам и администраторам.', 'error');
      return;
    }

    if (!(EcoAuth.isModeratorTrainingCompleted && EcoAuth.isModeratorTrainingCompleted(user.email))) {
      showMessage('Сначала завершите обучение модератора на странице модерации.', 'error');
      return;
    }

    if (!form || !questions) return;
    form.hidden = false;

    questions.innerHTML = TEST.map(function (item, index) {
      var titleId = 'moderator-test-title-' + index;
      var options = item.options.map(function (option) {
        return '<button aria-pressed="false" class="moderator-variant" data-question="' + index + '" data-value="' + escapeHtml(option.value) + '" type="button">' +
          escapeHtml(option.label) +
          '</button>';
      }).join('');
      return '<section class="moderator-vopros" aria-labelledby="' + titleId + '">' +
        '<p id="' + titleId + '">' + (index + 1) + '. ' + escapeHtml(item.question) + '</p>' +
        options +
        '</section>';
    }).join('');

    questions.addEventListener('click', function (event) {
      var button = event.target.closest('[data-question][data-value]');
      if (!button) return;
      var index = button.getAttribute('data-question');
      answers[index] = button.getAttribute('data-value');
      questions.querySelectorAll('[data-question="' + index + '"]').forEach(function (item) {
        var selected = item === button;
        item.classList.toggle('moderator-variant--vybran', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (Object.keys(answers).length < TEST.length) {
        showMessage('Ответьте на все вопросы.', 'error');
        return;
      }

      var score = TEST.reduce(function (sum, item, index) {
        return sum + (answers[index] === item.answer ? 1 : 0);
      }, 0);
      var result = EcoAuth.completeModeratorExam({
        score: score,
        total: TEST.length,
        answers: answers
      });

      if (result && result.completed) {
        showMessage('Тест пройден: ' + score + '/10. Сертификат модератора доступен.', 'success');
      } else {
        showMessage('Результат: ' + score + '/10. Для допуска нужно 9/10.', 'error');
      }
      updateCertificateButton();
    });

    if (certificateButton) {
      certificateButton.addEventListener('click', function () {
        if (!(EcoAuth.isModeratorExamCompleted && EcoAuth.isModeratorExamCompleted(user.email))) {
          showMessage('Сначала пройдите тест минимум на 9 из 10.', 'error');
          return;
        }
        EcoAuth.openModeratorCertificate({
          user: user,
          date: new Date().toLocaleDateString('ru-RU')
        });
      });
    }

    updateCertificateButton();
  });
})();
