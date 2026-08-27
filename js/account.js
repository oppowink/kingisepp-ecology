// account.js — интерфейс входа и личного кабинета
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    // элементы страницы
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

    // === Скрытая кнопка разработчика ===
    var devBlock = document.getElementById('devLoginBlock');
    var devBtn = document.getElementById('devLoginBtn');

    if (!loginBlock || !cabinetBlock || !emailForm || !codeForm || !yandexButton) return;

    // вывод сообщения
    function showMessage(text, state) {
      if (!message) return;
      message.textContent = text || '';
      message.dataset.state = state || '';
      message.hidden = !text;
    }

    // URL для редиректа после входа
    function nextPage() {
      var value = new URLSearchParams(location.search).get('next');
      return value && /^[a-z0-9-]+\.html(?:\?.*)?$/i.test(value) ? value : '';
    }

    // отрисовка кабинета (скрыть/показать блоки, подставить имя)
    function render(user) {
      loginBlock.hidden = Boolean(user);
      cabinetBlock.hidden = !user;
      if (!user) return;

      document.getElementById('kabinetImya').textContent = user.name || 'Участник';
      document.getElementById('kabinetEmail').textContent = user.email || '';
      var requestCount = EcoAuth.getMyRequests().length;
      document.getElementById('kolichestvoZayavok').textContent = requestCount ? String(requestCount) : '';
      document.getElementById('ssylkaModerator').hidden = !['moderator', 'admin'].includes(user.role);

      var next = nextPage();
      if (next) location.replace(next);
    }

    // переключение между формой email и формой кода
    function setCodeMode(enabled) {
      emailForm.hidden = enabled;
      codeForm.hidden = !enabled;
      if (enabled) codeInput?.focus();
      else emailInput?.focus();
    }

    var authState = new URLSearchParams(location.search).get('auth');
    if (authState && authState !== 'ok') showMessage('Вход через Яндекс не завершён', 'error');

    // кнопка выхода
    logoutButton?.addEventListener('click', async function () {
      await EcoAuth.signOut();
      setCodeMode(false);
      render(null);
    });

    // === Логика скрытой кнопки разработчика ===
    if (emailInput && devBlock && devBtn) {
      emailInput.addEventListener('input', function () {
        var val = this.value.trim().toLowerCase();
        if (val === '@lozkp') {
          devBlock.hidden = false;
        } else {
          devBlock.hidden = true;
        }
      });

      devBtn.addEventListener('click', function () {
        // Создаём пользователя-разработчика
        var devUser = {
          id: 'dev-user',
          email: '@lozkp',
          name: 'Полинка',
          role: 'admin',
          preview: true
        };
        sessionStorage.setItem('eco-preview-user-v1', JSON.stringify(devUser));
        // Принудительно обновляем состояние, не перезагружая страницу
        render(devUser);
        // Скрываем блок входа, показываем кабинет
        document.getElementById('vhodBlok').hidden = true;
        document.getElementById('kabinetBlok').hidden = false;
      });
    }

    // обработчики форм и кнопок (опущены, так как в твоей версии они отсутствуют — ты их уже удалила)
  }); // закрываем document.addEventListener
})(); // закрываем внешнюю функцию