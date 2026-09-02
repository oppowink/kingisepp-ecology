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

  // Краткие уроки для модератора: один шаг показывается за раз
  var MODERATOR_LESSONS = [
    {
      title: '1. Роль модератора',
      photo: 'moderator_role_check.jpg',
      text: 'Модератор проверяет не научный вывод, а качество исходных данных. Его задача - не пропустить заявку, где неверно выбран вид растения, перепутаны точки, не хватает листьев или фотографии не подходят для измерений.'
    },
    {
      title: '2. Проверка вида и набора',
      photo: 'moderator_species_check.jpg',
      text: 'В одной заявке должна быть одна точка, одно дерево и 30 листьев. Основной объект - берёза повислая. Если листья относятся к другому виду или набор смешан из разных деревьев, заявку нужно отклонить с понятной причиной.'
    },
    {
      title: '3. Качество фотографий',
      photo: 'moderator_good_bad_photo.jpg',
      text: 'Каждый лист должен быть снят отдельно, сверху, на светлом фоне. В кадре должны быть видны верхушка, основание, края листовой пластинки и центральная жилка. Размытые, обрезанные и затемнённые фотографии не подходят.'
    },
    {
      title: '4. Повреждения и артефакты',
      photo: 'moderator_damaged_leaf_examples.jpg',
      text: 'Для расчёта ФА нужны целые листья. Листья с дырками, крупными пятнами, следами насекомых, разрывами, сильным подсыханием или скручиванием исключаются. Если таких листьев много, заявка отклоняется.'
    },
    {
      title: '5. Координаты и дерево',
      photo: 'moderator_point_tree_scheme.jpg',
      text: 'Координаты должны относиться к месту сбора у конкретного дерева. Если точка указана слишком приблизительно, противоречит описанию места или явно находится не там, модератор просит исправление или отклоняет заявку.'
    },
    {
      title: '6. Два этапа проверки',
      photo: 'moderator_status_pipeline.jpg',
      text: 'Сначала решение принимает человек-модератор. После одобрения заявка переходит на автоматическую проверку. На карте публикуются только те точки, у которых пройдены оба этапа.'
    }
  ];

  function isHumanPending(item) {
    return item.status === 'pending' || item.status === 'pending_human' || item.humanStatus === 'pending';
  }

  function isHumanApproved(item) {
    return item.status === 'human_approved' || item.humanStatus === 'approved';
  }

  function isPublished(item) {
    return window.EcoAuth && typeof EcoAuth.isRequestPublished === 'function'
      ? EcoAuth.isRequestPublished(item)
      : item.status === 'published';
  }

  function statusLabel(item) {
    if (item.status === 'rejected' || item.humanStatus === 'rejected') return 'Отклонена модератором';
    if (isPublished(item)) return 'Опубликована на карте';
    if (isHumanApproved(item)) return 'Проверена модератором, ждёт нейросеть';
    return 'На проверке модератора';
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

    var denied = document.getElementById('moderaciyaNetDostupa');
    var list = document.getElementById('moderaciyaSpisok');
    var adminPanel = document.getElementById('adminPanel');
    var adminStats = document.getElementById('adminStatistika');
    var adminRoleButton = document.getElementById('adminNaznachenieRoley');
    var roleForm = document.getElementById('adminRolForma');
    var roleEmail = document.getElementById('adminRolEmail');
    var roleValue = document.getElementById('adminRolZnachenie');
    var roleBlocked = document.getElementById('adminRolBlocked');
    var roleMessage = document.getElementById('adminRolSoobshchenie');
    var requestsSection = document.getElementById('moderaciyaZayavkiRazdel');
    var moderatorTraining = document.getElementById('moderatorObuchenie');
    var moderatorLessons = document.getElementById('moderatorUroki');
    var moderatorFinish = document.getElementById('moderatorZavershitObuchenie');
    var moderatorTestLink = document.getElementById('moderatorKTestu');
    var moderatorCert = document.getElementById('moderatorSertifikat');
    var moderatorMessage = document.getElementById('moderatorObuchenieSoobshchenie');
    var lessonIndex = 0;
    var lessonTimer = null;
    var LESSON_DELAY_SECONDS = 5;
    if (!list || !denied) return;

    if (!['moderator', 'admin'].includes(user.role)) {
      denied.hidden = false;
      list.hidden = true;
      return;
    }

    var isAdmin = user.role === 'admin';
    var isModerator = user.role === 'moderator';
    var moderatorPassed = EcoAuth.isModeratorExamCompleted && EcoAuth.isModeratorExamCompleted(user.email);
    var canModerate = isModerator && moderatorPassed;

    if (moderatorTraining) moderatorTraining.hidden = !isModerator;
    if (adminPanel) adminPanel.hidden = !isAdmin;
    if (requestsSection) requestsSection.hidden = !(isAdmin || canModerate);
    list.hidden = !(isAdmin || canModerate);
    if (EcoAuth.refreshRequests && (isAdmin || canModerate)) await EcoAuth.refreshRequests('all');

    function showRoleMessage(text, state) {
      if (!roleMessage) return;
      roleMessage.textContent = text || '';
      roleMessage.dataset.state = state || '';
      roleMessage.hidden = !text;
    }

    function showModeratorMessage(text, state) {
      if (!moderatorMessage) return;
      moderatorMessage.textContent = text || '';
      moderatorMessage.dataset.state = state || '';
      moderatorMessage.hidden = !text;
    }

    function updateModeratorCertificateButtons() {
      var trainingDone = EcoAuth.isModeratorTrainingCompleted && EcoAuth.isModeratorTrainingCompleted(user.email);
      var passed = EcoAuth.isModeratorExamCompleted && EcoAuth.isModeratorExamCompleted(user.email);
      if (moderatorTestLink) {
        moderatorTestLink.classList.toggle('moderator-test-link--disabled', !trainingDone);
        moderatorTestLink.setAttribute('aria-disabled', String(!trainingDone));
      }
      if (moderatorCert) {
        moderatorCert.disabled = !passed;
        moderatorCert.title = passed ? '' : 'Сертификат доступен после теста модератора на 9 из 10';
      }
      if (passed) showModeratorMessage('Тест модератора пройден. Сертификат доступен.', 'success');
      else if (trainingDone) showModeratorMessage('Обучение завершено. Теперь можно перейти к тесту модератора.', 'success');
      else showModeratorMessage('Модерация откроется после обучения и теста модератора.', 'warning');
    }

    function renderModeratorTraining() {
      var trainingDone = EcoAuth.isModeratorTrainingCompleted && EcoAuth.isModeratorTrainingCompleted(user.email);
      if (!moderatorLessons) {
        updateModeratorCertificateButtons();
        return;
      }
      if (lessonTimer) {
        clearInterval(lessonTimer);
        lessonTimer = null;
      }

      if (trainingDone) {
        moderatorLessons.innerHTML =
          '<article class="moderator-urok">' +
          '<h3>Обучение завершено</h3>' +
          '<p>Откройте отдельную страницу теста. Для доступа к модерации нужно набрать не менее 9 баллов из 10.</p>' +
          '</article>';
        if (moderatorFinish) {
          moderatorFinish.disabled = true;
          moderatorFinish.textContent = 'Обучение завершено';
        }
        updateModeratorCertificateButtons();
        return;
      }

      var lesson = MODERATOR_LESSONS[lessonIndex] || MODERATOR_LESSONS[0];
      moderatorLessons.innerHTML =
        '<article class="moderator-urok">' +
        '<p class="moderator-obuchenie__progress">Шаг ' + (lessonIndex + 1) + ' из ' + MODERATOR_LESSONS.length + '</p>' +
        '<div class="moderator-urok__foto">Фото: ' + escapeHtml(lesson.photo) + '</div>' +
        '<h3>' + escapeHtml(lesson.title) + '</h3>' +
        '<p>' + escapeHtml(lesson.text) + '</p>' +
        '</article>';

      if (moderatorFinish) {
        var secondsLeft = LESSON_DELAY_SECONDS;
        var finalStep = lessonIndex === MODERATOR_LESSONS.length - 1;
        moderatorFinish.disabled = true;
        moderatorFinish.textContent = (finalStep ? 'Завершить обучение' : 'Далее') + ' (' + secondsLeft + ')';
        lessonTimer = setInterval(function () {
          secondsLeft -= 1;
          if (secondsLeft <= 0) {
            clearInterval(lessonTimer);
            lessonTimer = null;
            moderatorFinish.disabled = false;
            moderatorFinish.textContent = finalStep ? 'Завершить обучение и открыть тест' : 'Далее';
            return;
          }
          moderatorFinish.textContent = (finalStep ? 'Завершить обучение' : 'Далее') + ' (' + secondsLeft + ')';
        }, 1000);
      }

      updateModeratorCertificateButtons();
    }

    function renderAdminStats(requests) {
      if (!adminStats) return;
      var total = requests.length;
      var published = requests.filter(isPublished).length;
      var pendingHuman = requests.filter(isHumanPending).length;
      var waitingAi = requests.filter(function (item) { return isHumanApproved(item) && !isPublished(item); }).length;
      var rejected = requests.filter(function (item) { return item.status === 'rejected' || item.humanStatus === 'rejected'; }).length;
      var trees = requests.reduce(function (sum, item) { return sum + Number(item.treeCount || 1); }, 0);
      var leaves = requests.reduce(function (sum, item) { return sum + Number(item.leafCount || 30); }, 0);

      adminStats.innerHTML =
        '<dt>Всего заявок</dt><dd>' + total + '</dd>' +
        '<dt>На проверке модератора</dt><dd>' + pendingHuman + '</dd>' +
        '<dt>Ждут нейросеть</dt><dd>' + waitingAi + '</dd>' +
        '<dt>Опубликовано точек</dt><dd>' + published + '</dd>' +
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
        var humanButtons = isPublished(item)
          ? '<button class="knopka-vtorichnaya" disabled type="button">Опубликована</button>'
          : '<button class="knopka-osnovnaya" data-deystvie="human_approved" type="button">Одобрить модератором</button>' +
            '<button class="knopka-vtorichnaya" data-deystvie="rejected" type="button">Отклонить</button>';
        var aiButton = isHumanApproved(item) && !isPublished(item)
          ? '<button class="knopka-osnovnaya" data-deystvie="ai_checked" type="button">Проверить нейросетью</button>'
          : '';
        var moderationControls = canModerate
          ? '<div class="moderaciya-checklist">' +
            '<span class="mod-checklist-title">Чеклист модератора</span>' +
            checklistHtml +
            '</div>' +
            '<div class="pole-gruppa moderaciya-prichina">' +
            '<label class="pole-podpis" for="prichina-' + escapeHtml(item.id) + '">Причина отклонения</label>' +
            '<select class="pole-vybor" id="prichina-' + escapeHtml(item.id) + '" data-prichina>' +
            '<option value="">Выберите причину</option>' +
            reasonOptions +
            '</select>' +
            '<p class="pole-oshibka" data-prichina-oshibka hidden>Выберите причину отклонения</p>' +
            '</div>' +
            '<div class="moderaciya-deystviya">' +
            humanButtons +
            aiButton +
            '</div>'
          : '<p class="admin-poyasnenie">Режим администратора: просмотр заявки без решения модератора.</p>';

        // Превью обзорного фото дерева и фотографий листьев
        var photosHtml = '';
        var allPhotos = [];
        if (item.treePhoto) allPhotos.push(Object.assign({ photoKind: 'tree' }, item.treePhoto));
        if (item.files && item.files.length) allPhotos = allPhotos.concat(item.files);
        if (allPhotos.length) {
          photosHtml = allPhotos.map(function (f, photoIndex) {
            var src = f.url || f.data;
            var alt = f.photoKind === 'tree' ? 'Обзорная фотография дерева' : 'Фотография листа ' + photoIndex;
            if (src) {
              return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">';
            } else {
              return '<span style="font-size:0.75rem; color:var(--text-muted); margin-right:6px;">' + escapeHtml(f.name) + '</span>';
            }
          }).join('');
        }
        var passportHtml = '<dl class="moderaciya-pasport">' +
          '<dt>Координаты</dt><dd>' + escapeHtml(item.coordinates || 'не указаны') + '</dd>' +
          '<dt>Территория</dt><dd>' + escapeHtml(item.territoryType || 'не указана') + '</dd>' +
          '<dt>До дороги</dt><dd>' + escapeHtml(item.roadDistanceM === null || item.roadDistanceM === undefined ? 'не указано' : item.roadDistanceM + ' м') + '</dd>' +
          '<dt>Транспорт</dt><dd>' + escapeHtml(item.trafficIntensity || 'не определён') + '</dd>' +
          '<dt>Дерево</dt><dd>' + escapeHtml((item.treeSpecies || 'Берёза повислая') + (item.treeCondition ? ', ' + item.treeCondition : '')) + '</dd>' +
          '</dl>';

        return '<article class="moderaciya-zayavka" data-zayavka-id="' + escapeHtml(item.id) + '">' +
          '<h2>' + escapeHtml(item.title) + '</h2>' +
          '<p class="moderaciya-meta">' + escapeHtml(item.userName) + ', ' + escapeHtml(item.userEmail) + '</p>' +
          '<p class="moderaciya-dannye">' + escapeHtml(item.location) + (item.collectionDate ? ', ' + escapeHtml(item.collectionDate) : '') + '</p>' +
          '<p class="moderaciya-status">Статус: ' + escapeHtml(statusLabel(item)) + '</p>' +
          passportHtml +
          '<div class="moderaciya-foto">' + photosHtml + '</div>' +
          moderationControls +
          '</article>';
      }).join('');

      // После рендеринга вешаем обработчики на чекбоксы чеклиста, чтобы сохранять состояние
      if (canModerate) document.querySelectorAll('.mod-checklist').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var article = this.closest('[data-zayavka-id]');
          if (!article) return;
          var id = article.dataset.zayavkaId;
          var checklist = [];
          article.querySelectorAll('.mod-checklist').forEach(function (c) {
            checklist.push(c.checked);
          });
          // Сохраняем чеклист в заявке
          EcoAuth.saveRequestUpdate(id, { moderationChecklist: checklist }).catch(function () {
            console.warn('Не удалось сохранить чеклист для заявки ' + id);
          });
        });
      });
    }

    // Обработка кликов по кнопкам "Одобрить" / "Отклонить"
    list.addEventListener('click', async function (event) {
      var button = event.target.closest('[data-deystvie]');
      if (!button) return;
      if (!canModerate) return;
      var item = button.closest('[data-zayavka-id]');
      if (!item) return;

      var id = item.dataset.zayavkaId;
      var action = button.dataset.deystvie;

      try {
      // Для отклонения проверяем, выбрана ли причина
      if (action === 'rejected') {
        var reasonSelect = item.querySelector('[data-prichina]');
        var reasonError = item.querySelector('[data-prichina-oshibka]');
        if (!reasonSelect || !reasonSelect.value) {
          if (reasonError) reasonError.hidden = false;
          if (reasonSelect) reasonSelect.focus();
          return;
        }
        if (reasonError) reasonError.hidden = true;
        // Сохраняем причину
        await EcoAuth.saveRequestUpdate(id, {
          status: 'rejected',
          humanStatus: 'rejected',
          aiStatus: 'skipped',
          moderationReason: reasonSelect.value,
          moderatedAt: new Date().toISOString()
        });
      } else if (action === 'human_approved') {
        // Первый этап: решение человека-модератора
        await EcoAuth.saveRequestUpdate(id, {
          status: 'human_approved',
          humanStatus: 'approved',
          aiStatus: 'pending',
          moderationReason: '',
          moderatedAt: new Date().toISOString()
        });
      } else if (action === 'ai_checked') {
        // Второй этап: временная заглушка автоматической проверки нейросетью
        await EcoAuth.saveRequestUpdate(id, {
          status: 'published',
          aiStatus: 'checked',
          aiResult: { status: 'checked_stub', message: 'Проверено нейросетью: заглушка' },
          aiCheckedAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString()
        });
      }
      } catch (error) {
        console.error('moderationUpdate', error);
      } finally {
        render(); // Перерисовываем список
      }
    });

    function openModeratorCertificate() {
      if (!(EcoAuth.isModeratorExamCompleted && EcoAuth.isModeratorExamCompleted(user.email))) {
        showModeratorMessage('Сначала пройдите тест модератора минимум на 9 из 10.', 'error');
        return;
      }
      EcoAuth.openModeratorCertificate({
        user: user,
        date: new Date().toLocaleDateString('ru-RU')
      });
    }

    if (moderatorCert) {
      moderatorCert.addEventListener('click', openModeratorCertificate);
    }

    if (moderatorFinish) {
      moderatorFinish.addEventListener('click', function () {
        if (moderatorFinish.disabled) return;
        if (lessonIndex < MODERATOR_LESSONS.length - 1) {
          lessonIndex += 1;
          renderModeratorTraining();
          return;
        }
        EcoAuth.completeModeratorTraining();
        renderModeratorTraining();
        if (moderatorTestLink) moderatorTestLink.focus();
      });
    }

    if (moderatorTestLink) {
      moderatorTestLink.addEventListener('click', function (event) {
        if (!(EcoAuth.isModeratorTrainingCompleted && EcoAuth.isModeratorTrainingCompleted(user.email))) {
          event.preventDefault();
          showModeratorMessage('Сначала завершите обучение модератора.', 'error');
        }
      });
    }

    if (adminRoleButton && roleForm) {
      adminRoleButton.addEventListener('click', function () {
        roleForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (roleEmail) roleEmail.focus();
      });
    }

    if (roleForm) {
      roleForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        showRoleMessage('');
        try {
          var blocked = roleBlocked ? roleBlocked.checked : false;
          var updated = await EcoAuth.setUserRole(roleEmail.value, roleValue.value, { blocked: blocked });
          showRoleMessage('Пользователь сохранён: ' + (updated?.email || roleEmail.value) + ', роль ' + roleValue.value + (blocked ? ', заблокирован.' : ', не заблокирован.'), 'success');
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

    if (isModerator) renderModeratorTraining();
    else if (moderatorLessons) moderatorLessons.innerHTML = '';
    render();
  });
})();
