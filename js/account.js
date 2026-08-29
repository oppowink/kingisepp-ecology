// account.js — интерфейс входа и личного кабинета
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    var loginBlock = document.getElementById('vhodBlok');
    var cabinetBlock = document.getElementById('kabinetBlok');
    var emailForm = document.getElementById('vhodEmailForma');
    var codeForm = document.getElementById('vhodKodForma');
    var nameInput = document.getElementById('vhodImya');
    var emailInput = document.getElementById('vhodEmail');
    var codeInput = document.getElementById('vhodKod');
    var codeBack = document.getElementById('vhodKodNazad');
    var yandexButton = document.getElementById('vhodYandex');
    var message = document.getElementById('vhodSoobshchenie');
    var logoutButton = document.getElementById('vyhodKnopka');
    var previewBlock = document.getElementById('vhodPredprosmotr');
    var previewParticipant = document.getElementById('predprosmotrUchastnik');
    var previewModerator = document.getElementById('predprosmotrModerator');
    var devBlock = document.getElementById('devLoginBlock');
    var devBtn = document.getElementById('devLoginBtn');
    var emailSubmitBtn = document.getElementById('vhodEmailKod');
    var codeSubmitBtn = document.getElementById('vhodKodPodtverdit');

    if (!loginBlock || !cabinetBlock || !emailForm || !codeForm || !yandexButton) return;
    if (typeof EcoAuth === 'undefined') {
      if (message) {
        message.hidden = false;
        message.dataset.state = 'error';
        message.textContent = 'Не загрузился auth.js. Обновите страницу.';
      }
      return;
    }

    function showMessage(text, state) {
      if (!message) return;
      message.textContent = text || '';
      message.dataset.state = state || '';
      message.hidden = !text;
    }

    function setBusy(btn, busy, labelIdle) {
      if (!btn) return;
      btn.disabled = !!busy;
      if (busy) btn.textContent = 'Отправка…';
      else if (labelIdle) btn.textContent = labelIdle;
    }

    function nextPage() {
      var value = new URLSearchParams(location.search).get('next');
      return value && /^[a-z0-9-]+\.html(?:\?.*)?$/i.test(value) ? value : '';
    }

    function render(user) {
      loginBlock.hidden = Boolean(user);
      cabinetBlock.hidden = !user;
      if (!user) return;

      var nameEl = document.getElementById('kabinetImya');
      var emailEl = document.getElementById('kabinetEmail');
      var countEl = document.getElementById('kolichestvoZayavok');
      var modLink = document.getElementById('ssylkaModerator');

      if (nameEl) nameEl.textContent = user.name || 'Участник';
      if (emailEl) emailEl.textContent = user.email || '';
      if (countEl) {
        var requestCount = EcoAuth.getMyRequests().length;
        countEl.textContent = requestCount ? String(requestCount) : '';
      }
      if (modLink) {
        modLink.hidden = !['moderator', 'admin'].includes(user.role);
      }

      var next = nextPage();
      if (next) location.replace(next);
    }

    function setCodeMode(enabled) {
      emailForm.hidden = enabled;
      codeForm.hidden = !enabled;
      if (enabled) {
        if (codeInput) codeInput.focus();
      } else if (emailInput) {
        emailInput.focus();
      }
    }

    function backendHint(err) {
      var code = err && err.message ? String(err.message) : '';
      var extra = err && err.detail ? String(err.detail) : '';
      if (code === 'BACKEND_NOT_CONFIGURED') {
        return 'Сервер входа ещё не подключён. Используйте предпросмотр или вход разработчика.';
      }
      if (code === 'EMAIL_START_FAILED') {
        return 'Не удалось отправить код.' + (extra ? ' ' + extra : ' Проверьте e-mail и настройки Supabase.');
      }
      if (code === 'EMAIL_VERIFY_FAILED') {
        return 'Неверный или просроченный код. Запросите новый.';
      }
      if (code === 'Failed to fetch' || code === 'NetworkError') {
        return 'Нет ответа от /api. Проверьте деплой Vercel.';
      }
      return 'Не удалось выполнить вход: ' + (code || 'неизвестная ошибка');
    }

    var authState = new URLSearchParams(location.search).get('auth');
    if (authState && authState !== 'ok') {
      showMessage('Вход через Яндекс не завершён (' + authState + ')', 'error');
    }

    if (logoutButton) {
      logoutButton.addEventListener('click', async function () {
        await EcoAuth.signOut();
        setCodeMode(false);
        showMessage('');
        render(null);
      });
    }

    emailForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      event.stopPropagation();
      showMessage('Отправляем код…', '');

      var email = (emailInput && emailInput.value || '').trim();
      var name = (nameInput && nameInput.value || '').trim();
      if (!email) {
        showMessage('Укажите e-mail', 'error');
        if (emailInput) emailInput.focus();
        return;
      }

      setBusy(emailSubmitBtn, true, 'Получить код');
      try {
        await EcoAuth.startEmailLogin({ email: email, name: name });
        setCodeMode(true);
        showMessage('Если письмо настроено, код отправлен. Проверьте почту (и «Спам»). Введите код ниже.', 'success');
      } catch (err) {
        console.error('startEmailLogin', err);
        showMessage(backendHint(err), 'error');
      } finally {
        setBusy(emailSubmitBtn, false, 'Получить код');
      }
    });

    codeForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      event.stopPropagation();
      showMessage('Проверяем код…', '');

      var email = (emailInput && emailInput.value || '').trim();
      var name = (nameInput && nameInput.value || '').trim();
      var token = (codeInput && codeInput.value || '').trim();
      if (!token || token.length < 4) {
        showMessage('Введите код из письма', 'error');
        if (codeInput) codeInput.focus();
        return;
      }

      setBusy(codeSubmitBtn, true, 'Продолжить');
      try {
        var user = await EcoAuth.verifyEmailLogin({ email: email, token: token, name: name });
        showMessage('');
        render(user);
      } catch (err) {
        console.error('verifyEmailLogin', err);
        showMessage(backendHint(err), 'error');
      } finally {
        setBusy(codeSubmitBtn, false, 'Продолжить');
      }
    });

    if (codeBack) {
      codeBack.addEventListener('click', function () {
        setCodeMode(false);
        showMessage('');
        if (codeInput) codeInput.value = '';
      });
    }

    yandexButton.addEventListener('click', function () {
      showMessage('');
      try {
        EcoAuth.startYandexLogin();
      } catch (err) {
        showMessage(backendHint(err), 'error');
      }
    });

    if (EcoAuth.previewAvailable()) {
      if (previewBlock) previewBlock.hidden = false;
      function enterPreview(role) {
        var user = EcoAuth.startPreview(role);
        if (user) {
          showMessage('');
          render(user);
        }
      }
      if (previewParticipant) {
        previewParticipant.addEventListener('click', function () { enterPreview('participant'); });
      }
      if (previewModerator) {
        previewModerator.addEventListener('click', function () { enterPreview('moderator'); });
      }
    } else if (previewBlock) {
      previewBlock.hidden = true;
    }

    if (emailInput && devBlock && devBtn) {
      emailInput.addEventListener('input', function () {
        var val = this.value.trim().toLowerCase();
        devBlock.hidden = val !== '@lozkp';
      });
      devBtn.addEventListener('click', function () {
        var devUser = {
          id: 'dev-user',
          email: 'dev@kingisepp.local',
          name: 'Полинка',
          role: 'admin',
          preview: true
        };
        sessionStorage.setItem('eco-preview-user-v1', JSON.stringify(devUser));
        showMessage('');
        render(devUser);
      });
    }

    var user = EcoAuth.getUser() || await EcoAuth.refreshUser();
    render(user);
  });
})();
