'use strict';

const LANDMARK_NAMES = [
  'apex', 'base',
  'left_v1_base', 'left_v1_end', 'right_v1_base', 'right_v1_end',
  'left_v2_base', 'left_v2_end', 'right_v2_base', 'right_v2_end',
  'width_left', 'width_right'
];

function cleanPoint(point) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  const x = Number(point.x); const y = Number(point.y);
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: x, y: y };
}

function cleanLandmarkSets(value, max) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max || 120).map(function (set) {
    const points = {};
    const source = set && set.points && typeof set.points === 'object' ? set.points : {};
    LANDMARK_NAMES.forEach(function (name) { const point = cleanPoint(source[name]); if (point) points[name] = point; });
    return {
      fileHash: String(set && set.fileHash || '').slice(0, 64),
      fileName: String(set && set.fileName || '').slice(0, 180),
      imageWidth: Math.max(1, Number(set && set.imageWidth || 1)),
      imageHeight: Math.max(1, Number(set && set.imageHeight || 1)),
      treeIndex: Number.isInteger(Number(set && set.treeIndex)) ? Number(set.treeIndex) : 0,
      points: points
    };
  });
}

function isCompleteSet(set) {
  return Boolean(set && LANDMARK_NAMES.every(function (name) { return cleanPoint(set.points && set.points[name]); }));
}
function pixels(point, width, height) { return { x: point.x * width, y: point.y * height }; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function distanceToAxis(point, base, apex) {
  const axisX = apex.x - base.x; const axisY = apex.y - base.y; const length = Math.hypot(axisX, axisY);
  if (!length) return NaN;
  return Math.abs(axisY * point.x - axisX * point.y + apex.x * base.y - apex.y * base.x) / length;
}
function asymmetry(left, right) {
  const sum = left + right;
  return Number.isFinite(sum) && sum > 0 ? Math.abs(left - right) / sum : NaN;
}

function calculateLeaf(set, index) {
  if (!isCompleteSet(set)) return null;
  const width = Math.max(1, Number(set.imageWidth || 1)); const height = Math.max(1, Number(set.imageHeight || 1));
  const p = {};
  LANDMARK_NAMES.forEach(function (name) { p[name] = pixels(set.points[name], width, height); });
  const measurements = {
    leftV1: distance(p.left_v1_base, p.left_v1_end), rightV1: distance(p.right_v1_base, p.right_v1_end),
    leftV2: distance(p.left_v2_base, p.left_v2_end), rightV2: distance(p.right_v2_base, p.right_v2_end),
    widthLeft: distanceToAxis(p.width_left, p.base, p.apex), widthRight: distanceToAxis(p.width_right, p.base, p.apex)
  };
  const traits = {
    v1: asymmetry(measurements.leftV1, measurements.rightV1),
    v2: asymmetry(measurements.leftV2, measurements.rightV2),
    width: asymmetry(measurements.widthLeft, measurements.widthRight)
  };
  const values = Object.values(traits).filter(Number.isFinite);
  if (values.length !== 3) return null;
  const fa = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
  return {
    index: index, treeIndex: set.treeIndex, fileHash: set.fileHash || '', fileName: set.fileName || '', fa: Number(fa.toFixed(6)),
    traits: Object.fromEntries(Object.entries(traits).map(function (entry) { return [entry[0], Number(entry[1].toFixed(6))]; })),
    measurements: Object.fromEntries(Object.entries(measurements).map(function (entry) { return [entry[0], Number(entry[1].toFixed(3))]; }))
  };
}

function calculateRequestFa(sets) {
  const leaves = cleanLandmarkSets(sets, 120).map(calculateLeaf).filter(Boolean);
  if (!leaves.length) throw new Error('LANDMARKS_REQUIRED');
  const byTree = new Map();
  leaves.forEach(function (leaf) { const group = byTree.get(leaf.treeIndex) || []; group.push(leaf.fa); byTree.set(leaf.treeIndex, group); });
  const trees = [...byTree].sort(function (a, b) { return a[0] - b[0]; }).map(function (entry) {
    return { treeIndex: entry[0], leafCount: entry[1].length,
      meanFa: Number((entry[1].reduce(function (sum, value) { return sum + value; }, 0) / entry[1].length).toFixed(6)) };
  });
  const meanFa = trees.reduce(function (sum, tree) { return sum + tree.meanFa; }, 0) / trees.length;
  const variance = leaves.length > 1 ? leaves.reduce(function (sum, leaf) { return sum + Math.pow(leaf.fa - meanFa, 2); }, 0) / (leaves.length - 1) : 0;
  return {
    status: 'calculated', engine: 'landmark-fa-v1',
    formula: 'mean(|L-R|/(L+R)) for V1, V2 and width', validLeafCount: leaves.length, 
    meanFa: Number(meanFa.toFixed(6)), standardDeviation: Number(Math.sqrt(variance).toFixed(6)),
    trees: trees,
    leaves: leaves, calculatedAt: new Date().toISOString()
  };
}

module.exports = { LANDMARK_NAMES, cleanLandmarkSets, isCompleteSet, calculateLeaf, calculateRequestFa };
