// header.js, шапка, настройки и навигация
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var header = document.querySelector('.shapka');
    if (header && !header.querySelector('.shapka-logo__nazvanie')) {
      header.innerHTML = '<a aria-label="ЭкоБиоМониторинг, на главную" class="shapka-logo" href="index.html"><span class="shapka-logo__nazvanie"><span class="shapka-logo__bukva">Э</span><span class="shapka-logo__bukva">к</span><img alt="" aria-hidden="true" class="shapka-logo__list shapka-logo__list--1" src="img/leaf1.png"><span class="shapka-logo__bukva">Б</span><span class="shapka-logo__bukva">и</span><img alt="" aria-hidden="true" class="shapka-logo__list shapka-logo__list--2" src="img/leaf2.png"><span class="shapka-logo__bukva">М</span><span class="shapka-logo__bukva">о</span><span class="shapka-logo__bukva">н</span><span class="shapka-logo__bukva">и</span><span class="shapka-logo__bukva">т</span><span class="shapka-logo__bukva">о</span><span class="shapka-logo__bukva">р</span><span class="shapka-logo__bukva">и</span><span class="shapka-logo__bukva">н</span><span class="shapka-logo__bukva">г</span></span></a><div class="shapka-deystviya"><a class="shapka-ssylka" href="account.html"><img alt="" aria-hidden="true" class="shapka-ssylka__ikona" src="img/icons/user.png"><span>Личный кабинет</span></a><button aria-controls="nastroikiPanel" aria-expanded="false" aria-label="Открыть настройки" class="nastroiki-knopka" id="nastroikiKnopka" type="button"><img alt="" aria-hidden="true" class="nastroiki-knopka__ikona" src="img/icons/gear.png"><span class="nastroiki-knopka__tekst">Настройки</span></button></div>';
    }

    var createdPanel = false;
    if (!document.getElementById('nastroikiFon')) {
      var newOverlay = document.createElement('div');
      newOverlay.className = 'nastroiki-fon';
      newOverlay.id = 'nastroikiFon';
      newOverlay.setAttribute('aria-hidden', 'true');
      document.body.prepend(newOverlay);
    }
    if (!document.getElementById('nastroikiPanel')) {
      createdPanel = true;
      var newPanel = document.createElement('aside');
      newPanel.className = 'nastroiki-panel';
      newPanel.id = 'nastroikiPanel';
      newPanel.setAttribute('aria-label', 'Настройки');
      newPanel.setAttribute('aria-hidden', 'true');
      newPanel.innerHTML = '<button aria-label="Закрыть настройки" class="nastroiki-zakryt" id="nastroikiZakryt" type="button"><img alt="" aria-hidden="true" src="img/icons/close.png"><span class="sr-only">Закрыть</span></button><div class="tema-vybor-blok"><p class="tema-podpis">Тема</p><div class="tema-vybor"><button class="tema-knopka" id="temaSvetlaya" type="button"><img alt="" aria-hidden="true" src="img/icons/sun.png"><span>Светлая</span></button><button class="tema-knopka" id="temaTemnaya" type="button"><img alt="" aria-hidden="true" src="img/icons/moon.png"><span>Тёмная</span></button></div></div><div class="nastroiki-akkaunt"><a class="nastroiki-ssylka nastroiki-ssylka--akcent" href="account.html"><img alt="" aria-hidden="true" src="img/icons/user.png"><span>Личный кабинет</span></a></div><nav aria-label="Навигация" class="nastroiki-navigaciya"><a class="nastroiki-ssylka" href="index.html">Главная</a><a class="nastroiki-ssylka" href="map.html">Карта</a><a class="nastroiki-ssylka" href="faq.html">Вопросы и ответы</a><a class="nastroiki-ssylka" href="games.html">Игры</a><a class="nastroiki-ssylka" href="about.html">О проекте и авторе</a><a class="nastroiki-ssylka" href="feedback.html">Обратная связь</a></nav>';
      document.body.appendChild(newPanel);
    }

    if (!document.querySelector('.bokovye-listya')) {
      var sideLeaves = document.createElement('div');
      sideLeaves.className = 'bokovye-listya';
      sideLeaves.setAttribute('aria-hidden', 'true');
      sideLeaves.innerHTML = '<div class="bokovye-listya__storona bokovye-listya__storona--levo"><img src="img/leaf1.png" alt=""><img src="img/leaf2.png" alt=""><img src="img/leaf3.png" alt=""><img src="img/leaf4.png" alt=""></div><div class="bokovye-listya__storona bokovye-listya__storona--pravo"><img src="img/leaf4.png" alt=""><img src="img/leaf3.png" alt=""><img src="img/leaf2.png" alt=""><img src="img/leaf1.png" alt=""></div>';
      document.body.appendChild(sideLeaves);
    }

    if (createdPanel && window.EcoTheme) {
      document.getElementById('temaSvetlaya')?.addEventListener('click', function () { window.EcoTheme.applyTheme('light', true); });
      document.getElementById('temaTemnaya')?.addEventListener('click', function () { window.EcoTheme.applyTheme('dark', true); });
      window.EcoTheme.applyTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light', false);
    }

    // элементы панели
    var panel = document.getElementById('nastroikiPanel');
    var overlay = document.getElementById('nastroikiFon');
    var openButton = document.getElementById('nastroikiKnopka');
    var closeButton = document.getElementById('nastroikiZakryt');
    if (!panel || !overlay || !openButton) return;

    var previousFocus = null;
    var currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var nav = panel.querySelector('.nastroiki-navigaciya');

    // Общедоступные страницы добавляются перед двумя завершающими ссылками.
    function insertNavLink(href, text, dataName, beforeSelector) {
      if (!nav || nav.querySelector('[href="' + href + '"]')) return;
      var link = document.createElement('a');
      link.href = href;
      link.className = 'nastroiki-ssylka';
      link.textContent = text;
      if (dataName) link.dataset[dataName] = '';
      var before = nav.querySelector(beforeSelector || '[href="feedback.html"]');
      nav.insertBefore(link, before || null);
    }
    insertNavLink('faq.html', 'Вопросы и ответы', '', '[href="about.html"], [href="feedback.html"]');
    insertNavLink('games.html', 'Игры', '', '[href="about.html"], [href="feedback.html"]');
    insertNavLink('about.html', 'О проекте и авторе');

    // подсветка текущей страницы в навигации
    panel.querySelectorAll('.nastroiki-navigaciya a').forEach(function (link) {
      var target = (link.getAttribute('href') || '').split('?')[0].toLowerCase();
      var active = target === currentPage;
      link.classList.toggle('nastroiki-ssylka--aktivna', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    // собираем фокусируемые элементы внутри панели
    function focusableItems() {
      return Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(function (node) { return !node.hidden && node.offsetParent !== null; });
    }

    // открыть/закрыть панель
    function setOpen(open) {
      panel.classList.toggle('otkryta', open);
      overlay.classList.toggle('vidim', open);
      panel.setAttribute('aria-hidden', String(!open));
      overlay.setAttribute('aria-hidden', String(!open));
      openButton.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';

      if (open) {
        previousFocus = document.activeElement;
        window.setTimeout(function () { closeButton?.focus({ preventScroll: true }); }, 20);
      } else if (previousFocus instanceof HTMLElement) {
        previousFocus.focus({ preventScroll: true });
      }
    }

    // обработчики кликов
    openButton.addEventListener('click', function () { setOpen(!panel.classList.contains('otkryta')); });
    overlay.addEventListener('click', function () { setOpen(false); });
    closeButton?.addEventListener('click', function () { setOpen(false); });

    // клавиатура: Escape закрывает, Tab ловит внутри панели
    document.addEventListener('keydown', function (event) {
      if (!panel.classList.contains('otkryta')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      var items = focusableItems();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    // если в sessionStorage есть пользователь с ролью модератора, добавляем ссылку на модерацию
    try {
      var cached = JSON.parse(sessionStorage.getItem('eco-preview-user-v1') || sessionStorage.getItem('eco-session-user-v1') || 'null');
      if (cached && ['moderator', 'admin'].includes(cached.role) && nav && !nav.querySelector('[data-moderator-link]')) {
        insertNavLink('moderator.html', 'Модерация', 'moderatorLink', '[href="about.html"]');
      }
      if (cached && cached.role === 'curator' && nav && !nav.querySelector('[data-curator-link]')) {
        insertNavLink('education-curator.html', 'Обучение куратора', 'curatorEducationLink', '[href="about.html"]');
        insertNavLink('curator.html', 'Кабинет куратора', 'curatorLink', '[href="about.html"]');
      }
      // Повторяем подсветку после добавления ссылок, зависящих от роли.
      panel.querySelectorAll('.nastroiki-navigaciya a').forEach(function (link) {
        var target = (link.getAttribute('href') || '').split('?')[0].toLowerCase();
        var active = target === currentPage;
        link.classList.toggle('nastroiki-ssylka--aktivna', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    } catch (_) {}
  });
})();
