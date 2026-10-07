(function () {
  'use strict';
  var labels = ['Верхушка', 'Основание', 'Левая жилка 1: начало', 'Левая жилка 1: конец', 'Правая жилка 1: начало', 'Правая жилка 1: конец', 'Левая жилка 2: начало', 'Левая жилка 2: конец', 'Правая жилка 2: начало', 'Правая жилка 2: конец', 'Край ширины слева', 'Край ширины справа'];
  var names = EcoFa.LANDMARK_NAMES;
  var $ = function (id) { return document.getElementById(id); };
  document.addEventListener('DOMContentLoaded', async function () {
    var user = await EcoAuth.requireAuthAsync();
    if (!user) return;
    if (user.role !== 'participant') { $('podachaBlokirovka').hidden = false; $('podachaBlokirovka').querySelector('p').textContent = 'Заявки отправляются из роли участника'; return; }
    var trained = EcoAuth.isEducationCompleted(user.email) || await EcoAuth.refreshEducationStatus();
    if (!trained) { $('podachaBlokirovka').hidden = false; return; }
    var form = $('formaNablyudeniya'); form.hidden = false;
    var trees = [], activeTree = 0, activeLeaf = 0, selectedPoint = 0, stage = 'intro', dirty = false, busy = false;
    var context = { objects: [] }, map = null, marker = null, boundaryShape = null, device = {};
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code = sessionStorage.getItem('eco-field-code');
    if (!/^[A-Z0-9]{6}$/.test(code || '')) { code = Array.from(crypto.getRandomValues(new Uint8Array(6))).map(function (v) { return alphabet[v % alphabet.length]; }).join(''); sessionStorage.setItem('eco-field-code', code); }
    $('integrityCode').textContent = code;
    var today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    $('dataSbora').max = today;
    labels.forEach(function (label, i) { $('landmarkSelect').add(new Option(label, String(i))); });
    function error(message) { $('oshibkaPodachi').textContent = message || ''; $('oshibkaPodachi').hidden = !message; if (message) $('oshibkaPodachi').focus(); }
    function setStage(value) {
      stage = value; error('');
      form.querySelectorAll('[data-stage]').forEach(function (node) { node.hidden = node.dataset.stage !== value; });
      form.querySelectorAll('[data-stage-label]').forEach(function (node) { if (node.dataset.stageLabel === value) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current'); });
      var heading = form.querySelector('[data-stage="' + value + '"] h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start', behavior: 'auto' }); }
      if (value === 'point' && map) map.container.fitToViewport();
    }
    function checkFields(container) {
      var invalid = Array.from(container.querySelectorAll('input, select, textarea')).find(function (field) { return !field.checkValidity(); });
      if (invalid) { invalid.reportValidity(); invalid.focus(); return false; } return true;
    }
    function coordinates() {
      var parts = $('koordinatyNablyudeniya').value.trim().split(',').map(function (s) { return s.trim(); });
      if (parts.length !== 2 || parts.some(function (s) { return !/^-?\d+(?:\.\d+)?$/.test(s); })) return null;
      var p = parts.map(Number); return Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180 ? p : null;
    }
    function setCoordinates(coords) {
      $('koordinatyNablyudeniya').value = coords.map(function (v) { return Number(v).toFixed(6); }).join(', '); $('kartaVyborStatus').textContent = 'Точка выбрана';
      if (!map) return;
      if (marker) marker.geometry.setCoordinates(coords);
      else { marker = new ymaps.Placemark(coords, {}, { draggable: true, preset: 'islands#darkBlueDotIcon' }); map.geoObjects.add(marker); marker.events.add('dragend', function () { setCoordinates(marker.geometry.getCoordinates()); }); }
    }
    function selectedObject() { return context.objects.find(function (object) { return object.id === $('obektNablyudeniya').value; }); }
    function objectMode() { return form.querySelector('[name="sourceMode"]:checked').value === 'object'; }
    function pointValid() {
      if (!checkFields(form.querySelector('[data-stage="point"]'))) return false;
      var p = coordinates(); if (!p) { error('Введите широту и долготу через запятую или выберите место на карте'); return false; }
      if ($('dataSbora').value > today) { error('Дата сбора не может быть в будущем'); return false; }
      var obj = objectMode() && selectedObject();
      if (objectMode() && !obj) { error('Выберите территорию куратора'); return false; }
      if (obj && obj.boundary && obj.boundary.length && !EcoTerritory.contains(p, obj.boundary)) { error('Эта точка за пределами назначенной территории'); return false; }
      return true;
    }
    function makeTree() {
      var block = document.createElement('section'); block.className = 'tree-block';
      block.innerHTML = '<div class="forma-nablyudeniya__ryad"><label class="pole-gruppa">Состояние кроны<select class="pole-vybor" data-field="treeCondition" required><option value="">Выберите</option><option>Без заметных нарушений</option><option>Есть сухие ветви</option><option>Крона разрежена</option><option>Есть выраженные повреждения</option></select></label><label class="pole-gruppa">Диаметр ствола, см<input class="pole-vvod" data-field="trunkDiameterCm" type="number" min="1" max="300" step="0.1" required></label></div><div class="forma-nablyudeniya__ryad"><label class="pole-gruppa">Примерная высота, м<input class="pole-vvod" data-field="treeHeightEstimateM" type="number" min="1" max="80" step="0.1" required></label><label class="pole-gruppa">Повреждения ствола и кроны<input class="pole-vvod" data-field="treeDamageNotes" maxlength="500" placeholder="Например: не замечены" required></label></div><label class="pole-gruppa">Дерево с кодом <strong>' + code + '</strong><input class="pole-vvod" data-tree-photo type="file" accept="image/jpeg,image/png,image/webp" required></label><p class="pole-podskazka">Одно обзорное фото. Видны дерево и записанный код. Белый фон здесь не нужен</p><label class="pole-gruppa">Листья этой берёзы без кода<input class="pole-vvod" data-tree-leaves type="file" accept="image/jpeg,image/png,image/webp" multiple required></label><p data-tree-count>Выберите от 10 до 30 фотографий</p><div class="photo-preview" data-preview></div><p class="pole-podskazka">Быстрая проверка оценит формат, разрешение и светлый фон. Вид растения и повреждения проверяет модератор</p>';
      var tree = { block: block, treePhoto: null, files: [], points: new Map(), complete: false };
      block.addEventListener('change', function (event) {
        dirty = true; tree.complete = false;
        if (event.target.matches('[data-tree-photo]')) tree.treePhoto = event.target.files[0] || null;
        if (event.target.matches('[data-tree-leaves]')) { tree.files = Array.from(event.target.files); tree.points.clear(); block.querySelector('[data-tree-count]').textContent = 'Выбрано листьев: ' + tree.files.length; block.querySelector('[data-preview]').replaceChildren(); if (tree.files.length < 10 || tree.files.length > 30) error('Для одной берёзы нужно от 10 до 30 листьев. Выберите файлы заново'); }
      });
      trees.push(tree); $('treeSets').appendChild(block); return tree;
    }
    function showTree(index) {
      activeTree = index; if (!trees[index]) makeTree(); activeLeaf = 0;
      trees.forEach(function (tree, i) { tree.block.hidden = i !== index; });
      $('treeSetsTitle').textContent = 'Берёза ' + (index + 1); $('treeProgress').textContent = 'Готово деревьев: ' + trees.filter(function (t) { return t.complete; }).length;
      $('removeTree').hidden = index < 2;
      $('landmarkStep').hidden = true; $('treeComplete').hidden = true; $('photoActions').hidden = false; $('treeSets').hidden = false; setStage('tree');
    }
    async function inspect(file, leaf) {
      if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12582912 || !file.size) throw new Error('Нужен JPEG, PNG или WebP до 12 МБ');
      if (file._ecoMeta) return file._ecoMeta;
      var hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
      var image = new Image(), url = URL.createObjectURL(file);
      try {
        await new Promise(function (resolve, reject) { image.onload = resolve; image.onerror = function () { reject(new Error('Снимок не открывается')); }; image.src = url; });
        if (image.naturalWidth < 500 || image.naturalHeight < 500 || image.naturalWidth > 50000 || image.naturalHeight > 50000) throw new Error('Нужно разрешение от 500 × 500 пикселей');
        var light = true;
        if (leaf) {
          var canvas = document.createElement('canvas'); canvas.width = canvas.height = 100;
          var ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 100, 100); ctx.drawImage(image, 0, 0, 100, 100);
          light = [[0, 0], [90, 0], [0, 90], [90, 90]].filter(function (p) { var pixels = ctx.getImageData(p[0], p[1], 10, 10).data, sum = 0; for (var i = 0; i < pixels.length; i += 4) sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3; return sum / 100 > 190; }).length >= 3;
          if (!light) throw new Error('Фон по краям слишком тёмный. Переснимите лист на белой бумаге');
        }
        file._ecoMeta = { sha256: hash, imageWidth: image.naturalWidth, imageHeight: image.naturalHeight, bgLight: light, precheck: { backgroundLight: light, readable: true, birchCandidate: null } }; return file._ecoMeta;
      } finally { URL.revokeObjectURL(url); }
    }
    async function checkTree() {
      if (busy) return;
      var tree = trees[activeTree]; error(''); if (!checkFields(tree.block)) return;
      if (tree.files.length < 10 || tree.files.length > 30) return error('Выберите от 10 до 30 листьев для этой берёзы');
      busy = true; $('checkTreePhotos').disabled = true; $('oshibkaFoto').hidden = false;
      var all = [tree.treePhoto].concat(tree.files), preview = tree.block.querySelector('[data-preview]'); preview.replaceChildren();
      try {
        for (var i = 0; i < all.length; i++) {
          $('oshibkaFoto').textContent = 'Проверяем снимок ' + (i + 1) + ' из ' + all.length;
          try { await inspect(all[i], i > 0); } catch (e) { throw new Error(all[i].name + ': ' + e.message); }
          var card = document.createElement('span'); card.textContent = (i ? 'Лист ' + i : 'Фото дерева') + ': проверен'; preview.appendChild(card);
        }
        var known = trees.flatMap(function (t) { return [t.treePhoto].concat(t.files).filter(Boolean).map(function (f) { return f._ecoMeta && f._ecoMeta.sha256; }).filter(Boolean); });
        if (new Set(known).size !== known.length) throw new Error('Один снимок выбран повторно. Для каждого листа и дерева нужна отдельная фотография');
        $('oshibkaFoto').hidden = true; $('treeSets').hidden = true; $('photoActions').hidden = true; $('landmarkStep').hidden = false; activeLeaf = 0; showLeaf();
      } catch (e) { $('oshibkaFoto').textContent = e.message; }
      finally { busy = false; $('checkTreePhotos').disabled = false; }
    }
    function points() { var tree = trees[activeTree], file = tree.files[activeLeaf]; if (!tree.points.has(file)) tree.points.set(file, {}); return tree.points.get(file); }
    function leafSet(tree, file, treeIndex) { return { points: tree.points.get(file) || {}, fileName: file.name, fileHash: file._ecoMeta.sha256, imageWidth: file._ecoMeta.imageWidth, imageHeight: file._ecoMeta.imageHeight, treeIndex: treeIndex }; }
    function showLeaf() {
      var old = $('landmarkImage').dataset.url; if (old) URL.revokeObjectURL(old);
      var url = URL.createObjectURL(trees[activeTree].files[activeLeaf]); $('landmarkImage').dataset.url = url; $('landmarkImage').src = url;
      var missing = names.findIndex(function (n) { return !points()[n]; }); selectedPoint = missing < 0 ? 0 : missing; renderPoints();
    }
    function renderPoints() {
      var set = points(), overlay = $('landmarkOverlay'); overlay.replaceChildren(); $('landmarkCanvas').style.display = 'block';
      $('landmarkPhotoNumber').textContent = 'Лист ' + (activeLeaf + 1) + ' из ' + trees[activeTree].files.length;
      $('landmarkPointName').textContent = 'Отмечено ' + Object.keys(set).length + ' из 12'; $('landmarkSelect').value = String(selectedPoint);
      names.forEach(function (name, index) {
        if (!set[name]) return;
        var dot = document.createElement('button'); dot.type = 'button'; dot.className = 'landmark-dot'; dot.dataset.point = String(index); dot.style.left = set[name].x * 100 + '%'; dot.style.top = set[name].y * 100 + '%'; dot.textContent = index + 1;
        dot.setAttribute('aria-label', labels[index] + '. Передвиньте стрелками'); dot.setAttribute('aria-pressed', String(index === selectedPoint)); overlay.appendChild(dot);
      });
      $('landmarkPrevious').disabled = activeLeaf === 0; $('landmarkNext').disabled = names.some(function (n) { return !set[n]; });
      $('landmarkNext').textContent = activeLeaf + 1 === trees[activeTree].files.length ? 'Закончить эту берёзу' : 'Следующий лист';
    }
    function position(event) { var r = $('landmarkOverlay').getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)) }; }
    var drag = null, explicitPoint = false;
    $('landmarkOverlay').addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return; var dot = event.target.closest('[data-point]');
      if (dot && !explicitPoint && points()[names[selectedPoint]]) selectedPoint = Number(dot.dataset.point);
      drag = { pointer: event.pointerId, index: selectedPoint }; $('landmarkOverlay').setPointerCapture(event.pointerId); event.preventDefault();
    });
    $('landmarkOverlay').addEventListener('pointermove', function (event) { if (!drag || drag.pointer !== event.pointerId) return; points()[names[drag.index]] = position(event); renderPoints(); dirty = true; });
    $('landmarkOverlay').addEventListener('pointerup', function (event) {
      if (!drag || drag.pointer !== event.pointerId) return;
      points()[names[drag.index]] = position(event); dirty = true; trees[activeTree].complete = false;
      var missing = names.findIndex(function (name) { return !points()[name]; }); if (missing >= 0) selectedPoint = missing; drag = null; explicitPoint = false; renderPoints();
    });
    $('landmarkOverlay').addEventListener('pointercancel', function () { drag = null; });
    $('landmarkOverlay').addEventListener('keydown', function (event) {
      var dot = event.target.closest('[data-point]'); if (!dot || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); selectedPoint = Number(dot.dataset.point); var p = points()[names[selectedPoint]], step = event.shiftKey ? .01 : .002;
      if (event.key === 'ArrowUp') p.y -= step; if (event.key === 'ArrowDown') p.y += step; if (event.key === 'ArrowLeft') p.x -= step; if (event.key === 'ArrowRight') p.x += step;
      p.x = Math.max(0, Math.min(1, p.x)); p.y = Math.max(0, Math.min(1, p.y)); dirty = true; trees[activeTree].complete = false; renderPoints(); $('landmarkOverlay').querySelector('[data-point="' + selectedPoint + '"]').focus();
    });
    $('landmarkSelect').addEventListener('change', function () { selectedPoint = Number(this.value); explicitPoint = true; renderPoints(); });
    $('landmarkUndo').addEventListener('click', function () { delete points()[names[selectedPoint]]; trees[activeTree].complete = false; renderPoints(); });
    $('landmarkPrevious').addEventListener('click', function () { if (activeLeaf > 0) { activeLeaf--; showLeaf(); } });
    $('landmarkNext').addEventListener('click', function () {
      var tree = trees[activeTree];
      if (!EcoFa.calculateLeaf(leafSet(tree, tree.files[activeLeaf], activeTree), activeLeaf)) return error('По этим точкам не получается расчёт. Проверьте ось листа, начала и концы жилок: парные расстояния не должны одновременно быть нулевыми');
      error(''); if (activeLeaf < tree.files.length - 1) { activeLeaf++; showLeaf(); return; }
      tree.complete = true; $('landmarkStep').hidden = true; $('treeComplete').hidden = false;
      $('treeCompleteText').textContent = 'Размечено листьев: ' + tree.files.length + '. ' + (trees.length < 2 ? 'Теперь нужна ещё одна берёза из этой точки' : 'Можно завершить заявку или добавить ещё дерево');
      $('addTree').hidden = trees.length >= 5 && activeTree === trees.length - 1; $('addTree').textContent = activeTree < trees.length - 1 ? 'К следующей берёзе' : 'Добавить берёзу';
      $('finishTrees').hidden = trees.length < 2 || trees.some(function (t) { return !t.complete; });
    });
    function allLandmarks() { return trees.flatMap(function (tree, i) { return tree.files.map(function (file) { return leafSet(tree, file, i); }); }); }
    function draft() { return { title: $('nazvanieNablyudeniya').value, location: $('mestoNablyudeniya').value, collectionDate: $('dataSbora').value, coordinates: $('koordinatyNablyudeniya').value, aiResult: EcoFa.calculateRequestFa(allLandmarks()), status: 'draft' }; }
    $('beginPoint').addEventListener('click', function () { setStage('point'); });
    form.querySelectorAll('[data-back]').forEach(function (button) { button.addEventListener('click', function () { setStage(button.dataset.back); }); });
    $('beginTrees').addEventListener('click', function () { if (pointValid()) showTree(0); });
    $('treeBack').addEventListener('click', function () { if (activeTree === 0) setStage('point'); else showTree(activeTree - 1); });
    $('removeTree').addEventListener('click', function () {
      if (activeTree < 2 || !window.confirm('Убрать эту берёзу и её разметку из текущей заявки?')) return;
      trees[activeTree].block.remove(); trees.splice(activeTree, 1); dirty = true; showTree(activeTree - 1);
    });
    $('checkTreePhotos').addEventListener('click', checkTree);
    $('changeTreePhotos').addEventListener('click', function () { showTree(activeTree); });
    $('editTree').addEventListener('click', function () { $('treeComplete').hidden = true; $('landmarkStep').hidden = false; activeLeaf = 0; showLeaf(); });
    $('addTree').addEventListener('click', function () { if (activeTree < trees.length - 1 || trees.length < 5) showTree(activeTree + 1); });
    $('finishTrees').addEventListener('click', function () {
      if (trees.length < 2 || trees.some(function (t) { return !t.complete; })) return;
      var summary = $('submissionSummary'); summary.replaceChildren(); trees.forEach(function (tree, i) { var row = document.createElement('p'); row.textContent = 'Берёза ' + (i + 1) + ': ' + tree.files.length + ' листьев, разметка готова'; summary.appendChild(row); }); setStage('finish');
    });
    $('backToTrees').addEventListener('click', function () { showTree(0); });
    $('downloadDraft').addEventListener('click', async function () { this.disabled = true; try { await EcoPdf.download(draft()); } catch (_) { error('Не удалось подготовить PDF. Попробуйте ещё раз'); } finally { this.disabled = false; } });
    form.querySelectorAll('[name="sourceMode"]').forEach(function (radio) { radio.addEventListener('change', function () { $('obektNablyudeniyaGruppa').hidden = !objectMode(); $('obektNablyudeniya').required = objectMode(); }); });
    $('koordinatyNablyudeniya').addEventListener('change', function () { var p = coordinates(); if (p) { setCoordinates(p); if (map) map.setCenter(p, 16); } });
    $('useLocation').addEventListener('click', function () {
      if (!navigator.geolocation) return error('Геолокация недоступна. Введите координаты вручную');
      navigator.geolocation.getCurrentPosition(function (p) { device = { deviceLatitude: p.coords.latitude, deviceLongitude: p.coords.longitude, gpsAccuracyM: p.coords.accuracy }; setCoordinates([p.coords.latitude, p.coords.longitude]); if (map) map.setCenter([p.coords.latitude, p.coords.longitude], 16); }, function () { error('Местоположение не получено. Выберите точку вручную'); }, { timeout: 10000, enableHighAccuracy: true });
    });
    $('obektNablyudeniya').addEventListener('change', function () {
      var obj = selectedObject(); if (!obj) return;
      $('obektNablyudeniyaOpisanie').textContent = [obj.description, obj.addressHint, obj.dueDate ? 'До ' + obj.dueDate : ''].filter(Boolean).join('. ');
      if (!$('nazvanieNablyudeniya').value) $('nazvanieNablyudeniya').value = obj.title; if (!$('mestoNablyudeniya').value) $('mestoNablyudeniya').value = obj.addressHint || '';
      if (map) { if (boundaryShape) map.geoObjects.remove(boundaryShape); if (obj.boundary && obj.boundary.length) { boundaryShape = new ymaps.Polygon([obj.boundary.concat([obj.boundary[0]])], {}, { fillColor: '#e8b0c244', strokeColor: '#783e53', strokeWidth: 3 }); map.geoObjects.add(boundaryShape); map.setBounds(boundaryShape.geometry.getBounds(), { checkZoomRange: true, zoomMargin: 30 }); } else if (obj.centerLat != null && obj.centerLng != null) map.setCenter([obj.centerLat, obj.centerLng], 16); }
    });
    form.addEventListener('input', function () { dirty = true; });
    window.addEventListener('beforeunload', function (event) { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    form.addEventListener('submit', async function (event) {
      event.preventDefault(); if (stage !== 'finish' || busy) return;
      var checks = Array.from(form.querySelectorAll('.checklist-input'));
      if (!checks.every(function (input) { return input.checked; })) { $('checklistError').hidden = false; return; }
      $('checklistError').hidden = true;
      if (!pointValid() || trees.length < 2 || trees.length > 5 || trees.some(function (t) { return !t.complete; })) return error('Проверьте место и завершите разметку каждого дерева');
      var button = form.querySelector('[type="submit"]'); busy = true; button.disabled = true; button.textContent = 'Загружаем фотографии…'; error('');
      try {
        var treeData = trees.map(function (tree) { var out = { treePhoto: tree.treePhoto, files: tree.files }; tree.block.querySelectorAll('[data-field]').forEach(function (field) { out[field.dataset.field] = field.value; }); return out; });
        var upload = await EcoAuth.uploadObservationPhotos(treeData), uploadedTrees = upload.trees.map(function (item, i) { return Object.assign({}, treeData[i], item); });
        var obj = objectMode() && selectedObject(), coord = coordinates(); button.textContent = 'Сохраняем заявку…';
        var payload = { title: $('nazvanieNablyudeniya').value.trim(), location: $('mestoNablyudeniya').value.trim(), coordinates: coord.join(', '), latitude: coord[0], longitude: coord[1], collectionDate: $('dataSbora').value, comment: $('kommentariyNablyudeniya').value.trim(), files: upload.files, treePhoto: upload.treePhoto, trees: uploadedTrees, treeCount: trees.length, leafCount: upload.files.length, sourceType: obj ? (obj.assigned ? 'assigned_object' : 'open_object') : 'own', objectId: obj ? obj.id : null, territoryType: $('tipTerritorii').value, landUse: $('tipTerritorii').value, nearbySources: $('istochnikiVozdeystviya').value.trim(), roadDistanceM: $('rasstoyanieDoroga').value, trafficIntensity: $('intensivnostDvizheniya').value, surfaceCover: $('tipPokrytiya').value, weatherConditions: $('pogodaNablyudeniya').value.trim(), treeSpecies: 'Берёза повислая', trunkDiameterCm: treeData[0].trunkDiameterCm, treeHeightEstimateM: treeData[0].treeHeightEstimateM, treeCondition: treeData[0].treeCondition, treeDamageNotes: treeData[0].treeDamageNotes, participantChecklist: checks.map(function () { return true; }), landmarks: allLandmarks(), photoPrecheck: { passed: true, checked: upload.files.length, method: 'background-resolution-v2' }, integrityCode: code, capturedAt: new Date().toISOString() };
        Object.assign(payload, device);
        var result = await EcoAuth.createRequest(payload); dirty = false; sessionStorage.removeItem('eco-field-code'); sessionStorage.setItem('eco-last-request-id', result.id); location.href = 'my-requests.html';
      } catch (e) { var messages = { RATE_LIMITED: 'Достигнут лимит отправок. Не закрывайте вкладку и попробуйте позже', DUPLICATE_PHOTO: 'Эта фотография уже отправлялась. Используйте новые снимки', OUTSIDE_ASSIGNED_TERRITORY: 'Точка находится вне территории куратора', INVALID_PHOTO_UPLOAD: 'Не все фотографии загрузились. Повторите отправку', AUTH_REQUIRED: 'Сессия закончилась. Войдите снова, сохранив вкладку с заявкой', REQUESTS_API_FAILED: 'Не удалось сохранить заявку. Попробуйте позже или сообщите через обратную связь' }; error(messages[e.message] || 'Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз'); }
      finally { busy = false; button.disabled = false; button.textContent = 'Отправить точку на проверку'; }
    });
    if (typeof ymaps !== 'undefined') ymaps.ready(function () { map = new ymaps.Map('kartaVyborKoordinat', { center: [59.378, 28.612], zoom: 13, controls: ['zoomControl'] }); map.events.add('click', function (event) { setCoordinates(event.get('coords')); }); });
    else $('kartaVyborStatus').textContent = 'Карта не загрузилась. Координаты можно ввести ниже';
    try { context = await EcoAuth.getParticipationContext(); (context.objects || []).forEach(function (obj) { $('obektNablyudeniya').add(new Option(obj.title, obj.id)); }); }
    catch (_) { $('obektNablyudeniyaOpisanie').textContent = 'Задания пока недоступны. Свою точку можно добавить'; }
  });
})();
