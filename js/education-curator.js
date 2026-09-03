// education-curator.js — доступ по роли, задержка между слайдами и локальный флаг прохождения
(function () {
  'use strict';

  var STORAGE_KEY = 'curatorEducationCompleted';
  var SLIDE_DELAY_MS = 5000;

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

    var denied = document.getElementById('curatorEducationDenied');
    var course = document.getElementById('curatorEducationCourse');
    if (user.role !== 'curator') {
      denied.hidden = false;
      course.hidden = true;
      return;
    }

    denied.hidden = true;
    course.hidden = false;
    var slides = Array.from(document.querySelectorAll('[data-curator-slide]'));
    var counter = document.getElementById('curatorEducationCounter');
    var back = document.getElementById('curatorEducationBack');
    var next = document.getElementById('curatorEducationNext');
    var controls = document.getElementById('curatorEducationControls');
    var completed = localStorage.getItem(STORAGE_KEY) === 'true';
    var current = completed ? slides.length - 1 : 0;
    var timer = null;

    function clearDelay() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    }

    function startDelay() {
      clearDelay();
      if (current === slides.length - 1) return;
      var availableAt = Date.now() + SLIDE_DELAY_MS;
      function tick() {
        var seconds = Math.ceil((availableAt - Date.now()) / 1000);
        if (seconds > 0) {
          next.disabled = true;
          next.textContent = 'Дальше через ' + seconds + ' сек.';
          return;
        }
        clearDelay();
        next.disabled = false;
        next.textContent = current === slides.length - 2 ? 'Завершить обучение' : 'Дальше';
      }
      tick();
      timer = window.setInterval(tick, 250);
    }

    function render() {
      slides.forEach(function (slide, index) { slide.hidden = index !== current; });
      counter.textContent = (current + 1) + ' из ' + slides.length;
      back.disabled = current === 0;
      controls.hidden = current === slides.length - 1;
      if (current === slides.length - 1) {
        localStorage.setItem(STORAGE_KEY, 'true');
        clearDelay();
      } else {
        next.textContent = current === slides.length - 2 ? 'Завершить обучение' : 'Дальше';
        startDelay();
      }
    }

    back.addEventListener('click', function () {
      if (current > 0) { current -= 1; render(); }
    });
    next.addEventListener('click', function () {
      if (next.disabled || current >= slides.length - 1) return;
      current += 1;
      render();
    });
    render();
  });
})();
