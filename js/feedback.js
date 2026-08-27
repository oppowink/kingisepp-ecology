// feedback.js — логика формы обратной связи
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('formaObratnoySvyazi');
    var message = document.getElementById('svyazSoobshchenie');
    if (!form) return;

    // === КАСТОМНЫЙ СЕЛЕКТ (тема) ===
    var topicRoot = document.getElementById('vyborTemy');
    var topicButton = document.getElementById('vyborTemyKnopka');
    var topicList = document.getElementById('vyborTemySpisok');
    var topicText = document.getElementById('vyborTemyTekst');
    var topicInput = document.getElementById('svyazTip');
    var topicOptions = topicList ? Array.from(topicList.querySelectorAll('[data-value]')) : [];

    function closeMenu() {
      if (!topicRoot || !topicButton || !topicList) return;
      topicRoot.classList.remove('otkryt');
      topicList.setAttribute('hidden', '');
      topicButton.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
      if (!topicRoot || !topicButton || !topicList) return;
      topicRoot.classList.add('otkryt');
      topicList.removeAttribute('hidden');
      topicButton.setAttribute('aria-expanded', 'true');
      var active = topicOptions.find(function (opt) { return opt.classList.contains('aktivny'); });
      if (active) active.focus();
    }

    if (topicButton && topicList && topicInput && topicText) {
      topicButton.addEventListener('click', function (e) {
        e.stopPropagation();
        if (topicList.hasAttribute('hidden')) {
          openMenu();
        } else {
          closeMenu();
        }
      });

      topicOptions.forEach(function (option) {
        option.addEventListener('click', function () {
          topicInput.value = option.dataset.value;
          topicText.textContent = option.textContent;
          topicOptions.forEach(function (item) {
            var isActive = item === option;
            item.classList.toggle('aktivny', isActive);
            item.setAttribute('aria-selected', isActive ? 'true' : 'false');
          });
          closeMenu();
          topicButton.focus();
        });
      });

      topicList.addEventListener('keydown', function (e) {
        var focused = document.activeElement;
        var index = topicOptions.indexOf(focused);
        if (e.key === 'Escape') {
          e.preventDefault();
          closeMenu();
          topicButton.focus();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          var next = (index + 1) % topicOptions.length;
          topicOptions[next].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          var prev = (index - 1 + topicOptions.length) % topicOptions.length;
          topicOptions[prev].focus();
        }
      });

      document.addEventListener('click', function (e) {
        if (topicRoot && !topicRoot.contains(e.target)) {
          closeMenu();
        }
      });
    }

    // === ПОЛУЧАЕМ ПОЛЬЗОВАТЕЛЯ БЕЗ ЗАПРОСА К СЕРВЕРУ ===
    var user = null;
    if (typeof EcoAuth !== 'undefined' && EcoAuth.getUser) {
      try {
        user = EcoAuth.getUser(); // читаем только из sessionStorage
      } catch (_) {
        user = null;
      }
    }
    if (user) {
      document.getElementById('svyazImya').value = user.name || '';
      document.getElementById('svyazEmail').value = user.email || '';
    }

    // === ОТПРАВКА ФОРМЫ ===
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = document.getElementById('svyazTekst').value.trim();
      if (!text) {
        if (message) {
          message.textContent = 'Напишите сообщение';
          message.dataset.state = 'error';
          message.hidden = false;
        }
        return;
      }

      if (typeof EcoAuth !== 'undefined' && EcoAuth.saveFeedback) {
        EcoAuth.saveFeedback({
          name: document.getElementById('svyazImya').value.trim(),
          email: document.getElementById('svyazEmail').value.trim(),
          type: document.getElementById('svyazTip').value,
          text: text
        });
      } else {
        console.log('Обратная связь:', {
          name: document.getElementById('svyazImya').value.trim(),
          email: document.getElementById('svyazEmail').value.trim(),
          type: document.getElementById('svyazTip').value,
          text: text
        });
      }

      document.getElementById('svyazTekst').value = '';
      if (message) {
        message.textContent = 'Сообщение отправлено';
        message.dataset.state = 'success';
        message.hidden = false;
      }
    });
  });
})();
