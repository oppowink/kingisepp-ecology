(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var launcher = document.createElement('button'); launcher.type = 'button'; launcher.className = 'assistant-launcher'; launcher.setAttribute('aria-label', 'Помощник по проекту'); launcher.setAttribute('aria-controls', 'projectAssistant'); launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8M8 12h5"/></svg><span>Спросить</span>';
    var panel = document.createElement('dialog'); panel.id = 'projectAssistant'; panel.className = 'assistant-panel'; panel.setAttribute('aria-labelledby', 'assistantTitle');
    panel.innerHTML = '<div class="assistant-heading"><h2 id="assistantTitle">Помощник по проекту</h2><button type="button" data-close aria-label="Закрыть помощника">×</button></div><p class="assistant-mode" data-mode>Поиск по справке сайта</p><div class="assistant-messages" role="log" aria-live="polite"></div><div class="assistant-selection" hidden><label>Выбранный текст<textarea maxlength="4000" data-context></textarea></label><img alt="Выбранное изображение для вопроса" hidden><button type="button" data-clear>Убрать выделение</button></div><button class="assistant-wand" type="button" data-wand><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 12-12 4 4L8 24M14 3v3M20 4l-2 2M21 9h3M7 6V2M5 4h4"/></svg>Выбрать текст или фото на странице</button><form><label for="assistantQuestion">Твой вопрос</label><textarea id="assistantQuestion" maxlength="1500" rows="2" required placeholder="Например: зачем расстояние до дороги?"></textarea><label class="assistant-consent" hidden><input type="checkbox" data-consent>Отправить вопрос и выбранный фрагмент в Yandex AI Studio</label><p class="assistant-hint">Ответ помощника не заменяет проверку модератора</p><button type="submit" class="knopka-osnovnaya">Найти в справке</button></form>';
    document.body.append(launcher, panel);
    var messages = panel.querySelector('.assistant-messages'), input = panel.querySelector('#assistantQuestion'), form = panel.querySelector('form');
    var selection = panel.querySelector('.assistant-selection'), contextInput = panel.querySelector('[data-context]'), preview = selection.querySelector('img');
    var capabilities = { enabled: false, images: false }, image = '', selecting = false, highlighted = null, hint;
    var knowledgePromise = fetch('data/assistant-knowledge.json').then(function (r) { return r.json(); }).catch(function () { return {}; });
    function message(text, role) { var p = document.createElement('p'); p.className = 'assistant-message assistant-message--' + role; p.textContent = text; messages.appendChild(p); messages.scrollTop = messages.scrollHeight; }
    function open(question) { panel.showModal(); launcher.setAttribute('aria-expanded', 'true'); if (question) input.value = question; input.focus(); }
    function close() { panel.close(); launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); }
    launcher.addEventListener('click', function () { open(); }); panel.querySelector('[data-close]').addEventListener('click', close);
    panel.addEventListener('close', function () { launcher.setAttribute('aria-expanded', 'false'); });
    panel.querySelector('[data-clear]').addEventListener('click', function () { contextInput.value = ''; image = ''; preview.removeAttribute('src'); preview.hidden = true; selection.hidden = true; });
    window.EcoAssistant = { open: open };
    fetch('/api/requests/list?scope=assistant', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      capabilities = data;
      if (data.enabled) { panel.querySelector('[data-mode]').textContent = 'Yandex AI Studio · ответы по материалам проекта'; panel.querySelector('.assistant-consent').hidden = false; form.querySelector('[type="submit"]').textContent = 'Спросить помощника'; }
    }).catch(function () {});
    var privateSelector = '[data-private], #kabinetEmail, #kabinetImya, #profilOrganizaciiSpisok, #uchastnikiSpisok, .moderaciya-pasport';
    function permitted(node) { return node && node.closest('main') && !node.closest('#projectAssistant, input, textarea, select, [contenteditable], [data-private], #kabinetEmail, #kabinetImya, #profilOrganizaciiSpisok, #uchastnikiSpisok') && !node.closest('[hidden]'); }
    function targetAt(event) {
      var node = document.elementFromPoint(event.clientX, event.clientY);
      if (!permitted(node)) return null;
      return node.closest('img, p, h1, h2, h3, label, article, fieldset, section, button') || node;
    }
    function stopSelection() {
      selecting = false; document.body.classList.remove('assistant-selecting');
      if (highlighted) highlighted.classList.remove('assistant-highlight'); highlighted = null;
      if (hint) hint.remove(); document.removeEventListener('pointermove', hover, true); document.removeEventListener('click', choose, true); document.removeEventListener('keydown', escape, true);
    }
    function hover(event) { var target = targetAt(event); if (highlighted === target) return; if (highlighted) highlighted.classList.remove('assistant-highlight'); highlighted = target; if (target) target.classList.add('assistant-highlight'); }
    function escape(event) { if (event.key === 'Escape') { stopSelection(); open(); } }
    async function imageData(node) {
      var src = node.currentSrc || node.src;
      if (!src || (!src.startsWith(location.origin + '/') && !src.startsWith('blob:'))) return '';
      var canvas = document.createElement('canvas'); var ratio = Math.min(1, 768 / Math.max(node.naturalWidth, node.naturalHeight));
      canvas.width = Math.round(node.naturalWidth * ratio); canvas.height = Math.round(node.naturalHeight * ratio);
      var ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(node, 0, 0, canvas.width, canvas.height);
      var data = canvas.toDataURL('image/jpeg', .75); return data.length < 1000000 ? data : '';
    }
    async function choose(event) {
      if (!selecting) return; event.preventDefault(); event.stopImmediatePropagation();
      if (event.target.closest('[data-cancel-selection]')) { stopSelection(); open(); return; }
      var target = targetAt(event); if (!target) return;
      panel.querySelector('[data-consent]').checked = false;
      var clone = target.cloneNode(true); clone.querySelectorAll('input, textarea, select, script, style, [hidden], ' + privateSelector).forEach(function (n) { n.remove(); });
      contextInput.value = (target.tagName === 'IMG' ? target.alt : clone.textContent).replace(/\s+/g, ' ').trim().slice(0, 4000);
      var picture = target.tagName === 'IMG' ? target : target.querySelector('img:not([aria-hidden="true"])');
      image = ''; if (picture && capabilities.images) { try { image = await imageData(picture); } catch (_) {} }
      preview.hidden = !image; if (image) preview.src = image;
      selection.hidden = false; stopSelection(); open();
      if (picture && !image) message('Изображение не отправляется: анализ фото сейчас недоступен. Можно спросить по выбранному тексту или описать снимок', 'notice');
    }
    panel.querySelector('[data-wand]').addEventListener('click', function () {
      panel.close(); selecting = true; document.body.classList.add('assistant-selecting');
      hint = document.createElement('div'); hint.className = 'assistant-select-hint'; hint.innerHTML = 'Нажмите на текст, блок или фото <button type="button" data-cancel-selection>Отмена</button>'; document.body.appendChild(hint);
      setTimeout(function () { if (!selecting) return; document.addEventListener('pointermove', hover, true); document.addEventListener('click', choose, true); document.addEventListener('keydown', escape, true); }, 0);
    });
    async function localAnswer(question) {
      var data = await knowledgePromise, words = question.toLowerCase().replace(/ё/g, 'е').match(/[а-яa-z]{4,}/g) || [];
      var candidates = Object.entries(data).filter(function (entry) { return typeof entry[1] === 'string'; }).map(function (entry) { return { text: entry[1], score: words.reduce(function (sum, word) { return sum + Number(entry[1].toLowerCase().replace(/ё/g, 'е').includes(word.slice(0, Math.max(4, word.length - 2)))); }, 0) }; }).sort(function (a, b) { return b.score - a.score; });
      return candidates[0] && candidates[0].score ? candidates[0].text : 'В справке нет точного совпадения. Уточни вопрос или открой раздел «Вопросы и ответы»';
    }
    form.addEventListener('submit', async function (event) {
      event.preventDefault(); var question = input.value.trim(); if (!question) return;
      if (capabilities.enabled && !panel.querySelector('[data-consent]').checked) { message('Подтверди отправку выбранного фрагмента. Перед отправкой текст можно отредактировать, фото убрать', 'notice'); return; }
      var button = form.querySelector('[type="submit"]'); button.disabled = true; message(question, 'user'); input.value = '';
      try {
        if (!capabilities.enabled) message(await localAnswer(question), 'answer');
        else {
          var response = await fetch('/api/requests/list', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(28000), body: JSON.stringify({ action: 'assistant', question: question, context: contextInput.value, image: image, consent: true }) });
          var data = await response.json(); if (!response.ok) throw new Error('ASSISTANT_UNAVAILABLE'); message(data.answer, 'answer');
        }
      } catch (_) { message('Помощник сейчас не ответил. Вот ближайший фрагмент справки: ' + await localAnswer(question), 'answer'); }
      finally { button.disabled = false; input.focus(); }
    });
    document.querySelectorAll('[data-open-assistant]').forEach(function (button) { button.addEventListener('click', function () { open(document.getElementById('smartSearchInput')?.value || ''); }); });
  });
})();
