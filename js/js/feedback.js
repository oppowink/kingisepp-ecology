// feedback.js — форма обратной связи (локальное сохранение до подключения API)
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('formaObratnoySvyazi');
    var message = document.getElementById('svyazSoobshchenie');
    if (!form) return;

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
      var active = topicOptions.find(function (opt) {
        return opt.classList.contains('aktivny');
      });
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

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var textEl = document.getElementById('svyazTekst');
      var text = textEl ? textEl.value.trim() : '';
      if (!text) {
        if (message) {
          message.textContent = 'Напишите сообщение';
          message.dataset.state = 'error';
          message.hidden = false;
        }
        return;
      }

      var payload = {
        name: (document.getElementById('svyazImya') && document.getElementById('svyazImya').value || '').trim(),
        email: (document.getElementById('svyazEmail') && document.getElementById('svyazEmail').value || '').trim(),
        type: (document.getElementById('svyazTip') && document.getElementById('svyazTip').value) || '',
        text: text
      };

      try {
        if (typeof EcoAuth !== 'undefined' && typeof EcoAuth.saveFeedback === 'function') {
          EcoAuth.saveFeedback(payload);
        } else {
          console.log('Обратная связь (нет EcoAuth):', payload);
        }

        if (textEl) textEl.value = '';
        if (message) {
          message.textContent = 'Сообщение сохранено локально. После подключения сервера оно будет уходить в общую базу.';
          message.dataset.state = 'success';
          message.hidden = false;
        }
      } catch (err) {
        if (message) {
          message.textContent = 'Не удалось сохранить сообщение';
          message.dataset.state = 'error';
          message.hidden = false;
        }
      }
    });
  });
})();
