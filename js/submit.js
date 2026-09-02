// submit.js — карта выбора координат, паспорт территории, фотографии и отправка заявки
(function () {
  'use strict';

  var MAX_PHOTOS = 30;

  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

    var form = document.getElementById('formaNablyudeniya');
    var locked = document.getElementById('podachaBlokirovka');
    if (!form || !locked) return;

    var educationDone = EcoAuth.isEducationCompleted(user.email);
    if (!educationDone && EcoAuth.refreshEducationStatus) educationDone = await EcoAuth.refreshEducationStatus();
    if (!educationDone) {
      locked.hidden = false;
      form.hidden = true;
      return;
    }
    form.hidden = false;
    locked.hidden = true;

    var fileInput = document.getElementById('faylyNablyudeniya');
    var treeFileInput = document.getElementById('fotoDereva');
    var dropArea = document.getElementById('zagruzkaFoto');
    var photoCounter = document.getElementById('schetchikFoto');
    var treePhotoCounter = document.getElementById('schetchikFotoDereva');
    var photoError = document.getElementById('oshibkaFoto');
    var formError = document.getElementById('oshibkaPodachi');
    var dateInput = document.getElementById('dataSbora');
    var coordinatesInput = document.getElementById('koordinatyNablyudeniya');
    var coordinateStatus = document.getElementById('kartaVyborStatus');
    var objectGroup = document.getElementById('obektNablyudeniyaGruppa');
    var objectSelect = document.getElementById('obektNablyudeniya');
    var objectDescription = document.getElementById('obektNablyudeniyaOpisanie');
    var submitButton = form.querySelector('button[type="submit"]');
    var selectedFiles = [];
    var selectedTreeFile = null;
    var participationContext = { memberships: [], projects: [], objects: [] };
    var pickerMap = null;
    var pickerMarker = null;

    var now = new Date();
    var localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (dateInput) dateInput.max = localToday;

    function showError(text) {
      if (!formError) return;
      formError.textContent = text || '';
      formError.dataset.state = text ? 'error' : '';
      formError.hidden = !text;
    }

    function setBusy(busy, label) {
      if (!submitButton) return;
      submitButton.disabled = Boolean(busy);
      submitButton.textContent = busy ? (label || 'Сохраняем…') : 'Отправить точку на проверку';
    }

    function validCoordinates(value) {
      var parts = String(value || '').split(',').map(function (part) { return part.trim(); });
      if (parts.length !== 2) return false;
      var latitude = Number(parts[0]);
      var longitude = Number(parts[1]);
      return Number.isFinite(latitude) && Number.isFinite(longitude) &&
        latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
    }

    function setCoordinates(coords) {
      var latitude = Number(coords[0]);
      var longitude = Number(coords[1]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      var value = latitude.toFixed(6) + ', ' + longitude.toFixed(6);
      coordinatesInput.value = value;
      coordinateStatus.textContent = 'Выбрано: ' + value;
      coordinateStatus.dataset.state = 'selected';
      if (!pickerMarker) {
        pickerMarker = new ymaps.Placemark([latitude, longitude], {}, {
          draggable: true,
          iconLayout: 'default#image',
          iconImageHref: 'img/icons/map-point-active.png',
          iconImageSize: [39, 45],
          iconImageOffset: [-19, -42]
        });
        pickerMarker.events.add('dragend', function () { setCoordinates(pickerMarker.geometry.getCoordinates()); });
        pickerMap.geoObjects.add(pickerMarker);
      } else {
        pickerMarker.geometry.setCoordinates([latitude, longitude]);
      }
    }

    function createCoordinatePicker() {
      if (typeof ymaps === 'undefined') {
        coordinateStatus.textContent = 'Карта не загрузилась. Проверьте подключение и ключ Яндекс Карт.';
        return;
      }
      ymaps.ready(function () {
        pickerMap = new ymaps.Map('kartaVyborKoordinat', {
          center: [59.378, 28.612],
          zoom: 13,
          controls: ['zoomControl', 'geolocationControl', 'fullscreenControl']
        });
        pickerMap.events.add('click', function (event) { setCoordinates(event.get('coords')); });
      });
    }

    function checkBackground(imageFile) {
      return new Promise(function (resolve) {
        var img = new Image();
        var objectUrl = URL.createObjectURL(imageFile);
        img.onload = function () {
          try {
            var size = 180;
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = size;
            canvas.height = size;
            ctx.drawImage(img, 0, 0, size, size);
            var corners = [[0, 0], [size - 16, 0], [0, size - 16], [size - 16, size - 16]];
            var total = 0;
            var count = 0;
            corners.forEach(function (corner) {
              var data = ctx.getImageData(corner[0], corner[1], 16, 16).data;
              for (var i = 0; i < data.length; i += 4) {
                total += (data[i] + data[i + 1] + data[i + 2]) / 3;
                count += 1;
              }
            });
            resolve(total / count > 200);
          } catch (_) { resolve(null); }
          URL.revokeObjectURL(objectUrl);
        };
        img.onerror = function () { URL.revokeObjectURL(objectUrl); resolve(null); };
        img.src = objectUrl;
      });
    }

    function setFiles(files) {
      selectedFiles = Array.from(files || []).filter(function (file) {
        return file.type.startsWith('image/') && file.size <= 12582912;
      }).slice(0, MAX_PHOTOS);
      photoCounter.textContent = selectedFiles.length + ' / ' + MAX_PHOTOS + ' фотографий';
      photoError.hidden = true;
      selectedFiles.forEach(function (file) {
        checkBackground(file).then(function (isLight) { file._bgLight = isLight; });
      });
    }

    function selectedSourceMode() {
      return form.querySelector('input[name="sourceMode"]:checked')?.value || 'own';
    }

    function selectedObject() {
      return participationContext.objects.find(function (item) { return item.id === objectSelect.value; }) || null;
    }

    function renderObjects() {
      objectSelect.replaceChildren(new Option('Выберите объект', ''));
      participationContext.objects.forEach(function (item) {
        var organization = (participationContext.memberships || []).find(function (membership) {
          return membership.organizationId === item.organizationId;
        });
        var prefix = item.assigned ? 'Назначено вам' : item.visibility === 'public' ? 'Открытый проект' : 'Ваша организация';
        var suffix = organization?.organization?.name ? ' · ' + organization.organization.name : '';
        objectSelect.appendChild(new Option(prefix + ': ' + item.title + suffix, item.id));
      });
      var objectRadio = form.querySelector('input[name="sourceMode"][value="object"]');
      if (objectRadio) objectRadio.disabled = participationContext.objects.length === 0;
    }

    async function loadParticipationContext() {
      try {
        participationContext = await EcoAuth.getParticipationContext();
        participationContext.objects = Array.isArray(participationContext.objects) ? participationContext.objects : [];
        renderObjects();
      } catch (_) {
        participationContext = { memberships: [], projects: [], objects: [] };
        renderObjects();
      }
    }

    form.querySelectorAll('input[name="sourceMode"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        objectGroup.hidden = selectedSourceMode() !== 'object';
        objectSelect.required = selectedSourceMode() === 'object';
      });
    });

    objectSelect.addEventListener('change', function () {
      var object = selectedObject();
      if (!object) {
        objectDescription.textContent = '';
        return;
      }
      objectDescription.textContent = [object.description, object.addressHint, object.dueDate ? 'Срок: ' + object.dueDate : ''].filter(Boolean).join(' · ');
      var titleInput = document.getElementById('nazvanieNablyudeniya');
      var locationInput = document.getElementById('mestoNablyudeniya');
      if (!titleInput.value) titleInput.value = object.title;
      if (!locationInput.value && object.addressHint) locationInput.value = object.addressHint;
      if (pickerMap && Number.isFinite(Number(object.centerLat)) && Number.isFinite(Number(object.centerLng))) {
        pickerMap.setCenter([Number(object.centerLat), Number(object.centerLng)], 16, { duration: 250 });
        coordinateStatus.textContent = 'Объект найден. Нажмите на точное место дерева внутри территории.';
        coordinateStatus.dataset.state = '';
      }
    });

    fileInput.addEventListener('change', function () { setFiles(fileInput.files); });
    treeFileInput.addEventListener('change', function () {
      selectedTreeFile = treeFileInput.files && treeFileInput.files[0] ? treeFileInput.files[0] : null;
      if (selectedTreeFile && (!selectedTreeFile.type.startsWith('image/') || selectedTreeFile.size > 12582912)) {
        selectedTreeFile = null;
        treeFileInput.value = '';
        treePhotoCounter.textContent = 'Нужен файл изображения не больше 12 МБ';
        return;
      }
      treePhotoCounter.textContent = selectedTreeFile ? selectedTreeFile.name : 'Файл не выбран';
    });

    ['dragenter', 'dragover'].forEach(function (type) {
      dropArea.addEventListener(type, function (event) { event.preventDefault(); dropArea.classList.add('peretaskivanie'); });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      dropArea.addEventListener(type, function (event) { event.preventDefault(); dropArea.classList.remove('peretaskivanie'); });
    });
    dropArea.addEventListener('drop', function (event) { setFiles(event.dataTransfer.files); });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      showError('');
      photoError.hidden = true;

      var checks = document.querySelectorAll('.checklist-input');
      var allChecked = Array.from(checks).every(function (checkbox) { return checkbox.checked; });
      document.getElementById('checklistError').hidden = allChecked;
      if (!allChecked) return;
      if (!form.checkValidity()) {
        showError('Заполните все обязательные поля паспорта территории и дерева.');
        form.reportValidity();
        return;
      }

      var sourceMode = selectedSourceMode();
      var object = sourceMode === 'object' ? selectedObject() : null;
      if (sourceMode === 'object' && !object) {
        showError('Выберите объект, открытый или назначенный куратором.');
        return;
      }
      var coordinates = coordinatesInput.value.trim();
      if (!validCoordinates(coordinates)) {
        showError('Выберите местоположение дерева нажатием на карту.');
        document.getElementById('kartaVyborKoordinat').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (dateInput.value > localToday) {
        showError('Дата сбора не может быть в будущем.');
        return;
      }
      if (!selectedTreeFile) {
        showError('Добавьте обзорную фотографию исследуемой берёзы.');
        return;
      }
      if (selectedFiles.length !== MAX_PHOTOS) {
        photoError.textContent = 'Для одной точки нужно загрузить ровно 30 фотографий листьев.';
        photoError.hidden = false;
        return;
      }

      try {
        setBusy(true, 'Загружаем 31 фотографию…');
        var uploaded = await EcoAuth.uploadObservationPhotos(selectedTreeFile, selectedFiles);
        setBusy(true, 'Сохраняем паспорт точки…');
        var parts = coordinates.split(',').map(Number);
        var request = await EcoAuth.createRequest({
          title: document.getElementById('nazvanieNablyudeniya').value.trim(),
          location: document.getElementById('mestoNablyudeniya').value.trim(),
          coordinates: coordinates,
          latitude: parts[0],
          longitude: parts[1],
          collectionDate: dateInput.value,
          comment: document.getElementById('kommentariyNablyudeniya').value.trim(),
          files: uploaded.files,
          treePhoto: uploaded.treePhoto,
          treeCount: 1,
          leafCount: MAX_PHOTOS,
          sourceType: object ? (object.assigned ? 'assigned_object' : 'open_object') : 'own',
          organizationId: object?.organizationId || null,
          projectId: object?.projectId || null,
          objectId: object?.id || null,
          territoryType: document.getElementById('tipTerritorii').value,
          landUse: document.getElementById('tipTerritorii').value,
          nearbySources: document.getElementById('istochnikiVozdeystviya').value.trim(),
          roadDistanceM: document.getElementById('rasstoyanieDoroga').value,
          trafficIntensity: document.getElementById('intensivnostDvizheniya').value,
          surfaceCover: document.getElementById('tipPokrytiya').value,
          weatherConditions: document.getElementById('pogodaNablyudeniya').value.trim(),
          treeSpecies: document.getElementById('vidDereva').value,
          trunkDiameterCm: document.getElementById('diametrStvola').value,
          treeHeightEstimateM: document.getElementById('vysotaDereva').value,
          treeCondition: document.getElementById('sostoyanieDereva').value,
          treeDamageNotes: document.getElementById('povrezhdeniyaDereva').value.trim(),
          backgroundFlags: uploaded.files.map(function (file) { return file.bgLight; })
        });
        sessionStorage.setItem('eco-last-request-id', request.id);
        location.href = 'my-requests.html';
      } catch (error) {
        var messages = {
          PHOTO_UPLOAD_FAILED: 'Не удалось загрузить фотографии в Supabase Storage.',
          EDUCATION_REQUIRED: 'Сессия обучения не подтверждена. Вернитесь в личный кабинет.',
          OBJECT_NOT_AVAILABLE: 'Выбранный объект уже закрыт или недоступен.',
          REQUESTS_API_FAILED: 'Сервер не смог сохранить заявку. Проверьте миграцию 005.'
        };
        showError(messages[error.message] || 'Не удалось сохранить заявку: ' + (error.message || 'неизвестная ошибка'));
        setBusy(false);
      }
    });

    createCoordinatePicker();
    await loadParticipationContext();
  });
})();
