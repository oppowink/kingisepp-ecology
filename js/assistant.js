(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var base = String(window.ECO_API_BASE || (location.hostname === 'oppowink.github.io' ? 'https://kingisepp-ecology.vercel.app' : '')).replace(/\/$/, '');
    var endpoint = base + '/api/assistant';
    var launcher = document.createElement('button');
    launcher.type = 'button'; launcher.className = 'assistant-launcher';
    launcher.setAttribute('aria-label', 'Задать вопрос');
    launcher.setAttribute('aria-controls', 'projectAssistant'); launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML = '<img src="img/icons/gear.png" alt="" aria-hidden="true" width="26" height="26" decoding="async"><span>Задать вопрос</span>';
    var panel = document.createElement('dialog'); panel.id = 'projectAssistant'; panel.className = 'assistant-panel';
    panel.setAttribute('aria-labelledby', 'assistantTitle');
    panel.innerHTML = '<div class="assistant-heading"><h2 id="assistantTitle">Задать вопрос</h2><button type="button" data-close aria-label="Закрыть чат"><img src="img/icons/close.png" alt="" aria-hidden="true" width="24" height="24" decoding="async"></button></div><p class="assistant-mode" data-mode>Ответы по материалам проекта</p><div class="assistant-messages" role="log" aria-live="polite" aria-label="Переписка с помощником"></div><div class="assistant-suggestions"><button type="button">Как работает платформа?</button><button type="button">Как собрать листья?</button><button type="button">Что такое ФА?</button></div><form><label for="assistantQuestion">Вопрос о проекте</label><textarea id="assistantQuestion" maxlength="1500" rows="2" required placeholder="Например: сколько нужно листьев?"></textarea><button type="submit" class="knopka-osnovnaya">Спросить</button><p class="assistant-hint">Ответы проверяйте по методике</p></form>';
    document.body.append(launcher, panel);
    var messages = panel.querySelector('.assistant-messages'), input = panel.querySelector('#assistantQuestion'), form = panel.querySelector('form');
    var enabled = true, history = [], busy = false, previousFocus = null;
    var knowledgePromise = fetch('data/assistant-knowledge.json').then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).catch(function () { return {}; });
    function timeout(ms) { var controller = new AbortController(); setTimeout(function () { controller.abort(); }, ms); return controller.signal; }
    var capabilities = fetch(endpoint, { signal: timeout(8000) }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (data) {
      enabled = data.enabled === true;
      panel.querySelector('[data-mode]').textContent = enabled ? 'ИИ · ответы по материалам проекта' : 'Справка проекта · ИИ пока недоступен';
    }).catch(function () { enabled = false; panel.querySelector('[data-mode]').textContent = 'Справка проекта · ИИ пока недоступен'; });
    function message(text, role) {
      var p = document.createElement('p'); p.className = 'assistant-message assistant-message--' + role;
      p.textContent = text; messages.appendChild(p); messages.scrollTop = messages.scrollHeight;
    }
    message('Спросите о сборе листьев, ФА или работе сайта', 'answer');
    function open(question) {
      if (!panel.open) { previousFocus = document.activeElement; panel.showModal(); }
      launcher.setAttribute('aria-expanded', 'true');
      if (question) input.value = question;
      input.focus();
    }
    function close() { if (panel.open) panel.close(); }
    launcher.addEventListener('click', function () { open(); }); panel.querySelector('[data-close]').addEventListener('click', close);
    panel.addEventListener('close', function () {
      launcher.setAttribute('aria-expanded', 'false');
      var target = previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.disabled ? previousFocus : launcher;
      target.focus();
      previousFocus = null;
    });
    panel.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      var items = Array.from(panel.querySelectorAll('button:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]'))
        .filter(function (node) { return node.getClientRects().length > 0; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    panel.addEventListener('click', function (event) { if (event.target === panel) { var r = panel.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
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
          var response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: timeout(27000), body: JSON.stringify({ question: question, context: options.context || '', consent: options.consent === true, history: options.history || [] }) });
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
      busy = true; var button = form.querySelector('[type="submit"]'); button.disabled = true; button.textContent = 'Готовлю ответ…';
      message(question, 'user'); input.value = ''; messages.setAttribute('aria-busy', 'true');
      try {
        var result = await ask(question, { history: history });
        if (result.notice) message(result.notice, 'notice');
        message(result.answer, 'answer');
        history.push({ role: 'user', content: question }, { role: 'assistant', content: result.answer }); history = history.slice(-8);
      } catch (_) { message('Не удалось получить ответ. Попробуйте ещё раз.', 'notice'); } finally { busy = false; button.disabled = false; button.textContent = 'Спросить'; messages.removeAttribute('aria-busy'); input.focus(); }
    });
    input.addEventListener('keydown', function (event) { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
    panel.querySelectorAll('.assistant-suggestions button').forEach(function (button) { button.addEventListener('click', function () { input.value = button.textContent; form.requestSubmit(); }); });
    document.querySelectorAll('[data-open-assistant]').forEach(function (button) { button.addEventListener('click', function () { open(document.getElementById('smartSearchInput')?.value || ''); }); });
  });
})();
