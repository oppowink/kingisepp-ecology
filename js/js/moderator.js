// moderator.js — прототип проверки заявок (localStorage)
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  var REJECTION_REASONS = [
    { value: 'wrong_species', label: 'Неверный вид (не берёза повислая)' },
    { value: 'damaged_leaves', label: 'Повреждённые листья' },
    { value: 'unreadable_photos', label: 'Нечитаемые фото (тень, размытие, ракурс)' },
    { value: 'not_enough_photos', label: 'Недостаточно фото (меньше 30)' },
    { value: 'wrong_background', label: 'Неправильный фон (не белый)' },
    { value: 'invalid_coords', label: 'Неверные координаты' },
    { value: 'other', label: 'Другое' }
  ];

  var CHECKLIST_ITEMS = [
    'Вид определён верно (берёза повислая)',
    'Фон светлый (автопроверка пройдена)',
    'Лист целый, без повреждений',
    'Видна центральная жилка по всей длине',
    'Указаны координаты и дата сбора',
    'Количество фото: 30 из 30'
  ];

  var STATUS_LABELS = {
    pending: 'На проверке',
    approved: 'Одобрена',
    rejected: 'Отклонена'
  };

  var currentFilter = 'pending';

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

    var denied = document.getElementById('moderaciyaNetDostupa');
    var workspace = document.getElementById('moderaciyaRabocha');
    var list = document.getElementById('moderaciyaSpisok');
    var summary = document.getElementById('moderaciyaSvodka');
    var toast = document.getElementById('moderaciyaSoobshchenie');
    if (!list || !denied || !workspace) return;

    if (!['moderator', 'admin'].includes(user.role)) {
      denied.hidden = false;
      workspace.hidden = true;
      return;
    }

    denied.hidden = true;
    workspace.hidden = false;

    function showToast(text, state) {
      if (!toast) return;
      toast.textContent = text || '';
      toast.dataset.state = state || '';
      toast.hidden = !text;
      if (text) {
        window.setTimeout(function () {
          if (toast.textContent === text) toast.hidden = true;
        }, 3200);
      }
    }

    function counts(all) {
      return {
        pending: all.filter(function (i) { return i.status === 'pending'; }).length,
        approved: all.filter(function (i) { return i.status === 'approved'; }).length,
        rejected: all.filter(function (i) { return i.status === 'rejected'; }).length,
        all: all.length
      };
    }

    function updateSummary(all) {
      if (!summary) return;
      var c = counts(all);
      summary.innerHTML =
        '<span class="moderaciya-svodka__item"><strong>' + c.pending + '</strong> на проверке</span>' +
        '<span class="moderaciya-svodka__item"><strong>' + c.approved + '</strong> одобрено</span>' +
        '<span class="moderaciya-svodka__item"><strong>' + c.rejected + '</strong> отклонено</span>';
    }

    function filtered(all) {
      if (currentFilter === 'all') return all;
      return all.filter(function (i) { return i.status === currentFilter; });
    }

    function reasonLabel(value) {
      var found = REJECTION_REASONS.find(function (r) { return r.value === value; });
      return found ? found.label : value;
    }

    function render() {
      var all = EcoAuth.getAllRequests();
      updateSummary(all);
      var requests = filtered(all);

      if (!requests.length) {
        var emptyText = {
          pending: 'Нет заявок на проверке.',
          approved: 'Одобренных заявок пока нет.',
          rejected: 'Отклонённых заявок пока нет.',
          all: 'Заявок пока нет. Они появятся после отправки наблюдений участниками.'
        };
        list.innerHTML = '<p class="zayavki-pusty">' + (emptyText[currentFilter] || emptyText.all) + '</p>';
        return;
      }

      list.innerHTML = requests.map(function (item) {
        var checklistHtml = CHECKLIST_ITEMS.map(function (label, idx) {
          var checked = item.moderationChecklist && item.moderationChecklist[idx] ? 'checked' : '';
          var disabled = item.status !== 'pending' ? 'disabled' : '';
          return '<label class="moderaciya-check-item">' +
            '<input type="checkbox" class="mod-checklist" data-idx="' + idx + '" ' + checked + ' ' + disabled + '>' +
            '<span>' + escapeHtml(label) + '</span></label>';
        }).join('');

        var reasonOptions = REJECTION_REASONS.map(function (r) {
          var selected = item.moderationReason === r.value ? 'selected' : '';
          return '<option value="' + r.value + '" ' + selected + '>' + escapeHtml(r.label) + '</option>';
        }).join('');

        var photosHtml = '';
        if (item.files && item.files.length) {
          photosHtml = '<p class="moderaciya-foto-meta">Фото в заявке: ' + item.files.length +
            ' <span class="moderaciya-muted">(превью появятся после Storage)</span></p>';
        }

        var status = item.status || 'pending';
        var actions = '';
        if (status === 'pending') {
          actions =
            '<div class="moderaciya-prichina pole-gruppa">' +
            '<label class="pole-podpis" for="prichina-' + escapeHtml(item.id) + '">Причина отклонения</label>' +
            '<select class="pole-vybor" id="prichina-' + escapeHtml(item.id) + '" data-prichina>' +
            '<option value="">Выберите причину</option>' + reasonOptions +
            '</select>' +
            '<p class="pole-oshibka" data-prichina-oshibka hidden>Выберите причину отклонения</p>' +
            '</div>' +
            '<div class="moderaciya-deystviya">' +
            '<button class="knopka-osnovnaya" data-deystvie="approved" type="button">Одобрить</button>' +
            '<button class="knopka-vtorichnaya" data-deystvie="rejected" type="button">Отклонить</button>' +
            '</div>';
        } else if (status === 'rejected' && item.moderationReason) {
          actions = '<p class="moderaciya-itog">Причина: ' + escapeHtml(reasonLabel(item.moderationReason)) + '</p>';
        }

        return '<article class="moderaciya-zayavka" data-zayavka-id="' + escapeHtml(item.id) + '" data-status="' + escapeHtml(status) + '">' +
          '<div class="moderaciya-zayavka__verh">' +
          '<h2>' + escapeHtml(item.title) + '</h2>' +
          '<span class="moderaciya-badge" data-status="' + escapeHtml(status) + '">' +
          escapeHtml(STATUS_LABELS[status] || status) + '</span></div>' +
          '<p class="moderaciya-meta">' + escapeHtml(item.userName || '') +
          (item.userEmail ? ' · ' + escapeHtml(item.userEmail) : '') + '</p>' +
          '<p class="moderaciya-dannye">' + escapeHtml(item.location || '') +
          (item.collectionDate ? ' · ' + escapeHtml(item.collectionDate) : '') +
          (item.coordinates ? ' · ' + escapeHtml(item.coordinates) : '') + '</p>' +
          photosHtml +
          '<div class="moderaciya-checklist">' +
          '<span class="mod-checklist-title">Чеклист модератора</span>' +
          checklistHtml +
          '</div>' +
          actions +
          '</article>';
      }).join('');
    }

    document.querySelectorAll('.moderaciya-filtr').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentFilter = btn.dataset.filter || 'pending';
        document.querySelectorAll('.moderaciya-filtr').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        render();
      });
    });

    list.addEventListener('change', function (event) {
      var cb = event.target.closest('.mod-checklist');
      if (!cb || cb.disabled) return;
      var article = cb.closest('[data-zayavka-id]');
      if (!article) return;
      var id = article.dataset.zayavkaId;
      var checklist = [];
      article.querySelectorAll('.mod-checklist').forEach(function (c) {
        checklist.push(c.checked);
      });
      EcoAuth.updateRequest(id, { moderationChecklist: checklist });
    });

    list.addEventListener('click', function (event) {
      var button = event.target.closest('[data-deystvie]');
      if (!button) return;
      var item = button.closest('[data-zayavka-id]');
      if (!item) return;

      var id = item.dataset.zayavkaId;
      var action = button.dataset.deystvie;

      if (action === 'rejected') {
        var reasonSelect = item.querySelector('[data-prichina]');
        var reasonError = item.querySelector('[data-prichina-oshibka]');
        if (!reasonSelect || !reasonSelect.value) {
          if (reasonError) reasonError.hidden = false;
          if (reasonSelect) reasonSelect.focus();
          return;
        }
        if (reasonError) reasonError.hidden = true;
        EcoAuth.updateRequest(id, {
          status: 'rejected',
          moderationReason: reasonSelect.value
        });
        showToast('Заявка отклонена', 'success');
      } else if (action === 'approved') {
        EcoAuth.updateRequest(id, {
          status: 'approved',
          moderationReason: ''
        });
        showToast('Заявка одобрена', 'success');
      }

      render();
    });

    render();
  });
})();
