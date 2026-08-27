// submit.js — проверка и сохранение формы наблюдения
(function () {
  'use strict';

  var MAX_PHOTOS = 30;

  document.addEventListener('DOMContentLoaded', async function () {
    // Проверяем авторизацию (если нет — редирект)
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;

    var form = document.getElementById('formaNablyudeniya');
    var locked = document.getElementById('podachaBlokirovka');
    if (!form || !locked) return;

    // Если обучение не пройдено — блокируем доступ
    if (!EcoAuth.isEducationCompleted(user.email)) {
      locked.hidden = false;
      form.hidden = true;
      return;
    }

    form.hidden = false;
    locked.hidden = true;

    // === Элементы формы ===
    var fileInput = document.getElementById('faylyNablyudeniya');
    var dropArea = document.getElementById('zagruzkaFoto');
    var photoCounter = document.getElementById('schetchikFoto');
    var photoError = document.getElementById('oshibkaFoto');
    var formError = document.getElementById('oshibkaPodachi');
    var dateInput = document.getElementById('dataSbora');

    var selectedFiles = [];

    // === Ограничение даты ===
    if (dateInput) {
      var now = new Date();
      var localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      dateInput.max = localToday;
    }

    // === Валидация координат ===
    function validCoordinates(value) {
      var parts = String(value || '').split(',').map(function (part) { return part.trim(); });
      if (parts.length !== 2) return false;
      var latitude = Number(parts[0]);
      var longitude = Number(parts[1]);
      return Number.isFinite(latitude) && Number.isFinite(longitude) &&
             latitude >= -90 && latitude <= 90 &&
             longitude >= -180 && longitude <= 180;
    }

    // === АВТОПРОВЕРКА БЕЛОГО ФОНА ===
    function checkBackground(imageFile) {
      return new Promise(function (resolve) {
        var img = new Image();
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        img.onload = function () {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          // Проверяем 4 угла (20x20 пикселей)
          var corners = [
            { x: 0, y: 0 },
            { x: img.width - 20, y: 0 },
            { x: 0, y: img.height - 20 },
            { x: img.width - 20, y: img.height - 20 }
          ];
          var totalBrightness = 0;
          var pixelCount = 0;
          corners.forEach(function (corner) {
            var data = ctx.getImageData(corner.x, corner.y, 20, 20).data;
            for (var i = 0; i < data.length; i += 4) {
              var brightness = (data[i] + data[i+1] + data[i+2]) / 3;
              totalBrightness += brightness;
              pixelCount++;
            }
          });
          var avgBrightness = totalBrightness / pixelCount;
          resolve(avgBrightness > 200); // true = фон светлый
        };
        img.src = URL.createObjectURL(imageFile);
      });
    }

    // === Обработка выбранных файлов ===
    function setFiles(files) {
      selectedFiles = Array.from(files || [])
        .filter(function (file) { return file.type.startsWith('image/'); })
        .slice(0, MAX_PHOTOS);

      photoCounter.textContent = selectedFiles.length + ' / ' + MAX_PHOTOS + ' фотографий';
      photoError.hidden = true;

      // Запускаем проверку фона для каждого файла
      selectedFiles.forEach(function (file) {
        checkBackground(file).then(function (isLight) {
          file._bgLight = isLight; // сохраняем флаг прямо на объекте файла
        });
      });
    }

    fileInput.addEventListener('change', function () { setFiles(fileInput.files); });

    // === Drag & Drop ===
    ['dragenter', 'dragover'].forEach(function (type) {
      dropArea.addEventListener(type, function (event) {
        event.preventDefault();
        dropArea.classList.add('peretaskivanie');
      });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      dropArea.addEventListener(type, function (event) {
        event.preventDefault();
        dropArea.classList.remove('peretaskivanie');
      });
    });
    dropArea.addEventListener('drop', function (event) {
      event.preventDefault();
      setFiles(event.dataTransfer.files);
    });

    // === ОТПРАВКА ФОРМЫ ===
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      formError.hidden = true;

      var title = document.getElementById('nazvanieNablyudeniya').value.trim();
      var locationText = document.getElementById('mestoNablyudeniya').value.trim();
      var coordinates = document.getElementById('koordinatyNablyudeniya').value.trim();
      var collectionDate = document.getElementById('dataSbora').value;

      // 1. Проверка чеклиста
      var checks = document.querySelectorAll('.checklist-input');
      var allChecked = true;
      checks.forEach(function (cb) {
        if (!cb.checked) allChecked = false;
      });
      if (!allChecked) {
        document.getElementById('checklistError').hidden = false;
        return;
      }
      document.getElementById('checklistError').hidden = true;

      // 2. Обязательные поля
      if (!title || !locationText || !coordinates || !collectionDate) {
        formError.textContent = 'Проверьте обязательные поля';
        formError.dataset.state = 'error';
        formError.hidden = false;
        return;
      }
      if (localToday && collectionDate > localToday) {
        formError.textContent = 'Дата сбора не может быть в будущем';
        formError.dataset.state = 'error';
        formError.hidden = false;
        dateInput.focus();
        return;
      }
      if (!validCoordinates(coordinates)) {
        formError.textContent = 'Введите координаты в формате: широта, долгота';
        formError.dataset.state = 'error';
        formError.hidden = false;
        document.getElementById('koordinatyNablyudeniya').focus();
        return;
      }
      if (selectedFiles.length !== MAX_PHOTOS) {
        photoError.textContent = 'Для одного наблюдения необходимо загрузить ровно 30 фотографий листьев';
        photoError.hidden = false;
        return;
      }

      // 3. Собираем данные файлов с флагами фона
      var filesData = selectedFiles.map(function (file) {
        return {
          name: file.name,
          size: file.size,
          type: file.type,
          bgLight: file._bgLight !== undefined ? file._bgLight : null // null = ещё не проверено
        };
      });

      // 4. Создаём заявку через EcoAuth
      try {
        var request = EcoAuth.createRequest({
          title: title,
          location: locationText,
          coordinates: coordinates,
          collectionDate: collectionDate,
          comment: document.getElementById('kommentariyNablyudeniya').value.trim(),
          files: filesData,
          backgroundFlags: filesData.map(function (f) { return f.bgLight; }) // дополнительный массив для удобства
        });
        sessionStorage.setItem('eco-last-request-id', request.id);
        location.href = 'my-requests.html';
      } catch (err) {
        formError.textContent = 'Не удалось сохранить заявку: ' + (err.message || '');
        formError.dataset.state = 'error';
        formError.hidden = false;
      }
    });
  });
})();