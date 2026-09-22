// submit.js, карта выбора координат, паспорт территории, фотографии и отправка заявки
(function () {
  'use strict';

  var MAX_PHOTOS = 120;
  var MAX_PER_TREE = 30;

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

    var treeSetsElement = document.getElementById('treeSets');
    var addTreeButton = document.getElementById('addTree');
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
    var landmarkSets = [];
    var landmarkPhoto = 0;
    var landmarkNames = ['apex','base','left_v1_base','left_v1_end','right_v1_base','right_v1_end','left_v2_base','left_v2_end','right_v2_base','right_v2_end','width_left','width_right'];
    var landmarkLabels = ['верхушка','основание','левая жилка 1: начало','левая жилка 1: конец','правая жилка 1: начало','правая жилка 1: конец','левая жилка 2: начало','левая жилка 2: конец','правая жилка 2: начало','правая жилка 2: конец','край ширины слева','край ширины справа'];
    var landmarkCanvas = document.getElementById('landmarkCanvas');
    var landmarkImage = document.getElementById('landmarkImage');
    var landmarkOverlay = document.getElementById('landmarkOverlay');
    var landmarkNumber = document.getElementById('landmarkPhotoNumber');
    var landmarkPointName = document.getElementById('landmarkPointName');
    var integrityCode = Array.from(crypto.getRandomValues(new Uint8Array(6))).map(function(v){return 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32];}).join('');
    document.getElementById('integrityCode').textContent = integrityCode;
    var devicePosition = {};
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function(pos){devicePosition={deviceLatitude:pos.coords.latitude,deviceLongitude:pos.coords.longitude,gpsAccuracyM:pos.coords.accuracy};},function(){}, {enableHighAccuracy:true,timeout:8000});
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
            resolve({ light: total / count > 200, width: img.naturalWidth, height: img.naturalHeight });
          } catch (_) { resolve({ light: null, width: img.naturalWidth, height: img.naturalHeight }); }
          URL.revokeObjectURL(objectUrl);
        };
        img.onerror = function () { URL.revokeObjectURL(objectUrl); resolve({ light: null, width: 0, height: 0 }); };
        img.src = objectUrl;
      });
    }

    async function prepareMeta(file) {
      var buffer = await file.arrayBuffer();
      var digest = await crypto.subtle.digest('SHA-256', buffer);
      var hash = Array.from(new Uint8Array(digest)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
      var image = await checkBackground(file);
      file._ecoMeta = { sha256: hash, imageWidth: image.width, imageHeight: image.height, bgLight: image.light, precheck: { backgroundLight: image.light, readable: image.width >= 500 && image.height >= 500, birchCandidate: null } };
      return file._ecoMeta;
    }

    function renderLandmarks() {
      if (!selectedFiles.length) { landmarkCanvas.style.display='none'; landmarkNumber.textContent='Фото не выбраны'; landmarkPointName.textContent=''; return; }
      landmarkCanvas.style.display='block';
      var set=landmarkSets[landmarkPhoto]||(landmarkSets[landmarkPhoto]={});
      var file=selectedFiles[landmarkPhoto];
      var treeIndex=Number(file._ecoTreeIndex||0);
      var within=selectedFiles.slice(0,landmarkPhoto+1).filter(function(item){return item._ecoTreeIndex===treeIndex;}).length;
      landmarkNumber.textContent='Дерево '+(treeIndex+1)+' · лист '+within+' · всего '+selectedFiles.length;
      var count=Object.keys(set).length;
      landmarkPointName.textContent=count<landmarkNames.length?'Сейчас: '+landmarkLabels[count]:'Все 12 точек отмечены';
      landmarkOverlay.replaceChildren();
      landmarkNames.forEach(function(name,index){if(!set[name])return;var dot=document.createElement('span');dot.className='landmark-dot landmark-dot--group-'+(index<2?'axis':index<10?'vein':'width');dot.style.left=(set[name].x*100)+'%';dot.style.top=(set[name].y*100)+'%';dot.title=(index+1)+'. '+landmarkLabels[index];dot.textContent=String(index+1);landmarkOverlay.appendChild(dot);});
      document.getElementById('landmarkNext').disabled=count<landmarkNames.length;
      document.getElementById('landmarkNext').textContent=landmarkPhoto===selectedFiles.length-1?'Разметка готова':'Следующий лист';
    }

    function showLandmarkPhoto(){if(!selectedFiles[landmarkPhoto])return;var old=landmarkImage.dataset.url;if(old)URL.revokeObjectURL(old);var url=URL.createObjectURL(selectedFiles[landmarkPhoto]);landmarkImage.dataset.url=url;landmarkImage.src=url;renderLandmarks();}

    function treeBlocks() { return Array.from(treeSetsElement.querySelectorAll('.tree-block')); }
    function readTrees() {
      return treeBlocks().map(function (block, index) {
        var leaves=Array.from(block.querySelector('[data-tree-leaves]').files||[]);
        leaves.forEach(function(file){file._ecoTreeIndex=index;});
        return {
          treePhoto: block.querySelector('[data-tree-photo]').files[0]||null, files:leaves,
          treeCondition:block.querySelector('[data-tree-condition]').value,
          trunkDiameterCm:block.querySelector('[data-tree-diameter]').value,
          treeHeightEstimateM:block.querySelector('[data-tree-height]').value,
          treeDamageNotes:block.querySelector('[data-tree-notes]').value.trim()
        };
      });
    }
    function addTree() {
      if (treeBlocks().length>=4) return;
      var number=treeBlocks().length+1;
      var block=document.createElement('fieldset'); block.className='tree-block';
      block.innerHTML='<legend>Берёза '+number+'</legend><div class="forma-nablyudeniya__ryad">'+
        '<label class="pole-gruppa">Состояние кроны<select class="pole-vybor" data-tree-condition required><option value="">Выберите</option><option>Без заметных нарушений</option><option>Есть сухие ветви</option><option>Крона разрежена</option><option>Есть выраженные повреждения</option></select></label>'+ 
        '<label class="pole-gruppa">Диаметр ствола, см<input class="pole-vvod" data-tree-diameter type="number" min="1" max="300" step="0.1" required></label></div>'+ 
        '<div class="forma-nablyudeniya__ryad"><label class="pole-gruppa">Примерная высота, м<input class="pole-vvod" data-tree-height type="number" min="1" max="80" step="0.1" required></label>'+ 
        '<label class="pole-gruppa">Повреждения ствола и кроны<input class="pole-vvod" data-tree-notes placeholder="Если нет — напишите «не замечены»" maxlength="500" required></label></div>'+ 
        '<label class="pole-gruppa">Обзорная фотография этого дерева<input class="pole-vvod" data-tree-photo type="file" accept="image/*"></label>'+ 
        '<label class="pole-gruppa">Фотографии листьев этого дерева (10–30)<input class="pole-vvod" data-tree-leaves type="file" accept="image/*" multiple></label>'+ 
        '<p data-tree-count>Листья ещё не выбраны</p><button class="knopka-tekst" type="button" data-remove-tree>Убрать дерево</button>';
      treeSetsElement.appendChild(block);
      addTreeButton.hidden=treeBlocks().length>=4;
      refreshLeaves();
    }
    function refreshLeaves() {
      var previous=new Map(selectedFiles.map(function(file,index){return [file,landmarkSets[index]||{}];}));
      selectedFiles=readTrees().flatMap(function(tree){return tree.files;}).slice(0,MAX_PHOTOS);
      landmarkSets=selectedFiles.map(function(file){return previous.get(file)||{};});
      landmarkPhoto=Math.min(landmarkPhoto,Math.max(0,selectedFiles.length-1));
      treeBlocks().forEach(function(block,index){var count=block.querySelector('[data-tree-leaves]').files.length;block.querySelector('[data-tree-count]').textContent='Листьев: '+count+' (нужно от 10 до 30)';block.querySelector('legend').textContent='Берёза '+(index+1);});
      photoError.hidden=true;
      if(selectedFiles.length) showLandmarkPhoto(); else renderLandmarks();
    }
    addTreeButton.addEventListener('click',addTree);
    treeSetsElement.addEventListener('change',function(event){
      if(event.target.matches('[data-tree-leaves], [data-tree-photo]')) {
        refreshLeaves();
        if(event.target.files.length>MAX_PER_TREE && event.target.matches('[data-tree-leaves]')) {photoError.textContent='Для одного дерева допускается не более 30 листьев. Выберите файлы заново.';photoError.hidden=false;}
      }
    });
    treeSetsElement.addEventListener('click',function(event){if(!event.target.matches('[data-remove-tree]'))return;if(treeBlocks().length<=2)return;event.target.closest('.tree-block').remove();addTreeButton.hidden=false;refreshLeaves();});
    addTree(); addTree();

    landmarkOverlay.addEventListener('click',function(event){var set=landmarkSets[landmarkPhoto];var index=Object.keys(set).length;if(index>=landmarkNames.length)return;var rect=landmarkOverlay.getBoundingClientRect();set[landmarkNames[index]]={x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height)),visible:true};renderLandmarks();});
    document.getElementById('landmarkUndo').addEventListener('click',function(){var set=landmarkSets[landmarkPhoto],keys=Object.keys(set);if(keys.length)delete set[keys[keys.length-1]];renderLandmarks();});
    document.getElementById('landmarkNext').addEventListener('click',function(){if(Object.keys(landmarkSets[landmarkPhoto]||{}).length!==12)return;if(landmarkPhoto<selectedFiles.length-1){landmarkPhoto+=1;showLandmarkPhoto();}else showError('Разметка листьев готова. Теперь можно отправить заявку.');});

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
      var treeData=readTrees();
      if (treeData.length<2||treeData.length>4||treeData.some(function(tree){return !tree.treePhoto||tree.files.length<10||tree.files.length>30;})) {
        photoError.textContent = 'Нужно 2–4 дерева: одно обзорное фото и 10–30 отдельных фотографий листьев для каждого.';
        photoError.hidden = false;
        return;
      }
      if (landmarkSets.length !== selectedFiles.length || landmarkSets.some(function(set){return Object.keys(set).length!==12;})) { showError('Поставьте 12 контрольных точек на каждом листе.'); document.getElementById('landmarkStep').scrollIntoView({behavior:'smooth'}); return; }
      await Promise.all(treeData.map(function(tree){return tree.treePhoto;}).concat(selectedFiles).map(prepareMeta));
      if (selectedFiles.some(function(file){return !file._ecoMeta.precheck.backgroundLight||!file._ecoMeta.precheck.readable;})) { showError('Часть фотографий не прошла проверку фона или разрешения. Замените их перед отправкой.'); return; }

      try {
        setBusy(true, 'Загружаем фотографии…');
        var uploaded = await EcoAuth.uploadObservationPhotos(treeData);
        var uploadedTrees=uploaded.trees.map(function(tree,index){return Object.assign({},tree,{
          treeCondition:treeData[index].treeCondition,
          trunkDiameterCm:treeData[index].trunkDiameterCm,
          treeHeightEstimateM:treeData[index].treeHeightEstimateM,
          treeDamageNotes:treeData[index].treeDamageNotes
        });});
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
          trees: uploadedTrees,
          treeCount: uploadedTrees.length,
          leafCount: selectedFiles.length,
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
          trunkDiameterCm: treeData[0].trunkDiameterCm,
          treeHeightEstimateM: treeData[0].treeHeightEstimateM,
          treeCondition: treeData[0].treeCondition,
          treeDamageNotes: treeData[0].treeDamageNotes,
          backgroundFlags: uploaded.files.map(function (file) { return file.bgLight; })
          ,participantChecklist: Array.from(checks).map(function(box){return box.checked;})
          ,landmarks: landmarkSets.map(function(points,index){var meta=selectedFiles[index]._ecoMeta||{};return {points:points,fileHash:meta.sha256||'',fileName:selectedFiles[index].name,imageWidth:meta.imageWidth||1,imageHeight:meta.imageHeight||1,treeIndex:selectedFiles[index]._ecoTreeIndex};})
          ,photoPrecheck: { passed: true, checked: selectedFiles.length, method: 'background-and-resolution-v1' }
          ,integrityCode: integrityCode
          ,capturedAt: new Date().toISOString()
          ,deviceLatitude: devicePosition.deviceLatitude
          ,deviceLongitude: devicePosition.deviceLongitude
          ,gpsAccuracyM: devicePosition.gpsAccuracyM
        });
        sessionStorage.setItem('eco-last-request-id', request.id);
        location.href = 'my-requests.html';
      } catch (error) {
        var messages = {
          PHOTO_UPLOAD_FAILED: 'Не удалось загрузить фотографии в Supabase Storage.',
          EDUCATION_REQUIRED: 'Сессия обучения не подтверждена. Вернитесь в личный кабинет.',
          OBJECT_NOT_AVAILABLE: 'Выбранный объект уже закрыт или недоступен.',
          REQUESTS_API_FAILED: 'Сервер не смог сохранить заявку. Проверьте, что в Supabase по порядку выполнены миграции 005, 006 и 007.'
        };
        showError(messages[error.message] || 'Не удалось сохранить заявку: ' + (error.message || 'неизвестная ошибка'));
        setBusy(false);
      }
    });

    createCoordinatePicker();
    await loadParticipationContext();
  });
})();
