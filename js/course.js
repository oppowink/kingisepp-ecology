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
    var message = document.getElementById('courseMessage'); var answers = {}; var lesson = 0; var question = 0; var phase = 'lessons'; var checkpointAnswers = new Set(); var forwardTimer = null; var forwardAt = 0;
    function delayForward() { clearTimeout(forwardTimer); forwardAt = Date.now() + 3000; next.disabled = true; var original = next.textContent; next.textContent = original + ' · 3 с'; var remaining = 3; function tick() { remaining--; if (remaining > 0) { next.textContent = original + ' · ' + remaining + ' с'; forwardTimer = setTimeout(tick, 1000); } else { next.textContent = original; next.disabled = false; } } forwardTimer = setTimeout(tick, 1000); }
    function showMessage(text, state) { message.textContent = text || ''; message.dataset.state = state || ''; message.hidden = !text; }
    function courseError(error, fallback) {
      var code = String(error && error.message || '');
      if (code === 'EDUCATION_DATABASE_NOT_READY') return 'База обучения ещё не подготовлена. В Supabase SQL Editor выполните миграции 002 и 006, затем обновите страницу.';
      if (code === 'BACKEND_NOT_CONFIGURED') return 'Откройте опубликованную версию Vercel: на локальной HTML-странице сервер обучения недоступен.';
      if (code === 'AUTH_REQUIRED') return 'Сессия входа закончилась. Войдите в личный кабинет ещё раз.';
      return fallback;
    }
    function renderLesson() {
      phase = 'lessons'; var item = course.lessons[lesson]; progress.textContent = 'Разбираем по шагам'; app.dataset.phase = 'lesson';
      screen.innerHTML = '<article class="course-lesson"><h2>' + escapeHtml(item.title) + '</h2><p>' + escapeHtml(item.text) + '</p></article>';
      back.disabled = lesson === 0; back.hidden = false; next.hidden = false; next.disabled = false;
      next.textContent = lesson === course.lessons.length - 1 ? 'Проверить подготовку' : 'Продолжить'; showMessage(''); delayForward();
    }
    function renderCheckpoint() {
      clearTimeout(forwardTimer);
      phase = 'checkpoint'; app.dataset.phase = 'lesson'; progress.textContent = 'Перед тестом';
      var items = Array.isArray(course.checklist) ? course.checklist : [];
      screen.innerHTML = '<section class="course-checkpoint"><h2>Подтвердите, что правила понятны</h2><p>Это не формальность: по этому же чек-листу будет проверяться реальная работа.</p><div class="course-checkpoint__items">' + items.map(function (item, index) { return '<label><input type="checkbox" data-checkpoint="' + index + '"' + (checkpointAnswers.has(index) ? ' checked' : '') + '><span>' + escapeHtml(item) + '</span></label>'; }).join('') + '</div></section>';
      back.hidden = false; back.disabled = false; next.hidden = false; next.textContent = 'Перейти к тесту'; next.disabled = checkpointAnswers.size !== items.length; showMessage('');
    }
    function renderQuestion() {
      clearTimeout(forwardTimer);
      phase = 'test'; var item = course.questions[question]; progress.textContent = 'Проверяем знания'; app.dataset.phase = 'test';
      screen.innerHTML = '<section class="course-question"><p class="course-question__count">Выберите один ответ</p><h2>' + escapeHtml(item.text) + '</h2><div class="course-options">' + item.options.map(function (option) { return '<button type="button" aria-pressed="' + (answers[item.id] === option[0] ? 'true' : 'false') + '" class="course-option' + (answers[item.id] === option[0] ? ' course-option--selected' : '') + '" data-answer="' + escapeHtml(option[0]) + '">' + escapeHtml(option[1]) + '</button>'; }).join('') + '</div></section>';
      back.disabled = question === 0; back.hidden = false; next.hidden = false; next.disabled = !answers[item.id]; next.textContent = question === course.questions.length - 1 ? 'Проверить тест' : 'Следующий вопрос'; showMessage('');
    }
    async function finishLessons() {
      next.disabled = true; next.textContent = 'Сохраняем…';
      try { await EcoAuth.completeCourseLessons(courseId); question = 0; renderQuestion(); }
      catch (error) { renderCheckpoint(); showMessage(courseError(error, 'Не удалось сохранить уроки. Проверьте подключение и попробуйте ещё раз.'), 'error'); }
    }
    async function finishTest() {
      next.disabled = true; next.textContent = 'Проверяем…';
      try {
        var result = await EcoAuth.completeCourse(courseId, answers);
        if (result.completed) { renderDone(result); if (result.attemptPassed === false) showMessage('В этой попытке ответов недостаточно. Ранее пройденное обучение и сертификат сохранены. Можно повторить уроки', 'warning'); } else { question = 0; answers = {}; renderQuestion(); showMessage('Результат ' + result.score + ' из ' + result.total + '. Нужно минимум ' + result.passScore + '. Можно пройти тест ещё раз.', 'error'); }
      } catch (error) { renderQuestion(); showMessage(error.message === 'LESSONS_REQUIRED' ? 'Сначала завершите уроки.' : courseError(error, 'Не удалось сохранить результат. Проверьте подключение.'), 'error'); }
    }
    function renderDone(status) {
      clearTimeout(forwardTimer);
      phase = 'done'; progress.textContent = ''; app.dataset.phase = 'done'; back.hidden = true; next.hidden = true;
      screen.innerHTML = '<section class="course-done"><h2>Обучение пройдено</h2><p>Результат: ' + Number(status.score || 0) + ' из ' + Number(status.total || 0) + '. Доступ к рабочему разделу открыт.</p><div class="course-done__actions"><a class="knopka-osnovnaya" href="account.html">Вернуться в кабинет</a><button class="knopka-vtorichnaya" id="courseRepeat" type="button">Пройти обучение ещё раз</button><button class="knopka-vtorichnaya" id="courseCertificate" type="button">Открыть сертификат</button></div></section>';
      document.getElementById('courseRepeat').addEventListener('click', function () { lesson = 0; question = 0; answers = {}; checkpointAnswers.clear(); renderLesson(); });
      document.getElementById('courseCertificate').addEventListener('click', async function () { this.disabled = true; try { await EcoCertificates.download(courseId); } catch (_) { showMessage('Не удалось скачать сертификат. Проверьте соединение и попробуйте снова', 'error'); } finally { this.disabled = false; } });
    }
    screen.addEventListener('click', function (event) { var button = event.target.closest('[data-answer]'); if (!button || phase !== 'test') return; var item = course.questions[question]; answers[item.id] = button.dataset.answer; renderQuestion(); });
    screen.addEventListener('change', function (event) { var box = event.target.closest('[data-checkpoint]'); if (!box || phase !== 'checkpoint') return; var index = Number(box.dataset.checkpoint); if (box.checked) checkpointAnswers.add(index); else checkpointAnswers.delete(index); next.disabled = checkpointAnswers.size !== course.checklist.length; });
    back.addEventListener('click', function () { if (phase === 'lessons' && lesson > 0) { lesson -= 1; renderLesson(); } else if (phase === 'checkpoint') { lesson = course.lessons.length - 1; renderLesson(); } else if (phase === 'test' && question > 0) { question -= 1; renderQuestion(); } });
    next.addEventListener('click', async function () { if (phase === 'lessons' && Date.now() < forwardAt) return; if (phase === 'lessons') { if (lesson < course.lessons.length - 1) { lesson += 1; renderLesson(); } else renderCheckpoint(); } else if (phase === 'checkpoint') await finishLessons(); else if (phase === 'test') { if (question < course.questions.length - 1) { question += 1; renderQuestion(); } else await finishTest(); } });
    try { var status = await EcoAuth.refreshCourseStatus(courseId); if (status.completed) renderDone(status); else if (status.lessonsCompleted) renderQuestion(); else renderLesson(); }
    catch (error) { renderLesson(); showMessage(courseError(error, 'Не удалось загрузить обучение из Supabase. Обновите страницу после проверки подключения.'), 'error'); }
  });
})();
