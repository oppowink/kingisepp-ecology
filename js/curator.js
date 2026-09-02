// curator.js — организации, проекты, объекты, участники и статусы заявок
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;
    var denied = document.getElementById('kuratorNetDostupa');
    var workspace = document.getElementById('kuratorRabochayaOblast');
    var message = document.getElementById('kuratorSoobshchenie');
    if (!['curator', 'admin'].includes(user.role)) {
      denied.hidden = false;
      workspace.hidden = true;
      return;
    }
    denied.hidden = true;
    workspace.hidden = false;

    var dashboard = { organizations: [], projects: [], objects: [], members: [], requests: [] };
    var orgForm = document.getElementById('organizaciyaForma');
    var projectForm = document.getElementById('proektForma');
    var objectForm = document.getElementById('obektForma');
    var assignmentForm = document.getElementById('naznachenieForma');

    function showMessage(text, state) {
      message.textContent = text || '';
      message.dataset.state = state || '';
      message.hidden = !text;
      if (text) message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function statusLabel(item) {
      if (item.status === 'published') return 'Опубликована';
      if (item.status === 'rejected') return 'Отклонена';
      if (item.humanStatus === 'approved') return 'Модератор одобрил, ожидается автопроверка';
      return 'На первичной модерации';
    }

    function fillSelect(select, rows, label, placeholder) {
      select.replaceChildren(new Option(placeholder, ''));
      rows.forEach(function (row) { select.appendChild(new Option(label(row), row.id)); });
    }

    function updateObjectProjectOptions() {
      var organizationId = document.getElementById('obektOrganizaciya').value;
      var projects = organizationId
        ? dashboard.projects.filter(function (row) { return row.organizationId === organizationId; })
        : [];
      fillSelect(document.getElementById('obektProekt'), projects, function (row) { return row.title; }, 'Выберите проект');
    }

    function card(title, lines, code) {
      var article = document.createElement('article');
      article.className = 'kurator-kartochka';
      var heading = document.createElement('h3');
      heading.textContent = title;
      article.appendChild(heading);
      lines.filter(Boolean).forEach(function (line) {
        var paragraph = document.createElement('p');
        paragraph.textContent = line;
        article.appendChild(paragraph);
      });
      if (code) {
        var codeElement = document.createElement('span');
        codeElement.className = 'kurator-kod';
        codeElement.textContent = 'Код: ' + code;
        article.appendChild(codeElement);
      }
      return article;
    }

    function render() {
      var organizations = document.getElementById('organizaciiSpisok');
      organizations.replaceChildren();
      dashboard.organizations.forEach(function (org) {
        organizations.appendChild(card(org.name, [org.city, org.description], org.joinCode));
      });
      if (!dashboard.organizations.length) organizations.appendChild(card('Организаций пока нет', ['Создайте первую организацию, чтобы получить код подключения.']));

      fillSelect(document.getElementById('proektOrganizaciya'), dashboard.organizations, function (row) { return row.name; }, 'Выберите организацию');
      fillSelect(document.getElementById('obektOrganizaciya'), dashboard.organizations, function (row) { return row.name; }, 'Выберите организацию');
      updateObjectProjectOptions();
      fillSelect(document.getElementById('naznachenieObekt'), dashboard.objects, function (row) { return row.title; }, 'Выберите объект');

      var participantMembers = dashboard.members.filter(function (member) { return member.memberRole === 'participant'; });
      fillSelect(document.getElementById('naznachenieUchastnik'), participantMembers, function (row) {
        return row.profile?.name || row.profile?.email || row.userId;
      }, 'Выберите участника');

      var objects = document.getElementById('obektySpisok');
      objects.replaceChildren();
      dashboard.objects.forEach(function (object) {
        var project = dashboard.projects.find(function (item) { return item.id === object.projectId; });
        objects.appendChild(card(object.title, [project?.title || '', object.addressHint, object.dueDate ? 'Срок: ' + object.dueDate : '', object.visibility === 'public' ? 'Открыт всем' : 'Только организация']));
      });
      if (!dashboard.objects.length) objects.appendChild(card('Объектов пока нет', ['Сначала создайте проект, затем добавьте территорию.']));

      var membersBody = document.getElementById('uchastnikiSpisok');
      membersBody.replaceChildren();
      participantMembers.forEach(function (member) {
        var tr = document.createElement('tr');
        var org = dashboard.organizations.find(function (item) { return item.id === member.organizationId; });
        var requestCount = dashboard.requests.filter(function (request) { return request.userId === member.userId; }).length;
        [member.profile?.name || member.profile?.email || member.userId, member.profile?.city || 'Не указан', org?.name || '', String(requestCount)].forEach(function (value) {
          var td = document.createElement('td'); td.textContent = value; tr.appendChild(td);
        });
        membersBody.appendChild(tr);
      });
      if (!participantMembers.length) {
        var tr = document.createElement('tr');
        var td = document.createElement('td'); td.colSpan = 4; td.textContent = 'Участники появятся после входа по коду организации.'; tr.appendChild(td); membersBody.appendChild(tr);
      }

      var statuses = document.getElementById('statusySpisok');
      statuses.replaceChildren();
      dashboard.requests.forEach(function (request) {
        statuses.appendChild(card(request.title || request.id, [request.userName || request.userEmail, statusLabel(request), request.collectionDate || '']));
      });
      if (!dashboard.requests.length) statuses.appendChild(card('Заявок пока нет', ['Здесь появятся заявки участников, привязанные к вашим объектам.']));
    }

    async function reload() {
      dashboard = await EcoAuth.getCuratorDashboard();
      dashboard.organizations = dashboard.organizations || [];
      dashboard.projects = dashboard.projects || [];
      dashboard.objects = dashboard.objects || [];
      dashboard.members = dashboard.members || [];
      dashboard.requests = dashboard.requests || [];
      render();
    }

    document.getElementById('obektOrganizaciya').addEventListener('change', updateObjectProjectOptions);

    orgForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      try {
        await EcoAuth.createOrganization({ name: document.getElementById('organizaciyaNazvanie').value,
          type: document.getElementById('organizaciyaTip').value, city: document.getElementById('organizaciyaGorod').value,
          description: document.getElementById('organizaciyaOpisanie').value });
        orgForm.reset(); await reload(); showMessage('Организация создана. Код подключения показан в карточке.', 'success');
      } catch (_) { showMessage('Не удалось создать организацию.', 'error'); }
    });

    projectForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      try {
        await EcoAuth.createMonitoringProject({ organizationId: document.getElementById('proektOrganizaciya').value,
          title: document.getElementById('proektNazvanie').value, description: document.getElementById('proektOpisanie').value,
          city: document.getElementById('proektGorod').value, visibility: document.getElementById('proektVidimost').value,
          startsAt: document.getElementById('proektNachalo').value, endsAt: document.getElementById('proektKonec').value });
        projectForm.reset(); await reload(); showMessage('Проект создан.', 'success');
      } catch (_) { showMessage('Не удалось создать проект.', 'error'); }
    });

    objectForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      try {
        await EcoAuth.createMonitoringObject({ organizationId: document.getElementById('obektOrganizaciya').value,
          projectId: document.getElementById('obektProekt').value, title: document.getElementById('obektNazvanie').value,
          description: document.getElementById('obektOpisanie').value, city: document.getElementById('obektGorod').value,
          addressHint: document.getElementById('obektAdres').value, radiusM: document.getElementById('obektRadius').value,
          requiredPoints: document.getElementById('obektTochki').value, dueDate: document.getElementById('obektSrok').value,
          centerLat: document.getElementById('obektShirota').value, centerLng: document.getElementById('obektDolgota').value,
          visibility: document.getElementById('obektVidimost').value });
        objectForm.reset(); await reload(); showMessage('Объект создан и доступен участникам по заданным правилам.', 'success');
      } catch (_) { showMessage('Не удалось создать объект. Проверьте организацию и проект.', 'error'); }
    });

    assignmentForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      try {
        await EcoAuth.assignMonitoringObject({ userId: document.getElementById('naznachenieUchastnik').value,
          objectId: document.getElementById('naznachenieObekt').value });
        showMessage('Объект назначен участнику.', 'success');
      } catch (_) { showMessage('Не удалось назначить объект.', 'error'); }
    });

    try { await reload(); } catch (_) { showMessage('Не удалось загрузить кабинет. Выполните миграцию 005 и обновите деплой.', 'error'); }
  });
})();
