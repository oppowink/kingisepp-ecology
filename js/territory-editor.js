(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var container = document.getElementById('territoryMap'); if (!container) return;
    var map, line, markers = [], vertices = [], drawing = false;
    var status = document.getElementById('territoryStatus'), list = document.getElementById('territoryVertices');
    var draw = document.getElementById('territoryDraw');
    function center() { return [Number(document.getElementById('obektShirota').value) || 59.378, Number(document.getElementById('obektDolgota').value) || 28.612]; }
    function render() {
      list.replaceChildren();
      if (map) {
        markers.forEach(function (marker) { map.geoObjects.remove(marker); }); markers = [];
        if (line) map.geoObjects.remove(line);
        if (vertices.length > 1) { line = vertices.length > 2 ? new ymaps.Polygon([vertices.concat([vertices[0]])], {}, { fillColor: '#e8b0c24d', strokeColor: '#783e53', strokeWidth: 3 }) : new ymaps.Polyline(vertices, {}, { strokeColor: '#783e53', strokeWidth: 3 }); map.geoObjects.add(line); }
      }
      vertices.forEach(function (coords, index) {
        if (map) { var marker = new ymaps.Placemark(coords, { iconContent: String(index + 1) }, { draggable: true, preset: 'islands#blueCircleIcon' }); map.geoObjects.add(marker); markers.push(marker); marker.events.add('dragend', function () { vertices[index] = marker.geometry.getCoordinates(); render(); }); }
        var row = document.createElement('div'); row.className = 'territory-vertex';
        ['Широта', 'Долгота'].forEach(function (label, axis) { var field = document.createElement('label'); field.className = 'pole-gruppa'; field.textContent = label + ' вершины ' + (index + 1); var input = document.createElement('input'); input.className = 'pole-vvod'; input.type = 'number'; input.min = axis ? -180 : -90; input.max = axis ? 180 : 90; input.step = '.000001'; input.required = true; input.value = coords[axis].toFixed(6); input.addEventListener('change', function () { if (input.checkValidity()) { vertices[index][axis] = Number(input.value); render(); } }); field.appendChild(input); row.appendChild(field); });
        var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'knopka-vtorichnaya'; remove.textContent = 'Удалить вершину'; remove.addEventListener('click', function () { vertices.splice(index, 1); render(); }); row.appendChild(remove); list.appendChild(row);
      });
      if (!vertices.length) status.textContent = 'Без контура используется центр и радиус';
      else { try { EcoTerritory.cleanPolygon(vertices); status.textContent = 'Контур готов. Вершин: ' + vertices.length; } catch (_) { status.textContent = vertices.length < 3 ? 'Добавьте хотя бы три вершины' : 'Контур пересекает сам себя или содержит совпавшие вершины. Поправьте точки'; } }
    }
    function add(coords) { if (vertices.length >= 60) { status.textContent = 'В контуре может быть не больше 60 вершин'; return; } vertices.push(coords); render(); }
    draw.addEventListener('click', function () { drawing = !drawing; draw.setAttribute('aria-pressed', String(drawing)); draw.textContent = drawing ? 'Закончить рисование' : 'Рисовать контур'; });
    document.getElementById('territoryUndo').addEventListener('click', function () { vertices.pop(); render(); });
    document.getElementById('territoryClear').addEventListener('click', function () { vertices = []; render(); });
    document.getElementById('territoryAdd').addEventListener('click', function () { var c = center(); add([c[0] + vertices.length * .0002, c[1]]); });
    window.EcoTerritoryEditor = { coordinates: function () { return EcoTerritory.cleanPolygon(vertices); }, reset: function () { vertices = []; render(); } };
    document.querySelectorAll('.cabinet-fold').forEach(function (fold) { fold.addEventListener('toggle', function () { if (map && fold.open) map.container.fitToViewport(); }); });
    if (typeof ymaps !== 'undefined') ymaps.ready(function () { map = new ymaps.Map(container, { center: center(), zoom: 14, controls: ['zoomControl'] }); map.events.add('click', function (event) { if (drawing) add(event.get('coords')); }); });
    else status.textContent = 'Карта недоступна. Добавьте вершины вручную';
  });
})();
