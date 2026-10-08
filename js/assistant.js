(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var base = String(window.ECO_API_BASE || (location.hostname === 'oppowink.github.io' ? 'https://kingisepp-ecology.vercel.app' : '')).replace(/\/$/, '');
    var endpoint = base + '/api/assistant';
    var launcher = document.createElement('button');
    launcher.type = 'button'; launcher.className = 'assistant-launcher';
    launcher.setAttribute('aria-label', 'Открыть помощника по проекту');
    launcher.setAttribute('aria-controls', 'projectAssistant'); launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8M8 12h5"/></svg><span>Помощник</span>';
    var panel = document.createElement('dialog'); panel.id = 'projectAssistant'; panel.className = 'assistant-panel';
    panel.setAttribute('aria-labelledby', 'assistantTitle');
    panel.innerHTML = '<div class="assistant-heading"><h2 id="assistantTitle">Помощник по проекту</h2><button type="button" data-close aria-label="Закрыть помощника">×</button></div><p class="assistant-mode" data-mode>Ответы по материалам проекта</p><div class="assistant-messages" role="log" aria-live="polite" aria-label="Переписка с помощником"></div><div class="assistant-suggestions"><button type="button">Как работает платформа?</button><button type="button">Как собрать листья?</button><button type="button">Что такое ФА?</button></div><div class="assistant-selection" hidden><label>Фрагмент для объяснения<textarea maxlength="4000" data-context></textarea></label><button type="button" data-clear>Убрать фрагмент</button></div><button class="assistant-wand" type="button" data-wand>Выбрать текст на странице</button><form><label for="assistantQuestion">Вопрос о проекте</label><textarea id="assistantQuestion" maxlength="1500" rows="2" required placeholder="Например: чем ФА отличается от классификации?"></textarea><label class="assistant-consent" hidden><input type="checkbox" data-consent>Отправить выбранный фрагмент вместе с вопросом</label><button type="submit" class="knopka-osnovnaya">Спросить</button><p class="assistant-hint">Вопрос обрабатывает сервис ИИ. Не указывайте личные данные. Ответы стоит проверять по методике.</p></form>';
    document.body.append(launcher, panel);
    var messages = panel.querySelector('.assistant-messages'), input = panel.querySelector('#assistantQuestion'), form = panel.querySelector('form');
    var selection = panel.querySelector('.assistant-selection'), contextInput = panel.querySelector('[data-context]'), consent = panel.querySelector('.assistant-consent');
    var privatePage = /\/(account|submit|my-requests|moderator|review|curator)\.html$/.test(location.pathname);
    if (privatePage) panel.querySelector('[data-wand]').hidden = true;
    var enabled = true, history = [], selecting = false, highlighted = null, hint = null, busy = false;
    var knowledgePromise = fetch('data/assistant-knowledge.json').then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).catch(function () { return {}; });
    var capabilities = fetch(endpoint, { signal: AbortSignal.timeout(8000) }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (data) {
      enabled = data.enabled === true;
      panel.querySelector('[data-mode]').textContent = enabled ? 'ИИ · ответы по материалам проекта' : 'Справка проекта · ИИ пока недоступен';
    }).catch(function () { enabled = false; panel.querySelector('[data-mode]').textContent = 'Справка проекта · ИИ пока недоступен'; });
    function message(text, role) {
      var p = document.createElement('p'); p.className = 'assistant-message assistant-message--' + role;
      p.textContent = text; messages.appendChild(p); messages.scrollTop = messages.scrollHeight;
    }
    message('Здравствуйте! Помогу разобраться в методике, результатах и работе сайта. Можно задать вопрос своими словами или выбрать один из примеров.', 'answer');
    function open(question) { if (!panel.open) panel.showModal(); launcher.setAttribute('aria-expanded', 'true'); if (question) input.value = question; input.focus(); }
    function close() { panel.close(); launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); }
    launcher.addEventListener('click', function () { open(); }); panel.querySelector('[data-close]').addEventListener('click', close);
    panel.addEventListener('close', function () { launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); });
    panel.addEventListener('click', function (event) { if (event.target === panel) { var r = panel.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
    panel.querySelector('[data-clear]').addEventListener('click', function () { contextInput.value = ''; selection.hidden = true; consent.hidden = true; panel.querySelector('[data-consent]').checked = false; });
    function normalized(text) { return String(text).toLowerCase().replace(/ё/g, 'е'); }
    async function localAnswer(question) {
      var data = await knowledgePromise;
      var aliases = { 'фа': 'асимметрия', 'f1': 'классификатор', 'мобайл': 'mobilenet', 'нейросеть': 'классификатор', 'береза': 'берез', 'этапы': 'логика', 'платформа': 'платформ' };
      var words = normalized(question).match(/[а-яa-z0-9]+/g) || [];
      words = words.map(function (w) { return aliases[w] || w; }).filter(function (w) { return w.length >= 3 && !['как','что','это','для','или','где','мне','про'].includes(w); });
      var candidates = Object.values(data).filter(function (v) { return typeof v === 'string'; }).map(function (value) {
        var text = normalized(value); return { text: value, score: words.reduce(function (score, word) { return score + Number(text.includes(word.slice(0, Math.max(3, word.length - 2)))); }, 0) };
      }).sort(function (a, b) { return b.score - a.score; });
      return candidates[0] && candidates[0].score ? candidates[0].text : 'В справке нет точного ответа. Попробуйте уточнить вопрос или откройте раздел «Вопросы и ответы».';
    }
    async function ask(question, options) {
      options = options || {}; await capabilities;
      if (enabled) {
        try {
          var response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(27000), body: JSON.stringify({ question: question, context: options.context || '', consent: options.consent === true, history: options.history || [] }) });
          var data = await response.json(); if (!response.ok || typeof data.answer !== 'string' || !data.answer.trim()) throw new Error(data.error || 'UNAVAILABLE');
          return { answer: data.answer, source: 'ai', provider: data.provider };
        } catch (_) { return { answer: await localAnswer(question), source: 'local', notice: 'ИИ сейчас не ответил. Ниже — найденный материал справки.' }; }
      }
      return { answer: await localAnswer(question), source: 'local', notice: 'ИИ пока недоступен. Ниже — найденный материал справки.' };
    }
    window.EcoAssistant = { open: open, ask: ask };
    form.addEventListener('submit', async function (event) {
      event.preventDefault(); if (busy) return;
      var question = input.value.trim(); if (!question) return;
      if (contextInput.value.trim() && !panel.querySelector('[data-consent]').checked) { message('Подтвердите отправку фрагмента или уберите его. Вопрос можно отправить отдельно.', 'notice'); return; }
      busy = true; var button = form.querySelector('[type="submit"]'); button.disabled = true; button.textContent = 'Готовлю ответ…';
      message(question, 'user'); input.value = ''; messages.setAttribute('aria-busy', 'true');
      try {
        var result = await ask(question, { history: history, context: contextInput.value, consent: panel.querySelector('[data-consent]').checked });
        if (result.notice) message(result.notice, 'notice');
        message(result.answer, 'answer');
        history.push({ role: 'user', content: question }, { role: 'assistant', content: result.answer }); history = history.slice(-8);
      } finally { busy = false; button.disabled = false; button.textContent = 'Спросить'; messages.removeAttribute('aria-busy'); input.focus(); }
    });
    panel.querySelectorAll('.assistant-suggestions button').forEach(function (button) { button.addEventListener('click', function () { input.value = button.textContent; form.requestSubmit(); }); });
    function permitted(node) { return !privatePage && node && node.closest('main') && !node.closest('input, textarea, select, [contenteditable], [data-private], #kabinetEmail, #kabinetImya, #profilOrganizaciiSpisok, #uchastnikiSpisok, .moderaciya-pasport, [hidden]'); }
    function targetAt(event) { var node = document.elementFromPoint(event.clientX, event.clientY); if (!permitted(node)) return null; var target = node.closest('p, h1, h2, h3, article, section') || node; return permitted(target) ? target : null; }
    function stopSelection() { selecting = false; if (highlighted) highlighted.classList.remove('assistant-highlight'); highlighted = null; if (hint) hint.remove(); document.removeEventListener('pointermove', hover, true); document.removeEventListener('click', choose, true); document.removeEventListener('keydown', escape, true); }
    function hover(event) { var target = targetAt(event); if (highlighted) highlighted.classList.remove('assistant-highlight'); highlighted = target; if (target) target.classList.add('assistant-highlight'); }
    function escape(event) { if (event.key === 'Escape') { stopSelection(); open(); } }
    function choose(event) {
      if (!selecting) return; event.preventDefault(); event.stopImmediatePropagation();
      if (event.target.closest('[data-cancel-selection]')) { stopSelection(); open(); return; }
      var target = targetAt(event); if (!target) return;
      var clone = target.cloneNode(true); clone.querySelectorAll('input, textarea, select, script, style, [hidden], [data-private]').forEach(function (node) { node.remove(); });
      contextInput.value = clone.textContent.replace(/\s+/g, ' ').trim().slice(0, 4000);
      panel.querySelector('[data-consent]').checked = false; selection.hidden = false; consent.hidden = false; stopSelection(); open();
    }
    panel.querySelector('[data-wand]').addEventListener('click', function () {
      panel.close(); selecting = true; hint = document.createElement('div'); hint.className = 'assistant-select-hint';
      hint.innerHTML = 'Выберите текст для объяснения <button type="button" data-cancel-selection>Отмена</button>'; document.body.appendChild(hint);
      setTimeout(function () { if (!selecting) return; document.addEventListener('pointermove', hover, true); document.addEventListener('click', choose, true); document.addEventListener('keydown', escape, true); }, 0);
    });
    document.querySelectorAll('[data-open-assistant]').forEach(function (button) { button.addEventListener('click', function () { open(document.getElementById('smartSearchInput')?.value || ''); }); });
  });
})();
