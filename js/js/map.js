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
  var defaultCenter = [59.378, 28.612];
  var defaultZoom = 13;

  function showPoint(data) {
    var panel = document.getElementById('tochkaInformaciya');
    if (!panel || !data) return;

    panel.classList.add('smena-tochki');
    window.setTimeout(function () {
      var dateEl = document.getElementById('tochkaData');
      var levelEl = document.getElementById('tochkaUroven');
      var addressEl = document.getElementById('tochkaAdres');
      var explainEl = document.getElementById('tochkaPoyasnenie');
      if (dateEl) dateEl.textContent = data.date || '';
      if (levelEl) levelEl.textContent = data.level || '';
      if (addressEl) addressEl.textContent = data.address || '';
      if (explainEl) explainEl.textContent = data.explanation || '';

      var photos = document.getElementById('tochkaFotografii');
      if (photos) {
        photos.innerHTML = '';
        (data.photos || []).forEach(function (src) {
          var image = document.createElement('img');
          image.src = src;
          image.alt = 'Фотография наблюдения';
          image.loading = 'lazy';
          photos.appendChild(image);
        });
      }

      var downloads = document.getElementById('tochkaSkachivanie');
      var excel = document.getElementById('tochkaExcel');
      var pdf = document.getElementById('tochkaPdf');
      if (downloads) downloads.hidden = !(data.excelUrl || data.pdfUrl);
      if (excel) {
        if (data.excelUrl) {
          excel.href = data.excelUrl;
          excel.hidden = false;
        } else {
          excel.hidden = true;
        }
      }
      if (pdf) {
        if (data.pdfUrl) {
          pdf.href = data.pdfUrl;
          pdf.hidden = false;
        } else {
          pdf.hidden = true;
        }
      }

      panel.hidden = false;
      requestAnimationFrame(function () {
        panel.classList.remove('smena-tochki');
      });
    }, panel.hidden ? 0 : 130);
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
      return point.status === 'approved';
    }).forEach(function (point) {
      var latitude = Number(point.latitude);
      var longitude = Number(point.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

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
        showPoint(point);
      });
      mapInstance.geoObjects.add(placemark);
    });
  }

  function applyCityConfig(cities) {
    if (!mapInstance || !Array.isArray(cities)) return;
    var activeCity = cities.find(function (c) {
      return c.active;
    });
    if (!activeCity || !activeCity.center) return;
    var zoom = Number(activeCity.zoom);
    if (!Number.isFinite(zoom)) zoom = defaultZoom;
    mapInstance.setCenter(activeCity.center, zoom);
  }

  function loadCitiesThenApply() {
    fetch('data/cities.json')
      .then(function (res) {
        if (!res.ok) throw new Error('cities');
        return res.json();
      })
      .then(applyCityConfig)
      .catch(function () {
        /* оставляем default center */
      });
  }

  function createMap() {
    var container = document.getElementById('karta');
    if (!container) return;

    mapInstance = new ymaps.Map('karta', {
      center: defaultCenter,
      zoom: defaultZoom,
      controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    window.EcoKarta = {
      getMap: function () {
        return mapInstance;
      },
      dobavitOdobrennyeTochki: addApprovedPoints,
      pokazatTochku: showPoint
    };

    loadCitiesThenApply();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof ymaps === 'undefined') return;
    ymaps.ready(createMap);
  });
})();
