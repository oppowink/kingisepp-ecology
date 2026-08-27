// feedback.js — логика формы обратной связи
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    var form = document.getElementById('formaObratnoySvyazi');
    var message = document.getElementById('svyazSoobshchenie');
    if (!form) return;

    // элементы кастомного селекта темы
    var topicRoot = document.getElementById('vyborTemy');
    var topicButton = document.getElementById('vyborTemyKnopka');
    var topicList = document.getElementById('vyborTemySpisok');
    var topicText = document.getElementById('vyborTemyTekst');
    var topicInput = document.getElementById('svyazTip');
    var topicOptions = topicList ? Array.from(topicList.querySelectorAll('[data-value]')) : [];

    function closeTopicMenu() { /* скрыть выпадашку */ }
    function openTopicMenu() { /* показать выпадашку */ }

    // инициализация кастомного селекта
    if (topicButton && topicList && topicInput && topicText) {
      topicButton.addEventListener('click', function () {
        if (topicList.hidden) openTopicMenu();
        else closeTopicMenu();
      });

      topicOptions.forEach(function (option) {
        option.addEventListener('click', function () {
          topicInput.value = option.dataset.value;
          topicText.textContent = option.textContent;
          topicOptions.forEach(function (item) {
            var selected = item === option;
            item.classList.toggle('aktivny', selected);
            item.setAttribute('aria-selected', selected ? 'true' : 'false');
          });
          closeTopicMenu();
          topicButton.focus();
        });
      });

      // управление с клавиатуры (стрелки, Escape)
      topicList.addEventListener('keydown', function (event) {
        var focused = document.activeElement;
        var index = topicOptions.indexOf(focused);
        if (event.key === 'Escape') {
          event.preventDefault();
          closeTopicMenu();
          topicButton.focus();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          topicOptions[(index + 1 + topicOptions.length) % topicOptions.length].focus();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          topicOptions[(index - 1 + topicOptions.length) % topicOptions.length].focus();
        }
      });

      document.addEventListener('click', function (event) {
        if (topicRoot && !topicRoot.contains(event.target)) closeTopicMenu();
      });
    }

    // подставляем данные пользователя, если он авторизован
    var user = EcoAuth.getUser() || await EcoAuth.refreshUser();
    if (user) {
      document.getElementById('svyazImya').value = user.name || '';
      document.getElementById('svyazEmail').value = user.email || '';
    }

    // отправка формы — сохраняем через EcoAuth
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var text = document.getElementById('svyazTekst').value.trim();
      if (!text) return;

      EcoAuth.saveFeedback({
        name: document.getElementById('svyazImya').value.trim(),
        email: document.getElementById('svyazEmail').value.trim(),
        type: document.getElementById('svyazTip').value,
        text: text
      });
      document.getElementById('svyazTekst').value = '';
      if (message) {
        message.textContent = 'Сообщение отправлено';
        message.dataset.state = 'success';
        message.hidden = false;
      }
    });
  });
})();