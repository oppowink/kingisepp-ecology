// smart-search.js — FAQ-аккордеон и локальный поиск без внешнего API
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function terms(value) {
    return normalize(value).split(' ').filter(function (word) { return word.length > 2; });
  }

  function searchFaq(query) {
    var words = terms(query);
    if (!words.length) return [];
    return (window.ECO_FAQ || []).map(function (item) {
      var question = normalize(item.question);
      var answer = normalize(item.answer);
      var score = words.reduce(function (sum, word) {
        return sum + (question.includes(word) ? 3 : 0) + (answer.includes(word) ? 1 : 0);
      }, 0);
      return { item: item, score: score };
    }).filter(function (match) { return match.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3).map(function (match) { return match.item; });
  }

  function initAccordion() {
    var list = document.getElementById('faqList');
    if (!list || !Array.isArray(window.ECO_FAQ)) return;
    list.innerHTML = window.ECO_FAQ.map(function (item, index) {
      var answerId = 'faqAnswer' + index;
      return '<article class="faq-element"><h2><button aria-controls="' + answerId + '" aria-expanded="false" class="faq-vopros" type="button">' + escapeHtml(item.question) + '</button></h2><div class="faq-otvet" hidden id="' + answerId + '"><p>' + escapeHtml(item.answer) + '</p></div></article>';
    }).join('');
    list.querySelectorAll('.faq-vopros').forEach(function (button) {
      button.addEventListener('click', function () {
        var answer = document.getElementById(button.getAttribute('aria-controls'));
        var expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        if (answer) answer.hidden = expanded;
      });
    });
  }

  function initHomeSearch() {
    var input = document.getElementById('smartSearchInput');
    var button = document.getElementById('smartSearchButton');
    var results = document.getElementById('smartSearchResults');
    if (!input || !button || !results || !Array.isArray(window.ECO_FAQ)) return;

    function run() {
      var query = input.value.trim();
      if (!query) {
        results.innerHTML = '<p class="glavnaya-poisk__net">Введите вопрос, например «сколько нужно листьев».</p>';
        return;
      }
      var found = searchFaq(query);
      if (!found.length) {
        results.innerHTML = '<p class="glavnaya-poisk__net">Точного ответа пока нет. Посмотрите <a href="faq.html">все вопросы</a> или напишите через <a href="feedback.html">обратную связь</a>.</p>';
        return;
      }
      results.innerHTML = found.map(function (item) {
        return '<article class="glavnaya-poisk__rezultat"><h3>' + escapeHtml(item.question) + '</h3><p>' + escapeHtml(item.answer) + '</p></article>';
      }).join('');
    }

    button.addEventListener('click', run);
    input.addEventListener('keydown', function (event) { if (event.key === 'Enter') run(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initAccordion();
    initHomeSearch();
  });
})();
