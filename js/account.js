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
    var passwordConfirmGroup = document.getElementById('vhodParolPovtorGruppa');
    var passwordConfirmInput = document.getElementById('vhodParolPovtor');
    var passwordHint = document.getElementById('vhodParolPodskazka');
    var submitButton = document.getElementById('vhodPasswordKnopka');
    var message = document.getElementById('vhodSoobshchenie');
    var logoutButton = document.getElementById('vyhodKnopka');
    var educationStatus = document.getElementById('kabinetObuchenie');
    var userInfo = document.querySelector('.kabinet-polzovatel');
    var cabinetNav = document.getElementById('kabinetNavigaciya');
    var educationLink = document.getElementById('ssylkaObuchenie');
    var submitLink = document.getElementById('ssylkaPodacha');
    var myRequestsLink = document.getElementById('ssylkaMoiZayavki');
    var feedbackLink = document.getElementById('ssylkaFeedback');
    var moderatorLink = document.getElementById('ssylkaModerator');
    var curatorEducationLink = document.getElementById('ssylkaObuchenieKuratora');
    var curatorLink = document.getElementById('ssylkaKurator');
    var profileSection = document.getElementById('kabinetProfil');
    var cityForm = document.getElementById('profilGorodForma');
    var cityInput = document.getElementById('profilGorod');
    var organizationForm = document.getElementById('profilOrganizaciyaForma');
    var organizationCode = document.getElementById('profilKodOrganizacii');
    var organizationList = document.getElementById('profilOrganizaciiSpisok');
    var profileMessage = document.getElementById('profilSoobshchenie');
    var certificateSection = document.querySelector('.kabinet-sertifikat');
    var certificateText = document.getElementById('sertifikatTekst');
    var certificateButton = document.getElementById('sertifikatVolonteraKnopka');
    var certificateMessage = document.getElementById('sertifikatSoobshchenie');
    var roleTestBlock = document.getElementById('kabinetRoliTest');
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

    function passwordProblems(password) {
      var problems = [];
      if (password.length < 8) problems.push('минимум 8 символов');
      if (!/[A-ZА-ЯЁ]/.test(password)) problems.push('заглавная буква');
      if (!/[a-zа-яё]/.test(password)) problems.push('строчная буква');
      if (!/\d/.test(password)) problems.push('цифра');
      if (!/[^A-Za-zА-Яа-яЁё0-9]/.test(password)) problems.push('спецсимвол');
      return problems;
    }

    function showCertificateMessage(text, state) {
      if (!certificateMessage) return;
      certificateMessage.textContent = text || '';
      certificateMessage.dataset.state = state || '';
      certificateMessage.hidden = !text;
    }

    function showProfileMessage(text, state) {
      if (!profileMessage) return;
      profileMessage.textContent = text || '';
      profileMessage.dataset.state = state || '';
      profileMessage.hidden = !text;
    }

    function renderOrganizations(context) {
      if (!organizationList) return;
      organizationList.replaceChildren();
      var memberships = Array.isArray(context?.memberships) ? context.memberships : [];
      if (!memberships.length) {
        var empty = document.createElement('p');
        empty.className = 'kabinet-organizacii__pusto';
        empty.textContent = 'Вы пока не прикреплены к организации. Код можно получить у куратора.';
        organizationList.appendChild(empty);
        return;
      }
      memberships.forEach(function (membership) {
        var row = document.createElement('div');
        row.className = 'kabinet-organizaciya';
        var text = document.createElement('p');
        var organization = membership.organization || {};
        text.textContent = organization.name || 'Организация';
        var meta = document.createElement('small');
        meta.textContent = [organization.city, membership.memberRole === 'curator' ? 'куратор' : 'участник'].filter(Boolean).join(' · ');
        text.appendChild(meta);
        var leave = document.createElement('button');
        leave.className = 'knopka-tekst';
        leave.type = 'button';
        leave.textContent = 'Открепиться';
        leave.dataset.leaveOrganization = membership.organizationId;
        row.append(text, leave);
        organizationList.appendChild(row);
      });
    }

    async function loadParticipationProfile(user) {
      if (!user || !profileSection || !['participant', 'curator'].includes(user.role)) return;
      try {
        var context = await EcoAuth.getParticipationContext();
        if (cityInput) cityInput.value = context?.profile?.city || user.city || '';
        renderOrganizations(context);
      } catch (_) {
        showProfileMessage('Не удалось загрузить организации. Проверьте миграцию 005 в Supabase.', 'error');
      }
    }

    function render(user) {
      loginBlock.hidden = Boolean(user);
      cabinetBlock.hidden = !user;
      if (!user) return;

      var nameEl = document.getElementById('kabinetImya');
      var emailEl = document.getElementById('kabinetEmail');
      var countEl = document.getElementById('kolichestvoZayavok');
      var educationDone = EcoAuth.isEducationCompleted(user.email);
      var approvedRequest = EcoAuth.getFirstApprovedRequest();
      var role = user.role || 'participant';
      var chooseRole = EcoAuth.canSwitchRoleForTesting && EcoAuth.canSwitchRoleForTesting(user);

      if (nameEl) nameEl.textContent = user.name || 'Участник';
      if (emailEl) emailEl.textContent = user.email || '';
      if (userInfo) userInfo.hidden = chooseRole;
      if (cabinetNav) cabinetNav.hidden = chooseRole;
      if (certificateSection) certificateSection.hidden = chooseRole || role !== 'participant';
      if (profileSection) profileSection.hidden = chooseRole || !['participant', 'curator'].includes(role);
      if (roleTestBlock) roleTestBlock.hidden = !chooseRole;
      if (chooseRole) return;

      if (educationStatus) {
        var record = EcoAuth.getEducationRecord(user.email);
        if (role === 'participant') {
          educationStatus.textContent = educationDone
            ? 'Обучение волонтёра пройдено' + (record?.score ? ': ' + record.score + '/' + record.total : '')
            : 'Добавление точки откроется после основного подтверждающего теста';
          educationStatus.dataset.state = educationDone ? 'success' : 'warning';
          educationStatus.hidden = false;
        } else {
          educationStatus.textContent = role === 'admin'
            ? 'Режим администратора'
            : role === 'moderator' ? 'Режим модератора' : 'Режим куратора';
          educationStatus.dataset.state = 'success';
          educationStatus.hidden = false;
        }
      }
      if (educationLink) educationLink.hidden = role !== 'participant';
      if (submitLink) submitLink.hidden = role !== 'participant';
      if (myRequestsLink) myRequestsLink.hidden = role !== 'participant';
      if (feedbackLink) feedbackLink.hidden = true;
      if (moderatorLink) {
        moderatorLink.hidden = !['moderator', 'admin'].includes(role);
        moderatorLink.textContent = role === 'admin' ? 'Админка' : 'Проверка заявок';
      }
      if (curatorEducationLink) curatorEducationLink.hidden = role !== 'curator';
      if (curatorLink) curatorLink.hidden = role !== 'curator';
      if (submitLink) {
        submitLink.classList.toggle('kabinet-navigaciya__ssylka--disabled', !educationDone);
        submitLink.setAttribute('aria-disabled', String(!educationDone));
      }
      if (certificateText) {
        certificateText.textContent = educationDone && approvedRequest
          ? 'Можно сформировать сертификат по опубликованной точке: ' + approvedRequest.title + '.'
          : 'Сертификат доступен после обучения и публикации первой точки.';
      }
      if (countEl) {
        var requestCount = EcoAuth.getMyRequests().length;
        countEl.textContent = requestCount ? String(requestCount) : '';
      }
      loadParticipationProfile(user);
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
      if (passwordConfirmGroup) passwordConfirmGroup.hidden = !registering;
      if (passwordConfirmInput) {
        passwordConfirmInput.required = registering;
        passwordConfirmInput.value = '';
      }

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
      if (code === 'WEAK_PASSWORD') return 'Пароль должен содержать минимум 8 символов, заглавную и строчную буквы, цифру и спецсимвол.';
      if (code === 'PASSWORD_MISMATCH') return 'Пароли не совпадают.';
      if (code === 'ACCOUNT_EXISTS') return 'Аккаунт с таким e-mail уже существует. Переключитесь на вход.';
      if (code === 'INVALID_CREDENTIALS') return 'Неверный e-mail или пароль.';
      if (code === 'ACCOUNT_BLOCKED') return 'Аккаунт заблокирован администратором.';
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
      var passwordConfirm = passwordConfirmInput ? passwordConfirmInput.value : '';
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
      if (mode === 'register') {
        var problems = passwordProblems(password);
        if (problems.length) {
          showMessage('Пароль должен содержать: ' + problems.join(', ') + '.', 'error');
          passwordInput.focus();
          return;
        }
        if (password !== passwordConfirm) {
          showMessage('Пароли не совпадают.', 'error');
          if (passwordConfirmInput) passwordConfirmInput.focus();
          return;
        }
      }
      if (mode === 'register' && (!nameInput || !nameInput.checkValidity())) {
        showMessage('Укажите имя длиной от 2 до 80 символов.', 'error');
        if (nameInput) nameInput.focus();
        return;
      }

      setBusy(true);
      try {
        var user = mode === 'register'
          ? await EcoAuth.registerWithPassword({
              email: email,
              password: password,
              passwordConfirm: passwordConfirm,
              name: name
            })
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

    if (cityForm) {
      cityForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var city = cityInput ? cityInput.value.trim() : '';
        if (!city) {
          showProfileMessage('Укажите город.', 'error');
          return;
        }
        try {
          await EcoAuth.saveProfileCity(city);
          await EcoAuth.refreshUser();
          showProfileMessage('Город сохранён.', 'success');
        } catch (_) {
          showProfileMessage('Не удалось сохранить город.', 'error');
        }
      });
    }

    if (organizationForm) {
      organizationForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var code = organizationCode ? organizationCode.value.trim() : '';
        if (!code) return;
        try {
          await EcoAuth.joinOrganization(code);
          organizationForm.reset();
          showProfileMessage('Вы прикреплены к организации.', 'success');
          await loadParticipationProfile(EcoAuth.getUser());
        } catch (error) {
          showProfileMessage(error.message === 'ORGANIZATION_NOT_FOUND'
            ? 'Организация с таким кодом не найдена.'
            : 'Не удалось прикрепиться к организации.', 'error');
        }
      });
    }

    if (organizationList) {
      organizationList.addEventListener('click', async function (event) {
        var button = event.target.closest('[data-leave-organization]');
        if (!button) return;
        button.disabled = true;
        try {
          await EcoAuth.leaveOrganization(button.dataset.leaveOrganization);
          showProfileMessage('Вы открепились от организации.', 'success');
          await loadParticipationProfile(EcoAuth.getUser());
        } catch (_) {
          button.disabled = false;
          showProfileMessage('Не удалось открепиться от организации.', 'error');
        }
      });
    }

    if (submitLink) {
      submitLink.addEventListener('click', function (event) {
        var user = EcoAuth.getUser();
        if (user && !EcoAuth.isEducationCompleted(user.email)) {
          event.preventDefault();
          showCertificateMessage('Сначала пройдите обучение волонтёра и тест.', 'error');
        }
      });
    }

    if (certificateButton) {
      certificateButton.addEventListener('click', function () {
        var user = EcoAuth.getUser();
        var approvedRequest = EcoAuth.getFirstApprovedRequest();
        if (!user || !EcoAuth.isEducationCompleted(user.email) || !approvedRequest) {
          showCertificateMessage('Пройдите обучение и получите подтверждение первой точки', 'error');
          return;
        }
        var opened = EcoAuth.openVolunteerCertificate({
          user: user,
          pointTitle: approvedRequest.title,
          date: new Date().toLocaleDateString('ru-RU')
        });
        showCertificateMessage(opened ? 'Сертификат открыт в новой вкладке.' : 'Разрешите открытие новой вкладки для сертификата.', opened ? 'success' : 'error');
      });
    }

    document.querySelectorAll('[data-test-role]').forEach(function (button) {
      button.addEventListener('click', function () {
        var role = button.getAttribute('data-test-role');
        var user = EcoAuth.switchRoleForTesting && EcoAuth.switchRoleForTesting(role);
        if (!user) {
          showMessage('Тестовые роли доступны только администратору.', 'error');
          return;
        }
        if (role === 'moderator' || role === 'admin') {
          location.href = 'moderator.html';
          return;
        }
        if (role === 'curator') {
          location.href = localStorage.getItem('curatorEducationCompleted') === 'true'
            ? 'curator.html'
            : 'education-curator.html';
          return;
        }
        render(user);
      });
    });

    setMode('login');
    var user = await EcoAuth.refreshUser() || EcoAuth.getUser();
    if (user) {
      await EcoAuth.refreshEducationStatus();
      if (EcoAuth.refreshRequests) await EcoAuth.refreshRequests('mine');
      user = EcoAuth.getUser();
    }
    render(user);
  });
})();
