// account.js — регистрация, вход и личный кабинет
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    var loginBlock = document.getElementById('vhodBlok');
    var cabinetBlock = document.getElementById('kabinetBlok');
    var authForm = document.getElementById('vhodPasswordForma');
    var loginModeButton = document.getElementById('rezhimVhod');
    var registerModeButton = document.getElementById('rezhimRegistraciya');
    var nameGroup = document.getElementById('vhodImyaGruppa');
    var nameInput = document.getElementById('vhodImya');
    var emailInput = document.getElementById('vhodEmail');
    var passwordInput = document.getElementById('vhodParol');
    var passwordHint = document.getElementById('vhodParolPodskazka');
    var submitButton = document.getElementById('vhodPasswordKnopka');
    var message = document.getElementById('vhodSoobshchenie');
    var logoutButton = document.getElementById('vyhodKnopka');
    var mode = 'login';

    if (!loginBlock || !cabinetBlock || !authForm || !emailInput || !passwordInput) return;
    if (typeof EcoAuth === 'undefined') {
      if (message) {
        message.hidden = false;
        message.dataset.state = 'error';
        message.textContent = 'Не загрузился модуль входа. Обновите страницу.';
      }
      return;
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
      submitButton.textContent = busy
        ? (mode === 'register' ? 'Создаём аккаунт…' : 'Входим…')
        : (mode === 'register' ? 'Создать аккаунт' : 'Войти');
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
      if (modLink) modLink.hidden = !['moderator', 'admin'].includes(user.role);

      var next = nextPage();
      if (next) location.replace(next);
    }

    function setMode(nextMode) {
      mode = nextMode === 'register' ? 'register' : 'login';
      var registering = mode === 'register';

      if (nameGroup) nameGroup.hidden = !registering;
      if (nameInput) {
        nameInput.required = registering;
        nameInput.autocomplete = 'name';
      }
      passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
      if (passwordHint) passwordHint.hidden = !registering;

      if (loginModeButton) {
        loginModeButton.classList.toggle('vhod-rezhim--aktivnyy', !registering);
        loginModeButton.setAttribute('aria-pressed', String(!registering));
      }
      if (registerModeButton) {
        registerModeButton.classList.toggle('vhod-rezhim--aktivnyy', registering);
        registerModeButton.setAttribute('aria-pressed', String(registering));
      }

      showMessage('');
      setBusy(false);
    }

    function authError(error) {
      var code = String(error && error.message || '');
      if (code === 'BACKEND_NOT_CONFIGURED') {
        return 'Сервер входа недоступен. Откройте сайт через опубликованный адрес Vercel.';
      }
      if (code === 'INVALID_EMAIL') return 'Проверьте адрес электронной почты.';
      if (code === 'INVALID_NAME') return 'Укажите имя длиной от 2 до 80 символов.';
      if (code === 'WEAK_PASSWORD') return 'Пароль должен содержать не менее 8 символов.';
      if (code === 'ACCOUNT_EXISTS') return 'Аккаунт с таким e-mail уже существует. Переключитесь на вход.';
      if (code === 'INVALID_CREDENTIALS') return 'Неверный e-mail или пароль.';
      if (code === 'CREDENTIALS_REQUIRED') return 'Введите e-mail и пароль.';
      if (code === 'REGISTRATION_FAILED') return 'Не удалось создать аккаунт. Проверьте настройки Supabase на Vercel.';
      if (code === 'LOGIN_FAILED') return 'Не удалось выполнить вход. Попробуйте ещё раз.';
      if (code === 'Failed to fetch' || code === 'NetworkError') {
        return 'Сервер не отвечает. Проверьте опубликованную версию сайта.';
      }
      return 'Не удалось выполнить действие. Попробуйте ещё раз.';
    }

    if (loginModeButton) {
      loginModeButton.addEventListener('click', function () { setMode('login'); });
    }
    if (registerModeButton) {
      registerModeButton.addEventListener('click', function () { setMode('register'); });
    }

    authForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      showMessage('');

      var email = emailInput.value.trim();
      var password = passwordInput.value;
      var name = nameInput ? nameInput.value.trim() : '';

      if (!emailInput.checkValidity()) {
        showMessage('Проверьте адрес электронной почты.', 'error');
        emailInput.focus();
        return;
      }
      if (password.length < 8) {
        showMessage('Пароль должен содержать не менее 8 символов.', 'error');
        passwordInput.focus();
        return;
      }
      if (mode === 'register' && (!nameInput || !nameInput.checkValidity())) {
        showMessage('Укажите имя длиной от 2 до 80 символов.', 'error');
        if (nameInput) nameInput.focus();
        return;
      }

      setBusy(true);
      try {
        var user = mode === 'register'
          ? await EcoAuth.registerWithPassword({ email: email, password: password, name: name })
          : await EcoAuth.signInWithPassword({ email: email, password: password });
        authForm.reset();
        showMessage('');
        render(user);
      } catch (error) {
        console.error('passwordAuth', error);
        showMessage(authError(error), 'error');
      } finally {
        setBusy(false);
      }
    });

    if (logoutButton) {
      logoutButton.addEventListener('click', async function () {
        await EcoAuth.signOut();
        authForm.reset();
        setMode('login');
        render(null);
      });
    }

    setMode('login');
    var user = EcoAuth.getUser() || await EcoAuth.refreshUser();
    render(user);
  });
})();
