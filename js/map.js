// map.js — Яндекс.Карта и отображение подтверждённых точек
(function () {
  'use strict';

  var mapInstance = null;
  var selectedPlacemark = null;
  var normalIcon = 'img/icons/map-point.png';
  var activeIcon = 'img/icons/map-point-active.png';
  var normalIconSize = [41, 45];
  var normalIconOffset = [-20, -42];
  var activeIconSize = [39, 45];
  var activeIconOffset = [-19, -42];

  // показать информацию о точке в панели
  function showPoint(data) {
    var panel = document.getElementById('tochkaInformaciya');
    if (!panel || !data) return;

    panel.classList.add('smena-tochki');
    window.setTimeout(function () {
      document.getElementById('tochkaData').textContent = data.date || '';
      document.getElementById('tochkaUroven').textContent = data.level || '';
      document.getElementById('tochkaAdres').textContent = data.address || '';
      document.getElementById('tochkaPoyasnenie').textContent = data.explanation || '';

      var photos = document.getElementById('tochkaFotografii');
      photos.innerHTML = '';
      (data.photos || []).forEach(function (src) {
        var image = document.createElement('img');
        image.src = src;
        image.alt = 'Фотография наблюдения';
        image.loading = 'lazy';
        photos.appendChild(image);
      });

      var downloads = document.getElementById('tochkaSkachivanie');
      var excel = document.getElementById('tochkaExcel');
      var pdf = document.getElementById('tochkaPdf');
      downloads.hidden = !(data.excelUrl || data.pdfUrl);
      if (data.excelUrl) { excel.href = data.excelUrl; excel.hidden = false; } else excel.hidden = true;
      if (data.pdfUrl) { pdf.href = data.pdfUrl; pdf.hidden = false; } else pdf.hidden = true;

      panel.hidden = false;
      requestAnimationFrame(function () { panel.classList.remove('smena-tochki'); });
    }, panel.hidden ? 0 : 130);
  }

  // обновить внешний вид маркера (активный/неактивный)
  function applyMarkerState(placemark, active) {
    if (!placemark) return;
    placemark.options.set({
      iconImageHref: active ? activeIcon : normalIcon,
      iconImageSize: active ? activeIconSize : normalIconSize,
      iconImageOffset: active ? activeIconOffset : normalIconOffset
    });
  }

  // установить выбранный маркер
  function setSelected(placemark) {
    if (selectedPlacemark && selectedPlacemark !== placemark) {
      applyMarkerState(selectedPlacemark, false);
    }
    selectedPlacemark = placemark;
    applyMarkerState(selectedPlacemark, true);
  }

  // добавить одобренные точки на карту
  function addApprovedPoints(points) {
    if (!mapInstance || !Array.isArray(points)) return;
    points.filter(function (point) { return point.status === 'approved'; }).forEach(function (point) {
      var coords = parseCoordinates(point);
      var latitude = coords.latitude;
      var longitude = coords.longitude;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      var prepared = preparePoint(point);

      var placemark = new ymaps.Placemark([latitude, longitude], {}, {
        openBalloonOnClick: false,
        hasBalloon: false,
        iconLayout: 'default#image',
        iconImageHref: normalIcon,
        iconImageSize: normalIconSize,
        iconImageOffset: normalIconOffset
      });
      placemark.events.add('click', function () {
        setSelected(placemark);
        showPoint(prepared);
      });
      mapInstance.geoObjects.add(placemark);
    });
  }

  function parseCoordinates(point) {
    if (Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))) {
      return { latitude: Number(point.latitude), longitude: Number(point.longitude) };
    }
    var parts = String(point.coordinates || '').split(',').map(function (part) { return part.trim(); });
    return {
      latitude: Number(parts[0]),
      longitude: Number(parts[1])
    };
  }

  function preparePoint(point) {
    var files = Array.isArray(point.files) ? point.files : [];
    return {
      date: point.collectionDate || point.date || '',
      level: point.level || point.title || 'Подтверждённая точка',
      address: point.address || point.location || '',
      explanation: point.explanation || 'Точка добавлена участником и подтверждена модератором.',
      photos: files.map(function (file) { return file.data; }).filter(Boolean),
      excelUrl: point.excelUrl || '',
      pdfUrl: point.pdfUrl || ''
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
    if (!window.EcoAuth) return;
    addApprovedPoints(window.EcoAuth.getAllRequests());
  }

  // создание карты
  function createMap() {
    var container = document.getElementById('karta');
    if (!container) return;
    mapInstance = new ymaps.Map('karta', {
      center: [59.378, 28.612],
      zoom: 13,
      controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    window.EcoKarta = {
      getMap: function () { return mapInstance; },
      dobavitOdobrennyeTochki: addApprovedPoints,
      pokazatTochku: showPoint
    };
    applyCityFromData();
    loadApprovedRequests();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof ymaps === 'undefined') return;
    ymaps.ready(createMap);
  });
})();
