(function () {
  'use strict';

  var checklist = [
    'Паспорт, дата и число деревьев заполнены',
    'Фотографии относятся к берёзе повислой',
    'На каждом дереве 10–30 листьев, наборы не смешаны',
    'Листья сняты целиком, строго сверху и на светлом фоне',
    'Координаты, обзорное фото, код и территория не противоречат друг другу',
    'Проверены флаги геолокации и повторных файлов',
    'Участник подтвердил чек-лист полевого сбора',
    'Все 12 контрольных точек каждого листа просмотрены'
  ];

  var integrityLabels = {
    gps_not_shared: 'геолокация устройства не передана',
    device_far_from_point: 'устройство находилось дальше 250 м от указанной точки'
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function state(request) {
    if (request.status === 'published') return 'Опубликована';
    if (request.status === 'rejected') return 'Отклонена';
    if (request.status === 'needs_revision') return 'Возвращена на исправление';
    if (request.aiStatus === 'checked') return 'ФА рассчитана — нужна финальная проверка';
    if (request.aiStatus === 'processing') return 'Идёт расчёт ФА';
    if (request.humanStatus === 'approved' || request.status === 'human_approved') return 'Исходные данные одобрены';
    return 'Ждёт модератора';
  }

  function requestPhotos(request) {
    var rows = [];
    (request.trees || []).forEach(function (tree, treeIndex) {
      if (tree.treePhoto && tree.treePhoto.url) rows.push({ url: tree.treePhoto.url, label: 'Дерево ' + (treeIndex + 1) });
    });
    (request.files || []).slice(0, 8).forEach(function (file, index) {
      if (file.url) rows.push({ url: file.url, label: 'Лист ' + (index + 1) });
    });
    return rows.map(function (photo) {
      return '<figure><img src="' + esc(photo.url) + '" alt="' + esc(photo.label) + '"><figcaption>' + esc(photo.label) + '</figcaption></figure>';
    }).join('');
  }

  function faResult(request) {
    var result = request.aiResult;
    if (!result || result.meanFa == null) return '';
    var trees = (result.trees || []).map(function (tree) {
      return '<tr><td>Дерево ' + (Number(tree.treeIndex) + 1) + '</td><td>' + Number(tree.leafCount || 0) + '</td><td>' + Number(tree.meanFa).toFixed(4) + '</td></tr>';
    }).join('');
    return '<section class="moderaciya-result" aria-label="Рассчитанная флуктуирующая асимметрия"><h3>Финальная проверка расчёта</h3><dl><dt>Средняя ФА точки</dt><dd>' + Number(result.meanFa).toFixed(4) + '</dd><dt>Листьев в расчёте</dt><dd>' + Number(result.validLeafCount || 0) + '</dd><dt>Стандартное отклонение</dt><dd>' + Number(result.standardDeviation || 0).toFixed(4) + '</dd></dl><table><thead><tr><th>Набор</th><th>Листьев</th><th>Средняя ФА</th></tr></thead><tbody>' + trees + '</tbody></table><p>Сопоставьте средние по деревьям, число листьев и фотографии. Публикация означает, что результат проверен человеком.</p></section>';
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    var list = document.getElementById('moderationList');
    var denied = document.getElementById('moderationDenied');
    var deniedText = document.getElementById('moderationDeniedText');
    var message = document.getElementById('moderationMessage');
    if (!user || !list) return;

    function note(text, tone) {
      message.textContent = text || '';
      message.dataset.state = tone || '';
      message.hidden = !text;
    }

    if (!['moderator', 'admin'].includes(user.role)) {
      denied.hidden = false;
      deniedText.textContent = 'Этот раздел доступен модератору и администратору.';
      return;
    }
    if (user.role === 'moderator') {
      var course;
      try { course = await EcoAuth.refreshCourseStatus('moderator'); } catch (error) {
        denied.hidden = false;
        deniedText.textContent = error.message === 'EDUCATION_DATABASE_NOT_READY'
          ? 'База обучения не подготовлена. Выполните в Supabase миграции 002 и 006.'
          : 'Не удалось проверить результат обучения. Обновите страницу.';
        return;
      }
      if (!course || !course.completed) {
        denied.hidden = false;
        deniedText.textContent = 'Сначала завершите курс и наберите не менее 9 баллов из 10.';
        return;
      }
    }

    async function load() {
      try { await EcoAuth.refreshRequests('all'); render(); }
      catch (_) { note('Не удалось загрузить заявки из Supabase. Проверьте миграции 003, 005, 006 и 007.', 'error'); }
    }

    function render() {
      var rows = EcoAuth.getAllRequests();
      if (!rows.length) { list.innerHTML = '<p class="zayavki-pusty">Новых заявок пока нет.</p>'; return; }
      list.innerHTML = rows.map(function (request) {
        var checks = checklist.map(function (text, index) {
          return '<label><input type="checkbox" data-check="' + index + '" ' + (request.moderationChecklist && request.moderationChecklist[index] ? 'checked' : '') + '> <span>' + esc(text) + '</span></label>';
        }).join('');
        var flags = (request.integrityFlags || []).map(function (flag) { return integrityLabels[flag] || flag; });
        var integrity = flags.length ? '<p class="moderaciya-flagi"><strong>Требует внимания:</strong> ' + esc(flags.join('; ')) + '.</p>' : '<p class="moderaciya-flagi moderaciya-flagi--ok">Флаги целостности не обнаружены.</p>';
        var participantReady = Array.isArray(request.participantChecklist) && request.participantChecklist.length >= 6 && request.participantChecklist.every(Boolean);
        var precheck = request.photoPrecheck && request.photoPrecheck.passed ? 'пройдена' : 'нет подтверждения';
        var actions = '<a class="knopka-vtorichnaya" href="review.html?id=' + encodeURIComponent(request.id) + '">Проверить и поправить точки</a><button class="knopka-vtorichnaya" data-action="needs_revision" type="button">Вернуть на исправление</button><button class="knopka-vtorichnaya" data-action="rejected" type="button">Отклонить</button><button class="knopka-osnovnaya" data-action="human_approved" type="button">Исходные данные проверены</button>';
        if (request.humanStatus === 'approved' || request.status === 'human_approved') actions += '<button class="knopka-osnovnaya" data-action="analyse" type="button">Рассчитать ФА</button>';
        if (request.aiStatus === 'checked' && request.status !== 'published') actions += '<button class="knopka-osnovnaya" data-action="publish" type="button">ФА проверена — опубликовать</button>';
        return '<article class="moderaciya-zayavka" data-id="' + esc(request.id) + '"><div class="moderaciya-zayavka__head"><div><p class="sekciya-metka">' + esc(state(request)) + '</p><h2>' + esc(request.title || 'Точка мониторинга') + '</h2></div><span>' + esc(request.collectionDate || 'Дата не указана') + '</span></div><dl class="moderaciya-pasport"><dt>Место</dt><dd>' + esc(request.location || 'не указано') + '</dd><dt>Координаты</dt><dd>' + esc(request.coordinates || 'не указаны') + '</dd><dt>Участник</dt><dd>' + esc(request.userName || request.userEmail || 'не указан') + '</dd><dt>Деревьев</dt><dd>' + Number(request.treeCount || (request.trees || []).length) + '</dd><dt>Листьев</dt><dd>' + Number((request.files || []).length) + '</dd><dt>Расстояние до дороги</dt><dd>' + esc(request.roadDistanceM == null || request.roadDistanceM === '' ? 'не указано' : request.roadDistanceM + ' м') + '</dd><dt>Техническая проверка фото</dt><dd>' + esc(precheck) + '</dd><dt>Чек-лист участника</dt><dd>' + (participantReady ? 'подтверждён' : 'неполный') + '</dd><dt>Точность GPS</dt><dd>' + esc(request.gpsAccuracyM == null ? 'не передана' : Math.round(Number(request.gpsAccuracyM)) + ' м') + '</dd></dl>' + integrity + '<div class="moderaciya-preview">' + requestPhotos(request) + '</div><div class="moderaciya-checklist"><h3>Проверка модератора</h3>' + checks + '</div><label class="pole-podpis">Причина возврата или отклонения<textarea class="pole-vvod" data-comment rows="3">' + esc(request.moderationReason || '') + '</textarea></label>' + faResult(request) + '<div class="moderaciya-deystviya">' + actions + '</div></article>';
      }).join('');
    }

    list.addEventListener('change', async function (event) {
      if (!event.target.matches('[data-check]')) return;
      var card = event.target.closest('[data-id]');
      var values = Array.from(card.querySelectorAll('[data-check]')).map(function (box) { return box.checked; });
      try { await EcoAuth.saveRequestUpdate(card.dataset.id, { moderationChecklist: values }); }
      catch (_) { note('Не удалось сохранить чек-лист.', 'error'); }
    });

    list.addEventListener('click', async function (event) {
      var button = event.target.closest('[data-action]');
      if (!button) return;
      var card = button.closest('[data-id]');
      var id = card.dataset.id;
      var action = button.dataset.action;
      var comment = card.querySelector('[data-comment]').value.trim();
      button.disabled = true;
      try {
        if (action === 'analyse') {
          await EcoAuth.startRequestAnalysis(id);
          button.textContent = 'Расчёт…';
          await new Promise(function (resolve) { setTimeout(resolve, 8200); });
          await EcoAuth.finishRequestAnalysis(id);
        } else if (action === 'publish') {
          await EcoAuth.publishRequest(id);
        } else {
          var checks = Array.from(card.querySelectorAll('[data-check]')).map(function (box) { return box.checked; });
          if (action === 'human_approved' && !checks.every(Boolean)) throw new Error('CHECKLIST');
          if ((action === 'rejected' || action === 'needs_revision') && !comment) throw new Error('COMMENT');
          await EcoAuth.saveRequestUpdate(id, {
            status: action,
            humanStatus: action === 'human_approved' ? 'approved' : action === 'rejected' ? 'rejected' : 'pending',
            moderationReason: comment,
            moderationChecklist: checks
          });
        }
        await load();
        note(action === 'publish' ? 'Заявка опубликована на карте.' : 'Изменения сохранены.', 'success');
      } catch (error) {
        button.disabled = false;
        note(error.message === 'CHECKLIST' ? 'Перед одобрением отметьте весь чек-лист.' : error.message === 'COMMENT' ? 'Напишите, что именно нужно исправить.' : 'Не удалось выполнить действие.', 'error');
      }
    });

    await load();
  });
})();
