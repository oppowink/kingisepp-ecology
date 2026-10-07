(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

    var list = document.getElementById('spisokZayavok');
    var notice = document.getElementById('poslednyayaZayavka');
    if (!list) return;
    if (EcoAuth.refreshRequests) await EcoAuth.refreshRequests('mine');

    var labels = {
      pending: 'На проверке модератора',
      pending_human: 'На проверке модератора',
      human_approved: 'Исходные данные проверены, ждёт расчёт ФА',
      ai_checked: 'ФА рассчитана, ждёт публикацию',
      approved: 'Принята',
      published: 'Опубликована на карте',
      rejected: 'Отклонена'
    };
    var items = EcoAuth.getMyRequests();

    var lastId = sessionStorage.getItem('eco-last-request-id');
    if (notice && lastId) {
      notice.textContent = 'Заявка отправлена';
      notice.dataset.state = 'success';
      notice.hidden = false;
    }
    sessionStorage.removeItem('eco-last-request-id');

    if (!items.length) {
      list.innerHTML = '<p class="zayavki-pusty">Заявок пока нет</p>';
      return;
    }

    list.innerHTML = items.map(function (item) {
      var reason = item.status === 'rejected' && item.moderationReason
        ? '<p class="zayavka__prichina">' + escapeHtml(item.moderationReason) + '</p>' : '';
      var certificate = EcoAuth.isRequestPublished(item) && item.certificateUrl
        ? '<a class="zayavka__sertifikat" href="' + escapeHtml(item.certificateUrl) + '" download>Скачать сертификат</a>' : '';
      var pdf = item.aiResult && item.aiResult.status === 'calculated' ? '<button class="knopka-vtorichnaya" type="button" data-result-pdf="' + escapeHtml(item.id) + '">Скачать расчёт ФА, PDF</button>' : '';
      return '<article class="zayavka">' +
        '<div class="zayavka__verh"><h2>' + escapeHtml(item.title) + '</h2><span class="zayavka__status" data-status="' + escapeHtml(item.status) + '">' + escapeHtml(labels[item.status] || item.status) + '</span></div>' +
        '<p class="zayavka__meta">' + escapeHtml(item.location) + (item.collectionDate ? ', ' + escapeHtml(item.collectionDate) : '') + '</p>' +
        reason + certificate + pdf + '</article>';
    }).join('');
    list.addEventListener('click', async function (event) {
      var button = event.target.closest('[data-result-pdf]'); if (!button) return;
      var item = items.find(function (row) { return row.id === button.dataset.resultPdf; }); if (!item) return;
      button.disabled = true;
      try { await EcoPdf.download(item); }
      catch (_) { button.textContent = 'Не получилось скачать. Нажмите для повтора'; }
      finally { button.disabled = false; }
    });
  });
})();
