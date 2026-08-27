// education.js — переключение слайдов обучения
(function () {
  'use strict';

  // минимальное время просмотра слайда (6 секунд) — нельзя пролистать быстрее
  var MIN_VIEW_MS = 6000;

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

    var slides = Array.from(document.querySelectorAll('[data-obuchenie-slajd]'));
    var counter = document.getElementById('obuchenieSchetchik');
    var back = document.getElementById('obuchenieNazad');
    var next = document.getElementById('obuchenieDalshe');
    var complete = document.getElementById('obuchenieZavershit');
    var done = document.getElementById('obuchenieZaversheno');
    if (!slides.length || !counter || !back || !next || !complete) return;

    var current = 0;
    var viewed = new Set();
    var elapsed = 0;
    var startedAt = performance.now();
    var timer = null;

    function currentKey() { return Number(slides[current].dataset.obuchenieSlajd); }

    // останавливаем таймер, учитываем время, если окно не скрыто
    function stopTimer() {
      if (timer) window.clearInterval(timer);
      timer = null;
      if (!document.hidden) elapsed += performance.now() - startedAt;
    }

    // запускаем таймер — каждые 180 мс проверяем, не прошло ли MIN_VIEW_MS
    function startTimer(resetElapsed) {
      if (resetElapsed) elapsed = viewed.has(currentKey()) ? MIN_VIEW_MS : 0;
      startedAt = performance.now();
      timer = window.setInterval(function () {
        if (document.hidden || viewed.has(currentKey())) return;
        var total = elapsed + performance.now() - startedAt;
        if (total >= MIN_VIEW_MS) {
          viewed.add(currentKey());
          updateControls();
          stopTimer();
        }
      }, 180);
    }

    // обновление состояния кнопок и счётчика
    function updateControls() {
      var ready = viewed.has(currentKey());
      counter.textContent = (current + 1) + ' из ' + slides.length;
      back.disabled = current === 0;
      next.hidden = current === slides.length - 1;
      complete.hidden = current !== slides.length - 1;
      next.disabled = !ready;
      complete.disabled = !(ready && viewed.size === slides.length);
    }

    // переключение на конкретный слайд
    function render(index) {
      stopTimer();
      current = index;
      slides.forEach(function (slide, slideIndex) { slide.hidden = slideIndex !== current; });
      updateControls();
      startTimer(true);
    }

    // если вкладка скрыта — останавливаем таймер, иначе продолжаем
    document.addEventListener('visibilitychange', function () {
      if (viewed.has(currentKey())) return;
      if (document.hidden) stopTimer();
      else startTimer(false);
    });

    // кнопки
    back.addEventListener('click', function () { if (current > 0) render(current - 1); });
    next.addEventListener('click', function () { if (!next.disabled && current < slides.length - 1) render(current + 1); });
    complete.addEventListener('click', function () {
      if (complete.disabled) return;
      EcoAuth.completeEducation();
      document.getElementById('obuchenieEkran').hidden = true;
      document.querySelector('.obuchenie-upravlenie').hidden = true;
      counter.hidden = true;
      if (done) done.hidden = false;
    });

    render(0);
  });
})();