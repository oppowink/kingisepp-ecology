(function () {
  'use strict';
  var names = ['apex','base','left_v1_base','left_v1_end','right_v1_base','right_v1_end','left_v2_base','left_v2_end','right_v2_base','right_v2_end','width_left','width_right'];
  var labels = ['Верхушка','Основание','Левая жилка 1, начало','Левая жилка 1, конец','Правая жилка 1, начало','Правая жилка 1, конец','Левая жилка 2, начало','Левая жилка 2, конец','Правая жилка 2, начало','Правая жилка 2, конец','Ширина слева','Ширина справа'];
  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user || !['moderator','admin'].includes(user.role)) { location.replace('account.html'); return; }
    var id = new URLSearchParams(location.search).get('id');
    var overlay = document.getElementById('reviewOverlay'), image = document.getElementById('reviewImage');
    var counter = document.getElementById('reviewCounter'), message = document.getElementById('reviewMessage');
    var legend = document.getElementById('reviewLegend'), save = document.getElementById('reviewSave');
    var index = 0, selected = 0, dirty = false, request, sets;
    function note(text, state) { message.textContent = text; message.dataset.state = state || ''; message.hidden = !text; }
    try { await EcoAuth.refreshRequests('all'); request = EcoAuth.getRequestById(id); }
    catch (_) { note('Не удалось загрузить заявку. Обновите страницу', 'error'); return; }
    if (!request || !request.files.length) { note('Заявка не найдена', 'error'); return; }
    sets = JSON.parse(JSON.stringify(request.landmarks || []));
    var selector = document.createElement('select'); selector.className = 'pole-vybor'; selector.setAttribute('aria-label', 'Выбрать лист');
    request.files.forEach(function (file, i) { selector.add(new Option('Лист ' + (i + 1) + ' · берёза ' + (Number(sets[i]?.treeIndex || 0) + 1), i)); });
    document.querySelector('.review-nav').after(selector);
    selector.onchange = function () { index = Number(selector.value); render(); };
    function move(name, x, y, dot) {
      var point = sets[index].points[name]; point.x = Math.max(0, Math.min(1, x)); point.y = Math.max(0, Math.min(1, y));
      dot.style.left = point.x * 100 + '%'; dot.style.top = point.y * 100 + '%'; dirty = true; save.disabled = false;
    }
    function select(i) {
      selected = i;
      overlay.querySelectorAll('button').forEach(function (dot) { dot.classList.toggle('is-selected', Number(dot.dataset.point) === i); });
      legend.querySelectorAll('button').forEach(function (button, k) { button.setAttribute('aria-pressed', String(k === i)); });
    }
    function render() {
      image.src = request.files[index].url || '';
      image.alt = 'Лист ' + (index + 1) + ' для проверки ориентиров';
      counter.textContent = 'Лист ' + (index + 1) + ' из ' + request.files.length; selector.value = index;
      overlay.replaceChildren(); legend.replaceChildren();
      var set = sets[index]?.points || {};
      names.forEach(function (name, i) {
        var row = document.createElement('li'), button = document.createElement('button'); button.type = 'button';
        button.textContent = (i + 1) + '. ' + labels[i]; button.onclick = function () { select(i); overlay.querySelector('[data-point="' + i + '"]')?.focus(); }; row.append(button); legend.append(row);
        var point = set[name]; if (!point) return;
        var dot = document.createElement('button'); dot.type = 'button'; dot.className = 'review-dot'; dot.dataset.point = i;
        dot.textContent = i + 1; dot.setAttribute('aria-label', labels[i] + '. Стрелки для перемещения, Shift для крупного шага');
        dot.style.left = point.x * 100 + '%'; dot.style.top = point.y * 100 + '%';
        var dragging = false;
        dot.onpointerdown = function (event) { select(i); dragging = true; dot.setPointerCapture(event.pointerId); event.preventDefault(); };
        dot.onpointermove = function (event) { if (!dragging) return; var rect = overlay.getBoundingClientRect(); move(name, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, dot); };
        dot.onpointerup = dot.onpointercancel = dot.onlostpointercapture = function () { dragging = false; };
        dot.onfocus = function () { select(i); };
        dot.onkeydown = function (event) {
          var delta = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[event.key]; if (!delta) return;
          event.preventDefault(); var step = event.shiftKey ? .01 : .001; move(name, point.x + delta[0] * step, point.y + delta[1] * step, dot);
        };
        overlay.append(dot);
      });
      select(selected); document.getElementById('reviewPrev').disabled = index === 0; document.getElementById('reviewNext').disabled = index === request.files.length - 1;
    }
    overlay.addEventListener('pointerdown', function (event) { if (event.target !== overlay) return; var dot = overlay.querySelector('[data-point="' + selected + '"]'); if (!dot) return; var rect = overlay.getBoundingClientRect(); move(names[selected], (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, dot); });
    document.getElementById('reviewPrev').onclick = function () { if (index > 0) { index--; render(); } };
    document.getElementById('reviewNext').onclick = function () { if (index < request.files.length - 1) { index++; render(); } };
    image.onerror = function () { note('Фото недоступно. Если страница открыта больше часа, сохраните исправления и обновите её для новой ссылки', 'error'); };
    save.onclick = async function () {
      save.disabled = true;
      try { await EcoAuth.saveRequestLandmarks(id, sets); dirty = false; note('Исправления сохранены. Прежнее одобрение сброшено: проверьте данные и рассчитайте ФА заново', 'success'); }
      catch (_) { save.disabled = false; note('Не удалось сохранить точки. Исправления остались на этой странице', 'error'); }
    };
    addEventListener('beforeunload', function (event) { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    render();
  });
})();
