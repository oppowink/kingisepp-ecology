(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EcoTerritory = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function coordinate(value, max) {
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max;
  }
  function cross(a, b, p) { return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); }
  function onSegment(p, a, b) {
    return Math.abs(cross(a, b, p)) < 1e-10 && p[0] >= Math.min(a[0], b[0]) - 1e-10 && p[0] <= Math.max(a[0], b[0]) + 1e-10 && p[1] >= Math.min(a[1], b[1]) - 1e-10 && p[1] <= Math.max(a[1], b[1]) + 1e-10;
  }
  function intersects(a, b, c, d) {
    return (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) || onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b);
  }
  function cleanPolygon(value) {
    if (value == null || (Array.isArray(value) && !value.length)) return [];
    if (!Array.isArray(value) || value.length < 3 || value.length > 60) throw new Error('INVALID_TERRITORY');
    var p = value.map(function (point) {
      if (!Array.isArray(point) || point.length !== 2 || !coordinate(point[0], 90) || !coordinate(point[1], 180)) throw new Error('INVALID_TERRITORY');
      return point.slice();
    });
    if (new Set(p.map(function (v) { return v.join(','); })).size !== p.length) throw new Error('INVALID_TERRITORY');
    var area = 0;
    p.forEach(function (a, i) { var b = p[(i + 1) % p.length]; area += a[0] * b[1] - b[0] * a[1]; });
    if (Math.abs(area) < 1e-12) throw new Error('INVALID_TERRITORY');
    for (var i = 0; i < p.length; i++) {
      for (var j = i + 1; j < p.length; j++) {
        if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
        if (intersects(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length])) throw new Error('INVALID_TERRITORY');
      }
    }
    return p;
  }
  function contains(point, polygon) {
    if (!coordinate(point[0], 90) || !coordinate(point[1], 180)) return false;
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      var a = polygon[j], b = polygon[i];
      if (onSegment(point, a, b)) return true;
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  return { cleanPolygon: cleanPolygon, contains: contains };
});
