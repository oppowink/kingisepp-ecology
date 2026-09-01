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
    var adminPanel = document.getElementById('adminPanel');
    var adminStats = document.getElementById('adminStatistika');
    var adminVolunteerCert = document.getElementById('adminSertifikatVolontera');
    var roleForm = document.getElementById('adminRolForma');
    var roleEmail = document.getElementById('adminRolEmail');
    var roleValue = document.getElementById('adminRolZnachenie');
    var roleMessage = document.getElementById('adminRolSoobshchenie');
    if (!list || !denied) return;

    if (!['moderator', 'admin'].includes(user.role)) {
      denied.hidden = false;
      list.hidden = true;
      return;
    }

    list.hidden = false;
    if (adminPanel) adminPanel.hidden = user.role !== 'admin';

    function showRoleMessage(text, state) {
      if (!roleMessage) return;
      roleMessage.textContent = text || '';
      roleMessage.dataset.state = state || '';
      roleMessage.hidden = !text;
    }

    function renderAdminStats(requests) {
      if (!adminStats) return;
      var total = requests.length;
      var approved = requests.filter(function (item) { return item.status === 'approved'; }).length;
      var pending = requests.filter(function (item) { return item.status === 'pending'; }).length;
      var rejected = requests.filter(function (item) { return item.status === 'rejected'; }).length;
      var trees = requests.reduce(function (sum, item) { return sum + Number(item.treeCount || 1); }, 0);
      var leaves = requests.reduce(function (sum, item) { return sum + Number(item.leafCount || 30); }, 0);

      adminStats.innerHTML =
        '<dt>Всего заявок</dt><dd>' + total + '</dd>' +
        '<dt>На проверке</dt><dd>' + pending + '</dd>' +
        '<dt>Одобрено точек</dt><dd>' + approved + '</dd>' +
        '<dt>Отклонено</dt><dd>' + rejected + '</dd>' +
        '<dt>Деревьев в заявках</dt><dd>' + trees + '</dd>' +
        '<dt>Листьев в заявках</dt><dd>' + leaves + '</dd>';
    }

    function render() {
      var requests = EcoAuth.getAllRequests();
      renderAdminStats(requests);
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
          moderationReason: reasonSelect.value,
          moderatedAt: new Date().toISOString()
        });
      } else {
        // Одобрение
        EcoAuth.updateRequest(id, {
          status: 'approved',
          moderationReason: '',
          approvedAt: new Date().toISOString(),
          moderatedAt: new Date().toISOString()
        });
      }

      render(); // Перерисовываем список
    });

    if (adminVolunteerCert) {
      adminVolunteerCert.addEventListener('click', function () {
        var approved = EcoAuth.getAllRequests().find(function (item) { return item.status === 'approved'; });
        EcoAuth.openVolunteerCertificate({
          user: {
            name: approved ? approved.userName : (user.name || 'Волонтёр проекта'),
            email: approved ? approved.userEmail : user.email
          },
          pointTitle: approved ? approved.title : 'Тестовая подтверждённая точка',
          date: new Date().toLocaleDateString('ru-RU')
        });
      });
    }

    if (roleForm) {
      roleForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        showRoleMessage('');
        try {
          var updated = await EcoAuth.setUserRole(roleEmail.value, roleValue.value);
          showRoleMessage('Роль сохранена: ' + (updated?.email || roleEmail.value) + ' -> ' + roleValue.value + '.', 'success');
          roleForm.reset();
          roleValue.value = 'moderator';
        } catch (error) {
          var code = String(error && error.message || '');
          var text = code === 'USER_NOT_FOUND'
            ? 'Пользователь с таким e-mail не найден.'
            : code === 'ADMIN_REQUIRED'
              ? 'Назначать роли может только админ.'
              : 'Не удалось сохранить роль. Проверьте Supabase и права админа.';
          showRoleMessage(text, 'error');
        }
      });
    }

    render();
  });
})();
