// header.js — шапка, настройки и навигация
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
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

    // если в sessionStorage есть пользователь с ролью модератора — добавляем ссылку на модерацию
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
