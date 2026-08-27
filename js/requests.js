// requests.js — список заявок текущего пользователя
(function () {
  'use strict';

  // экранирование HTML
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

    // соответствие статусов
    var labels = { pending: 'На проверке', approved: 'Принята', rejected: 'Отклонена' };
    var items = EcoAuth.getMyRequests();

    // если только что отправили заявку — показываем сообщение
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

    // рендеринг карточек заявок
    list.innerHTML = items.map(function (item) {
      var reason = item.status === 'rejected' && item.moderationReason
        ? '<p class="zayavka__prichina">' + escapeHtml(item.moderationReason) + '</p>' : '';
      var certificate = item.status === 'approved' && item.certificateUrl
        ? '<a class="zayavka__sertifikat" href="' + escapeHtml(item.certificateUrl) + '" download>Скачать сертификат</a>' : '';
      return '<article class="zayavka">' +
        '<div class="zayavka__verh"><h2>' + escapeHtml(item.title) + '</h2><span class="zayavka__status" data-status="' + escapeHtml(item.status) + '">' + escapeHtml(labels[item.status] || item.status) + '</span></div>' +
        '<p class="zayavka__meta">' + escapeHtml(item.location) + (item.collectionDate ? ', ' + escapeHtml(item.collectionDate) : '') + '</p>' +
        reason + certificate + '</article>';
    }).join('');
  });
})();