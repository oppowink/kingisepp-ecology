// course.js: уроки и тест по одному экрану, прогресс сохраняется в Supabase.
(function () {
  'use strict';
  function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]; }); }
  document.addEventListener('DOMContentLoaded', async function () {
    var root = document.querySelector('[data-course]'); if (!root) return;
    var courseId = root.dataset.course; var course = window.EcoCourses && EcoCourses[courseId]; if (!course) return;
    var user = await EcoAuth.requireAuthAsync(); if (!user) return;
    var denied = document.getElementById('courseDenied'); var app = document.getElementById('courseApp') || document.getElementById('courseWorkspace');
    if (user.role !== 'admin' && user.role !== course.role) { if (denied) denied.hidden = false; if (app) app.hidden = true; var roleMessage=document.getElementById('courseMessage'); if(roleMessage){roleMessage.hidden=false;roleMessage.dataset.state='error';roleMessage.textContent='Этот курс доступен только для вашей роли.';} return; }
    if (denied) denied.hidden = true; if (app) app.hidden = false;
    if (document.getElementById('courseLabel')) document.getElementById('courseLabel').textContent = course.label;
    if (document.getElementById('courseTitle')) document.getElementById('courseTitle').textContent = course.title;
    if (document.getElementById('courseIntro')) document.getElementById('courseIntro').textContent = course.intro;
    if (document.getElementById('courseGuide')) document.getElementById('courseGuide').href = course.guide;
    var screen = document.getElementById('courseScreen'); var progress = document.getElementById('courseProgress');
    var back = document.getElementById('courseBack'); var next = document.getElementById('courseNext');
    var message = document.getElementById('courseMessage'); var answers = {}; var lesson = 0; var question = 0; var phase = 'lessons'; var timer = null;
    function showMessage(text, state) { message.textContent = text || ''; message.dataset.state = state || ''; message.hidden = !text; }
    function lockNext() {
      if (timer) clearInterval(timer); var left = 5; next.disabled = true; next.textContent = 'Дальше через ' + left + ' сек.';
      timer = setInterval(function () { left -= 1; if (left <= 0) { clearInterval(timer); timer = null; next.disabled = false; next.textContent = lesson === course.lessons.length - 1 ? 'Перейти к тесту' : 'Дальше'; } else next.textContent = 'Дальше через ' + left + ' сек.'; }, 1000);
    }
    function renderLesson() {
      phase = 'lessons'; var item = course.lessons[lesson]; progress.textContent = 'Урок ' + (lesson + 1) + ' из ' + course.lessons.length;
      var line=document.getElementById('courseProgressLine');if(line)line.style.width=((lesson+1)/course.lessons.length*100)+'%';
      screen.innerHTML = '<article class="course-lesson"><span class="course-number">' + String(lesson + 1).padStart(2, '0') + '</span><div><h2>' + escapeHtml(item.title) + '</h2><p>' + escapeHtml(item.text) + '</p></div></article>';
      back.disabled = lesson === 0; back.hidden = false; next.hidden = false; showMessage(''); lockNext();
    }
    function renderQuestion() {
      phase = 'test'; var item = course.questions[question]; progress.textContent = 'Вопрос ' + (question + 1) + ' из ' + course.questions.length;
      var line=document.getElementById('courseProgressLine');if(line)line.style.width=((question+1)/course.questions.length*100)+'%';
      screen.innerHTML = '<section class="course-question"><p class="course-question__count">Выберите один ответ</p><h2>' + escapeHtml(item.text) + '</h2><div class="course-options">' + item.options.map(function (option) { return '<button type="button" class="course-option' + (answers[item.id] === option[0] ? ' course-option--selected' : '') + '" data-answer="' + escapeHtml(option[0]) + '">' + escapeHtml(option[1]) + '</button>'; }).join('') + '</div></section>';
      back.disabled = question === 0; back.hidden = false; next.hidden = false; next.disabled = !answers[item.id]; next.textContent = question === course.questions.length - 1 ? 'Проверить тест' : 'Следующий вопрос'; showMessage('');
    }
    async function finishLessons() { next.disabled = true; next.textContent = 'Сохраняем…'; await EcoAuth.completeCourseLessons(courseId); question = 0; renderQuestion(); }
    async function finishTest() {
      next.disabled = true; next.textContent = 'Проверяем…';
      try {
        var result = await EcoAuth.completeCourse(courseId, answers);
        if (result.completed) renderDone(result); else { showMessage('Результат ' + result.score + ' из ' + result.total + '. Нужно минимум ' + result.passScore + '. Можно пройти тест ещё раз.', 'error'); question = 0; answers = {}; renderQuestion(); }
      } catch (error) { showMessage(error.message === 'LESSONS_REQUIRED' ? 'Сначала завершите уроки.' : 'Не удалось сохранить результат. Проверьте подключение.', 'error'); renderQuestion(); }
    }
    function renderDone(status) {
      if (timer) clearInterval(timer); phase = 'done'; progress.textContent = 'Курс завершён'; back.hidden = true; next.hidden = true;
      screen.innerHTML = '<section class="course-done"><p class="course-done__mark">Готово</p><h2>Обучение пройдено</h2><p>Результат: ' + Number(status.score || 0) + ' из ' + Number(status.total || 0) + '. Доступ к рабочему разделу открыт.</p><div class="course-done__actions"><a class="knopka-osnovnaya" href="account.html">Вернуться в кабинет</a><button class="knopka-vtorichnaya" id="courseCertificate" type="button">Открыть сертификат</button></div></section>';
      document.getElementById('courseCertificate').addEventListener('click', function () { showMessage('Сертификат разблокирован. Скачать его пока нельзя: макет ещё готовится.', 'warning'); });
    }
    screen.addEventListener('click', function (event) { var button = event.target.closest('[data-answer]'); if (!button || phase !== 'test') return; var item = course.questions[question]; answers[item.id] = button.dataset.answer; renderQuestion(); });
    back.addEventListener('click', function () { if (phase === 'lessons' && lesson > 0) { lesson -= 1; renderLesson(); } else if (phase === 'test' && question > 0) { question -= 1; renderQuestion(); } });
    next.addEventListener('click', async function () { if (phase === 'lessons') { if (lesson < course.lessons.length - 1) { lesson += 1; renderLesson(); } else await finishLessons(); } else if (phase === 'test') { if (question < course.questions.length - 1) { question += 1; renderQuestion(); } else await finishTest(); } });
    try { var status = await EcoAuth.refreshCourseStatus(courseId); if (status.completed) renderDone(status); else if (status.lessonsCompleted) renderQuestion(); else renderLesson(); }
    catch (_) { showMessage('Не удалось загрузить обучение из Supabase. Обновите страницу после проверки подключения.', 'error'); renderLesson(); }
  });
})();
