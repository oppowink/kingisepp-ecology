(function () {
  'use strict';

  var mapInstance = null;
  var selectedPlacemark = null;
  var renderedPointIds = new Set();
  var normalIcon = 'img/icons/map-point.png';
  var activeIcon = 'img/icons/map-point-active.png';
  var normalIconSize = [41, 45];
  var normalIconOffset = [-20, -42];
  var activeIconSize = [39, 45];
  var activeIconOffset = [-19, -42];
  var badgeLayout = null;
  var openCard = null;

  function api(path) {
    var base = String(window.ECO_API_BASE || '').replace(/\/$/, '');
    return base + path;
  }

  function backendCanBeTried() {
    if (window.ECO_API_BASE) return true;
    if (location.protocol === 'file:') return false;
    return !['localhost', '127.0.0.1'].includes(location.hostname);
  }

  function publicUrl(value, image) {
    if (typeof value !== 'string' || !value.trim()) return '';
    if (image && /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(value)) return value;
    try {
      var url = new URL(value, location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }

  function number(value) {
    return value == null || value === '' ? NaN : Number(value);
  }

  function faValue(point) {
    var value = number(point.aiResult && point.aiResult.meanFa);
    if (!Number.isFinite(value)) value = number(point.fa);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : NaN;
  }

  function createPointCard(data) {
    var card = document.createElement('article');
    card.className = 'karta-balloon';
    card.tabIndex = -1;
    card.setAttribute('aria-label', data.title);
    function text(tag, value, className) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      node.textContent = value;
      card.appendChild(node);
      return node;
    }
    if (data.date) text('p', data.date, 'tochka-data');
    text('h2', data.title);
    if (data.address) text('p', data.address, 'tochka-adres');
    var assessment = text('p', '', 'tochka-ocenka');
    var badge = document.createElement('span');
    badge.className = 'karta-fa-badge karta-fa-badge--' + data.grade;
    badge.textContent = data.grade === 'none' ? '—' : data.grade;
    assessment.appendChild(badge);
    var label = document.createElement('span');
    label.textContent = data.grade === 'none' ? 'ФА ещё не рассчитана' : data.levelLabel;
    assessment.appendChild(label);

    var pasport = document.createElement('dl');
    pasport.className = 'tochka-pasport';
    var rows = [
      ['ФА', data.faText],
      ['Территория', data.territory],
      ['До дороги', data.roadDistance],
      ['Состояние дерева', data.treeCondition],
      ['Деревьев', data.trees],
      ['Листьев', data.leaves]
    ];
    rows.forEach(function (row) {
      if (row[1] == null || row[1] === '') return;
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1];
      pasport.appendChild(dt);
      pasport.appendChild(dd);
    });

    card.appendChild(pasport);
    if (data.explanation) text('p', data.explanation, 'tochka-primechanie');
    var photos = document.createElement('div');
    photos.className = 'tochka-fotografii';
    data.photos.forEach(function (src, index) {
      var link = document.createElement('a');
      link.href = src;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      var image = document.createElement('img');
      image.src = src;
      image.alt = 'Фотография наблюдения ' + (index + 1);
      image.loading = 'lazy';
      image.width = 144; image.height = 104;
      link.appendChild(image);
      photos.appendChild(link);
    });
    if (data.photos.length) card.appendChild(photos);
    else text('p', 'Фотографии пока не добавлены.', 'tochka-primechanie');

    var downloads = document.createElement('div');
    downloads.className = 'tochka-skachivanie';
    [['Excel', data.excelUrl], ['PDF', data.pdfUrl]].forEach(function (file) {
      if (!file[1]) return;
      var link = document.createElement('a');
      link.href = file[1]; link.download = ''; link.textContent = 'Скачать ' + file[0];
      downloads.appendChild(link);
    });
    if (data.resultItem && !data.pdfUrl) {
      var pdf = document.createElement('button');
      pdf.type = 'button'; pdf.textContent = 'Скачать PDF';
      pdf.addEventListener('click', async function () {
        pdf.disabled = true; pdf.textContent = 'Готовим PDF…';
        try {
          await window.EcoPdf.download(data.resultItem);
          pdf.textContent = 'Скачать PDF';
        } catch (_) {
          pdf.textContent = 'Повторить скачивание PDF';
        } finally { pdf.disabled = false; }
      });
      downloads.appendChild(pdf);
    }
    if (downloads.childElementCount) card.appendChild(downloads);
    return card;
  }

  function showPoint(data, placemark) {
    if (!mapInstance || !data) return;
    if (!data.faText) data = preparePoint(data);
    var coords = placemark ? placemark.geometry.getCoordinates() : data.coordinates;
    if (!coords || !coords.every(Number.isFinite)) return;
    setSelected(placemark);
    var card = createPointCard(data);
    openCard = card;
    mapInstance.balloon.open(coords, card, {
      panelMaxMapArea: 0,
      maxWidth: 370,
      shadow: false,
      autoPan: true,
      autoPanDuration: 0,
      autoPanMargin: 24,
      offset: [0, -42],
      closeButton: true
    }).then(function () {
      if (openCard === card) card.focus({ preventScroll: true });
    }, function () {
      var status = document.getElementById('kartaStatus');
      status.textContent = 'Не удалось открыть сведения о точке. Нажмите на неё ещё раз.';
      status.hidden = false;
    });
  }

  function applyMarkerState(placemark, active) {
    if (!placemark) return;
    placemark.options.set({
      iconImageHref: active ? activeIcon : normalIcon,
      iconImageSize: active ? activeIconSize : normalIconSize,
      iconImageOffset: active ? activeIconOffset : normalIconOffset
    });
  }

  function setSelected(placemark) {
    if (selectedPlacemark && selectedPlacemark !== placemark) {
      applyMarkerState(selectedPlacemark, false);
    }
    selectedPlacemark = placemark;
    applyMarkerState(selectedPlacemark, true);
  }

  function addApprovedPoints(points) {
    if (!mapInstance || !Array.isArray(points)) return;
    points.filter(function (point) {
      return window.EcoAuth && typeof window.EcoAuth.isRequestPublished === 'function'
        ? window.EcoAuth.isRequestPublished(point)
        : point.status === 'published';
    }).forEach(function (point) {
      if (point.id && renderedPointIds.has(point.id)) return;
      var coords = parseCoordinates(point);
      var latitude = coords.latitude;
      var longitude = coords.longitude;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      if (point.id) renderedPointIds.add(point.id);
      var prepared = preparePoint(point);

      var placemark = new ymaps.Placemark([latitude, longitude], {
        faGrade: prepared.grade,
        iconContent: prepared.grade === 'none' ? '—' : prepared.grade
      }, {
        openBalloonOnClick: false,
        hasBalloon: false,
        iconLayout: 'default#imageWithContent',
        iconContentLayout: badgeLayout,
        iconContentOffset: [22, 21],
        iconContentSize: [24, 24],
        iconImageHref: normalIcon,
        iconImageSize: normalIconSize,
        iconImageOffset: normalIconOffset
      });
      placemark.events.add('click', function () {
        showPoint(prepared, placemark);
      });
      mapInstance.geoObjects.add(placemark);
    });
  }

  function parseCoordinates(point) {
    if (Number.isFinite(number(point.latitude)) && Number.isFinite(number(point.longitude))) {
      return { latitude: number(point.latitude), longitude: number(point.longitude) };
    }
    var parts = String(point.coordinates || '').split(',').map(function (part) { return part.trim(); });
    return {
      latitude: number(parts[0]),
      longitude: number(parts[1])
    };
  }

  function preparePoint(point) {
    var files = Array.isArray(point.files) ? point.files : [];
    var treePhoto = point.treePhoto;
    var photos = [treePhoto].concat(files, Array.isArray(point.photos) ? point.photos : []).map(function (file) {
      return publicUrl(typeof file === 'string' ? file : file && (file.url || file.data), true);
    }).filter(Boolean);
    var fa = faValue(point);
    var level = window.EcoPdf.level(fa);
    var coordinates = parseCoordinates(point);
    var distance = number(point.roadDistanceM);
    var date = point.collectionDate || point.date || '';
    return {
      coordinates: [coordinates.latitude, coordinates.longitude],
      grade: level.grade === '?' ? 'none' : level.grade,
      levelLabel: level.label,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('.') : date,
      title: point.title || 'Подтверждённая точка',
      address: point.address || point.location || '',
      faText: Number.isFinite(fa) ? fa.toFixed(4).replace('.', ',') : 'в обработке',
      territory: point.territoryType || '',
      roadDistance: Number.isFinite(distance) ? distance + ' м' : '',
      treeCondition: point.treeCondition || '',
      trees: Number(point.treeCount || 0),
      leaves: Number(point.leafCount || files.length),
      photos: Array.from(new Set(photos)),
      explanation: point.explanation || '',
      excelUrl: publicUrl(point.excelUrl),
      pdfUrl: publicUrl(point.pdfUrl),
      resultItem: point.aiResult && point.aiResult.leaves ? point : null
    };
  }

  function applyCityFromData() {
    fetch('data/cities.json')
      .then(function (res) { return res.json(); })
      .then(function (cities) {
        var activeCity = cities.find(function (city) { return city.active; });
        if (activeCity && mapInstance) {
          mapInstance.setCenter(activeCity.center, activeCity.zoom);
        }
      })
      .catch(function () {});
  }

  function loadApprovedRequests() {
    if (window.EcoAuth) addApprovedPoints(window.EcoAuth.getAllRequests());
    if (!backendCanBeTried()) return;

    fetch(api('/api/requests/list?scope=published'), { cache: 'no-store' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (data && Array.isArray(data.requests)) addApprovedPoints(data.requests);
      })
      .catch(function () {});
  }

  function loadEmbeddedResearchPoints() {
    fetch('data/research-sites.json', { cache: 'no-store' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (data && Array.isArray(data.points)) addApprovedPoints(data.points);
      })
      .catch(function () {});
  }

  function createMap() {
    var container = document.getElementById('karta');
    if (!container) return;
    badgeLayout = ymaps.templateLayoutFactory.createClass('<span class="karta-fa-badge karta-fa-badge--$[properties.faGrade]">$[properties.iconContent]</span>');
    mapInstance = new ymaps.Map('karta', {
      center: [59.378, 28.612],
      zoom: 13,
      controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });
    function applyTheme(){container.classList.toggle('karta--temnaya',document.documentElement.dataset.theme==='dark'||document.body.dataset.theme==='dark');}
    applyTheme();
    new MutationObserver(applyTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class']});
    mapInstance.balloon.events.add('close', function () {
      applyMarkerState(selectedPlacemark, false);
      selectedPlacemark = null;
      if (openCard && (openCard.contains(document.activeElement) || container.contains(document.activeElement) || document.activeElement === document.body)) {
        container.focus({ preventScroll: true });
      }
      openCard = null;
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && mapInstance.balloon.isOpen()) {
        event.preventDefault();
        mapInstance.balloon.close();
      }
    });

    window.EcoKarta = {
      getMap: function () { return mapInstance; },
      dobavitOdobrennyeTochki: addApprovedPoints,
      pokazatTochku: showPoint
    };
    applyCityFromData();
    loadEmbeddedResearchPoints();
    loadApprovedRequests();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof ymaps === 'undefined') {
      var status = document.getElementById('kartaStatus');
      status.textContent = 'Не удалось загрузить карту. Обновите страницу.';
      status.hidden = false;
      return;
    }
    ymaps.ready(createMap);
  });
})();
