(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('formaObratnoySvyazi');
    var message = document.getElementById('svyazSoobshchenie');
    var submitButton = form ? form.querySelector('[type="submit"]') : null;
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

    function showMessage(text, state) {
      if (!message) return;
      message.textContent = text || '';
      message.dataset.state = state || '';
      message.hidden = !text;
    }

    function setBusy(busy) {
      if (!submitButton) return;
      submitButton.disabled = Boolean(busy);
      submitButton.textContent = busy ? 'Отправляем...' : 'Отправить';
    }

    function validEmail(email) {
      return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      showMessage('');

      var name = document.getElementById('svyazImya').value.trim();
      var email = document.getElementById('svyazEmail').value.trim();
      var type = document.getElementById('svyazTip').value;
      var text = document.getElementById('svyazTekst').value.trim();

      if (text.length < 3 || text.length > 3000) {
        showMessage('Напишите сообщение от 3 до 3000 символов', 'error');
        document.getElementById('svyazTekst').focus();
        return;
      }
      if (!validEmail(email)) {
        showMessage('Проверьте e-mail или оставьте поле пустым', 'error');
        document.getElementById('svyazEmail').focus();
        return;
      }

      setBusy(true);
      try {
        var payload = {
          name: name || null,
          email: email || null,
          topic: type || 'idea',
          message: text,
          page_url: location.href,
          user_agent: navigator.userAgent
        };
        var response = await fetch(String(window.ECO_API_BASE || (location.hostname === 'oppowink.github.io' ? 'https://kingisepp-ecology.vercel.app' : '')).replace(/\/$/, '') + '/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(response.status === 429 ? 'RATE_LIMITED' : 'FEEDBACK_UNAVAILABLE');
        form.reset();
        if (topicInput && topicText && topicOptions.length) {
          topicInput.value = 'idea';
          topicText.textContent = 'Предложение';
          topicOptions.forEach(function (item) {
            var isActive = item.dataset.value === 'idea';
            item.classList.toggle('aktivny', isActive);
            item.setAttribute('aria-selected', isActive ? 'true' : 'false');
          });
        }
        showMessage('Сообщение отправлено. Спасибо!', 'success');
      } catch (error) {
        showMessage(error.message === 'RATE_LIMITED' ? 'Сообщений слишком много. Попробуйте через час' : 'Сообщение не отправилось. Текст сохранён в форме, попробуйте ещё раз', 'error');
      } finally {
        setBusy(false);
      }
    });
  });
})();
