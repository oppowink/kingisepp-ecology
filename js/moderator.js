// moderator.js — интерфейс проверки заявок с чеклистом и выбором причины
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  // Список причин отклонения
  var REJECTION_REASONS = [
    { value: 'wrong_species', label: 'Неверный вид (не берёза повислая)' },
    { value: 'damaged_leaves', label: 'Повреждённые листья' },
    { value: 'unreadable_photos', label: 'Нечитаемые фото (тень, размытие, ракурс)' },
    { value: 'not_enough_photos', label: 'Недостаточно фото (меньше 30)' },
    { value: 'wrong_background', label: 'Неправильный фон (не белый)' },
    { value: 'invalid_coords', label: 'Неверные координаты' },
    { value: 'other', label: 'Другое' }
  ];

  // Чеклист модератора (6 пунктов)
  var CHECKLIST_ITEMS = [
    'Вид определён верно (берёза повислая)',
    'Фон светлый (автопроверка пройдена)',
    'Лист целый, без повреждений',
    'Видна центральная жилка по всей длине',
    'Указаны координаты и дата сбора',
    'Количество фото: 30 из 30'
  ];

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

    var denied = document.getElementById('moderaciyaNetDostupa');
    var list = document.getElementById('moderaciyaSpisok');
    if (!list || !denied) return;

    if (!['moderator', 'admin'].includes(user.role)) {
      denied.hidden = false;
      list.hidden = true;
      return;
    }

    list.hidden = false;

    function render() {
      var requests = EcoAuth.getAllRequests();
      if (!requests.length) {
        list.innerHTML = '<p class="zayavki-pusty">Заявок пока нет</p>';
        return;
      }

      list.innerHTML = requests.map(function (item) {
        // Генерируем чеклист
        var checklistHtml = CHECKLIST_ITEMS.map(function (label, idx) {
          var checked = item.moderationChecklist && item.moderationChecklist[idx] ? 'checked' : '';
          return '<label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; margin:4px 0;">' +
            '<input type="checkbox" class="mod-checklist" data-idx="' + idx + '" ' + checked + '>' +
            label +
            '</label>';
        }).join('');

        // Выпадающий список причин отклонения
        var reasonOptions = REJECTION_REASONS.map(function (r) {
          var selected = (item.moderationReason === r.value) ? 'selected' : '';
          return '<option value="' + r.value + '" ' + selected + '>' + r.label + '</option>';
        }).join('');

        // Превью фото (если есть base64)
        var photosHtml = '';
        if (item.files && item.files.length) {
          photosHtml = item.files.map(function (f) {
            if (f.data) {
              return '<img src="' + f.data + '" alt="' + escapeHtml(f.name) + '" style="max-width:100px; max-height:100px; margin:4px; object-fit:cover;">';
            } else {
              return '<span style="font-size:0.75rem; color:var(--text-muted); margin-right:6px;">' + escapeHtml(f.name) + '</span>';
            }
          }).join('');
        }

        return '<article class="moderaciya-zayavka" data-zayavka-id="' + escapeHtml(item.id) + '">' +
          '<h2>' + escapeHtml(item.title) + '</h2>' +
          '<p class="moderaciya-meta">' + escapeHtml(item.userName) + ', ' + escapeHtml(item.userEmail) + '</p>' +
          '<p class="moderaciya-dannye">' + escapeHtml(item.location) + (item.collectionDate ? ', ' + escapeHtml(item.collectionDate) : '') + '</p>' +
          '<div class="moderaciya-foto" style="display:flex; flex-wrap:wrap; gap:6px; margin:10px 0;">' + photosHtml + '</div>' +
          '<div class="moderaciya-checklist" style="margin:12px 0; padding:10px; background:var(--surface-soft); border:1px solid var(--line);">' +
          '<span class="mod-checklist-title">Чеклист модератора</span>' +
          checklistHtml +
          '</div>' +
          '<div class="pole-gruppa moderaciya-prichina" style="margin-top:12px;">' +
          '<label class="pole-podpis" for="prichina-' + escapeHtml(item.id) + '">Причина отклонения</label>' +
          '<select class="pole-vybor" id="prichina-' + escapeHtml(item.id) + '" data-prichina style="min-height:44px; padding:8px;">' +
          '<option value="">Выберите причину</option>' +
          reasonOptions +
          '</select>' +
          '<p class="pole-oshibka" data-prichina-oshibka hidden>Выберите причину отклонения</p>' +
          '</div>' +
          '<div class="moderaciya-deystviya" style="display:flex; gap:11px; margin-top:13px;">' +
          '<button class="knopka-osnovnaya" data-deystvie="approved" type="button">Одобрить</button>' +
          '<button class="knopka-vtorichnaya" data-deystvie="rejected" type="button">Отклонить</button>' +
          '</div>' +
          '</article>';
      }).join('');

      // После рендеринга вешаем обработчики на чекбоксы чеклиста, чтобы сохранять состояние
      document.querySelectorAll('.mod-checklist').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var article = this.closest('[data-zayavka-id]');
          if (!article) return;
          var id = article.dataset.zayavkaId;
          var checklist = [];
          article.querySelectorAll('.mod-checklist').forEach(function (c) {
            checklist.push(c.checked);
          });
          // Сохраняем чеклист в заявке
          var request = EcoAuth.updateRequest(id, { moderationChecklist: checklist });
          if (!request) console.warn('Не удалось сохранить чеклист для заявки ' + id);
        });
      });
    }

    // Обработка кликов по кнопкам "Одобрить" / "Отклонить"
    list.addEventListener('click', function (event) {
      var button = event.target.closest('[data-deystvie]');
      if (!button) return;
      var item = button.closest('[data-zayavka-id]');
      if (!item) return;

      var id = item.dataset.zayavkaId;
      var action = button.dataset.deystvie;

      // Для отклонения проверяем, выбрана ли причина
      if (action === 'rejected') {
        var reasonSelect = item.querySelector('[data-prichina]');
        var reasonError = item.querySelector('[data-prichina-oshibka]');
        if (!reasonSelect || !reasonSelect.value) {
          reasonError.hidden = false;
          reasonSelect.focus();
          return;
        }
        reasonError.hidden = true;
        // Сохраняем причину
        EcoAuth.updateRequest(id, {
          status: 'rejected',
          moderationReason: reasonSelect.value
        });
      } else {
        // Одобрение
        EcoAuth.updateRequest(id, {
          status: 'approved',
          moderationReason: ''
        });
      }

      render(); // Перерисовываем список
    });

    render();
  });
})();