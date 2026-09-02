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

  // Краткие уроки для модератора: их можно прочитать или пропустить перед тестом
  var MODERATOR_LESSONS = [
    {
      title: '1. Роль модератора',
      text: 'Модератор проверяет не научный вывод, а качество исходных данных. Его задача - не пропустить заявку, где неверно выбран вид растения, перепутаны точки, не хватает листьев или фотографии не подходят для измерений.'
    },
    {
      title: '2. Проверка вида и набора',
      text: 'В одной заявке должна быть одна точка, одно дерево и 30 листьев. Основной объект - берёза повислая. Если листья относятся к другому виду или набор смешан из разных деревьев, заявку нужно отклонить с понятной причиной.'
    },
    {
      title: '3. Качество фотографий',
      text: 'Каждый лист должен быть снят отдельно, сверху, на светлом фоне. В кадре должны быть видны верхушка, основание, края листовой пластинки и центральная жилка. Размытые, обрезанные и затемнённые фотографии не подходят.'
    },
    {
      title: '4. Повреждения и артефакты',
      text: 'Для расчёта ФА нужны целые листья. Листья с дырками, крупными пятнами, следами насекомых, разрывами, сильным подсыханием или скручиванием исключаются. Если таких листьев много, заявка отклоняется.'
    },
    {
      title: '5. Координаты и дерево',
      text: 'Координаты должны относиться к месту сбора у конкретного дерева. Если точка указана слишком приблизительно, противоречит описанию места или явно находится не там, модератор просит исправление или отклоняет заявку.'
    },
    {
      title: '6. Два этапа проверки',
      text: 'Сначала решение принимает человек-модератор. После одобрения заявка переходит на автоматическую проверку. На карте публикуются только те точки, у которых пройдены оба этапа.'
    }
  ];

  var MODERATOR_TEST = [
    {
      question: 'Что проверяет модератор в первую очередь?',
      options: [
        { value: 'design', label: 'Красоту оформления заявки' },
        { value: 'data_quality', label: 'Качество исходных данных и соответствие методике' },
        { value: 'final_fa', label: 'Окончательный научный вывод по городу' }
      ],
      answer: 'data_quality'
    },
    {
      question: 'Какой набор соответствует одной заявке?',
      options: [
        { value: 'one_tree_30', label: 'Одна точка, одно дерево, 30 листьев' },
        { value: 'many_trees', label: 'Одна точка, несколько деревьев в одном наборе' },
        { value: 'free_count', label: 'Любое количество листьев, если фото хорошие' }
      ],
      answer: 'one_tree_30'
    },
    {
      question: 'Когда лист нельзя принимать для дальнейшего анализа?',
      options: [
        { value: 'flat', label: 'Лист лежит ровно на светлом фоне' },
        { value: 'damaged', label: 'Есть дырки, разрывы или крупные пятна' },
        { value: 'full_frame', label: 'Лист полностью помещается в кадр' }
      ],
      answer: 'damaged'
    },
    {
      question: 'Какая фотография подходит для измерений?',
      options: [
        { value: 'top_clear', label: 'Снята сверху, лист целиком виден, фон светлый' },
        { value: 'angle_shadow', label: 'Снята под углом с сильной тенью' },
        { value: 'many_leaves', label: 'На одном фото сразу много листьев' }
      ],
      answer: 'top_clear'
    },
    {
      question: 'Что делать, если координаты не совпадают с описанием места?',
      options: [
        { value: 'publish_anyway', label: 'Опубликовать, если фотографии хорошие' },
        { value: 'fix_or_reject', label: 'Попросить исправление или отклонить заявку' },
        { value: 'hide_coords', label: 'Удалить координаты и оставить только название' }
      ],
      answer: 'fix_or_reject'
    },
    {
      question: 'На каком этапе точка появляется на карте?',
      options: [
        { value: 'after_send', label: 'Сразу после отправки волонтёром' },
        { value: 'after_human', label: 'После одобрения модератором' },
        { value: 'after_two_checks', label: 'После модерации человеком и автоматической проверки' }
      ],
      answer: 'after_two_checks'
    },
    {
      question: 'Что обязан указать модератор при отклонении?',
      options: [
        { value: 'reason', label: 'Понятную причину отклонения' },
        { value: 'personal_comment', label: 'Личное мнение об участнике' },
        { value: 'new_result', label: 'Новый рассчитанный результат ФА' }
      ],
      answer: 'reason'
    },
    {
      question: 'Почему нельзя смешивать листья разных деревьев?',
      options: [
        { value: 'file_size', label: 'Так фотографии занимают больше места' },
        { value: 'method_break', label: 'Нарушается сопоставимость данных по точке и дереву' },
        { value: 'map_color', label: 'Карта не сможет выбрать цвет маркера' }
      ],
      answer: 'method_break'
    },
    {
      question: 'Что означает статус "Проверена модератором, ждёт нейросеть"?',
      options: [
        { value: 'published', label: 'Точка уже опубликована' },
        { value: 'human_only', label: 'Первый этап пройден, автоматический этап ещё нет' },
        { value: 'rejected', label: 'Заявка отклонена' }
      ],
      answer: 'human_only'
    },
    {
      question: 'Как модератор снижает риск субъективной ошибки?',
      options: [
        { value: 'checklist', label: 'Работает по единому чеклисту и фиксирует причину решения' },
        { value: 'memory', label: 'Проверяет по памяти без критериев' },
        { value: 'speed', label: 'Принимает решение как можно быстрее' }
      ],
      answer: 'checklist'
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
    var adminVolunteerCert = document.getElementById('adminSertifikatVolontera');
    var adminModeratorCert = document.getElementById('adminSertifikatModeratora');
    var roleForm = document.getElementById('adminRolForma');
    var roleEmail = document.getElementById('adminRolEmail');
    var roleValue = document.getElementById('adminRolZnachenie');
    var roleMessage = document.getElementById('adminRolSoobshchenie');
    var moderatorTraining = document.getElementById('moderatorObuchenie');
    var moderatorLessons = document.getElementById('moderatorUroki');
    var moderatorTest = document.getElementById('moderatorTest');
    var moderatorQuestions = document.getElementById('moderatorTestVoprosy');
    var moderatorSkip = document.getElementById('moderatorKTestu');
    var moderatorCert = document.getElementById('moderatorSertifikat');
    var moderatorMessage = document.getElementById('moderatorObuchenieSoobshchenie');
    if (!list || !denied) return;

    if (!['moderator', 'admin'].includes(user.role)) {
      denied.hidden = false;
      list.hidden = true;
      return;
    }

    list.hidden = false;
    if (moderatorTraining) moderatorTraining.hidden = false;
    if (adminPanel) adminPanel.hidden = user.role !== 'admin';
    if (EcoAuth.refreshRequests) await EcoAuth.refreshRequests('all');

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
      var passed = EcoAuth.isModeratorExamCompleted && EcoAuth.isModeratorExamCompleted(user.email);
      [moderatorCert, adminModeratorCert].forEach(function (button) {
        if (!button) return;
        button.disabled = !passed;
        button.title = passed ? '' : 'Сертификат доступен после теста модератора на 9 из 10';
      });
      if (passed) showModeratorMessage('Тест модератора пройден. Сертификат доступен.', 'success');
    }

    function renderModeratorTraining() {
      if (moderatorLessons) {
        moderatorLessons.innerHTML = MODERATOR_LESSONS.map(function (lesson) {
          return '<article class="moderator-urok">' +
            '<h3>' + escapeHtml(lesson.title) + '</h3>' +
            '<p>' + escapeHtml(lesson.text) + '</p>' +
            '</article>';
        }).join('');
      }

      if (moderatorQuestions) {
        moderatorQuestions.innerHTML = MODERATOR_TEST.map(function (item, index) {
          var name = 'moderator-question-' + index;
          var titleId = 'moderator-question-title-' + index;
          var options = item.options.map(function (option) {
            return '<label class="moderator-variant">' +
              '<input name="' + name + '" type="radio" value="' + escapeHtml(option.value) + '">' +
              '<span>' + escapeHtml(option.label) + '</span>' +
              '</label>';
          }).join('');
          return '<div class="moderator-vopros" role="group" aria-labelledby="' + titleId + '">' +
            '<p id="' + titleId + '">' + (index + 1) + '. ' + escapeHtml(item.question) + '</p>' +
            options +
            '</div>';
        }).join('');
      }

      updateModeratorCertificateButtons();
    }

    function openModeratorTest() {
      if (!moderatorTest) return;
      moderatorTest.hidden = false;
      moderatorTest.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          '<p class="moderaciya-status">Статус: ' + escapeHtml(statusLabel(item)) + '</p>' +
          '<div class="moderaciya-foto" style="display:flex; flex-wrap:wrap; gap:6px; margin:10px 0;">' + photosHtml + '</div>' +
          '<div class="moderaciya-checklist" style="margin:12px 0; padding:10px; background:var(--surface-soft);">' +
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
          humanButtons +
          aiButton +
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

    if (adminVolunteerCert) {
      adminVolunteerCert.addEventListener('click', function () {
        var approved = EcoAuth.getAllRequests().find(isPublished);
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

    if (adminModeratorCert) {
      adminModeratorCert.addEventListener('click', openModeratorCertificate);
    }

    if (moderatorCert) {
      moderatorCert.addEventListener('click', openModeratorCertificate);
    }

    if (moderatorSkip) {
      moderatorSkip.addEventListener('click', openModeratorTest);
    }

    if (moderatorTest) {
      moderatorTest.addEventListener('submit', function (event) {
        event.preventDefault();
        var answers = {};
        var unanswered = false;
        var score = 0;

        MODERATOR_TEST.forEach(function (item, index) {
          var selected = moderatorTest.querySelector('input[name="moderator-question-' + index + '"]:checked');
          if (!selected) unanswered = true;
          answers[index] = selected ? selected.value : '';
          if (selected && selected.value === item.answer) score += 1;
        });

        if (unanswered) {
          showModeratorMessage('Ответьте на все вопросы теста.', 'error');
          return;
        }

        var record = EcoAuth.completeModeratorExam({
          score: score,
          total: MODERATOR_TEST.length,
          answers: answers
        });

        if (record && record.completed) {
          showModeratorMessage('Тест модератора пройден: ' + score + '/10. Сертификат доступен.', 'success');
          updateModeratorCertificateButtons();
        } else {
          showModeratorMessage('Результат: ' + score + '/10. Для допуска нужно 9/10, попробуйте ещё раз.', 'error');
        }
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

    renderModeratorTraining();
    render();
  });
})();
