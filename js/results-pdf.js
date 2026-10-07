(function () {
  'use strict';
  var ready;
  function load() {
    if (!ready) ready = new Promise(function (resolve, reject) {
      if (window.jspdf) return resolve();
      var script = document.createElement('script'); script.src = 'js/vendor/jspdf.umd.min.js'; script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
    }).then(async function () {
      var response = await fetch('fonts/Comfortaa-Regular.ttf'); if (!response.ok) throw new Error('FONT_NOT_FOUND');
      var bytes = new Uint8Array(await response.arrayBuffer()), binary = '';
      for (var i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      return btoa(binary);
    }).catch(function (error) { ready = null; throw error; });
    return ready;
  }
  function level(fa) {
    if (!Number.isFinite(fa) || fa < 0 || fa > 1) return { grade: '?', label: 'Нет расчёта' };
    var i = fa < .04 ? 0 : fa < .045 ? 1 : fa < .05 ? 2 : fa < .055 ? 3 : 4;
    return { grade: ['I', 'II', 'III', 'IV', 'V'][i], label: ['Низкая асимметрия', 'Слабая асимметрия', 'Средняя асимметрия', 'Высокая асимметрия', 'Очень высокая асимметрия'][i] };
  }
  function number(value) { return Number.isFinite(value) ? value.toFixed(6).replace('.', ',') : 'нет'; }
  async function create(item) {
    var font = await load(), result = item.aiResult;
    if (!result || !Array.isArray(result.leaves) || !result.leaves.length) throw new Error('RESULT_REQUIRED');
    var pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    pdf.addFileToVFS('Comfortaa.ttf', font); pdf.addFont('Comfortaa.ttf', 'Comfortaa', 'normal'); pdf.setFont('Comfortaa');
    pdf.setProperties({ title: 'ФА: ' + (item.title || 'Точка наблюдения'), author: 'ЭкоБиоМониторинг', subject: 'Расчёт по разметке листьев' });
    var y = 22;
    function page() { pdf.addPage(); y = 22; }
    function reserve(height) { if (y + height > 277) page(); }
    function text(value, size, after) {
      pdf.setFontSize(size || 10); pdf.setTextColor(48, 53, 31);
      var lines = pdf.splitTextToSize(String(value), 174); var lineHeight = (size || 10) * .45;
      lines.forEach(function (line) { reserve(lineHeight); pdf.text(line, 18, y); y += lineHeight; }); y += after == null ? 4 : after;
    }
    function table(headers, rows, widths) {
      function row(values, header, index) {
        pdf.setFontSize(header ? 9 : 8);
        var lines = values.map(function (value, i) { return pdf.splitTextToSize(String(value), widths[i] - 5); });
        var height = Math.max.apply(null, lines.map(function (v) { return v.length; })) * 4.4 + 5;
        if (y + height > 273) { page(); if (!header) row(headers, true, 0); }
        pdf.setFillColor.apply(pdf, header ? [232, 176, 194] : index % 2 ? [247, 245, 239] : [238, 240, 227]);
        pdf.rect(18, y, 174, height, 'F'); var x = 18;
        lines.forEach(function (value, i) { pdf.text(value, x + 2.5, y + 5); x += widths[i]; }); y += height;
      }
      row(headers, true, 0); rows.forEach(function (values, i) { row(values, false, i); }); y += 7;
    }
    text('ЭкоБиоМониторинг', 20, 5);
    text(item.status === 'draft' ? 'Предварительный расчёт. До проверки модератором' : 'Результаты расчёта по разметке', 10, 7);
    text(item.title || 'Точка наблюдения', 15, 4);
    text([item.location, item.coordinates, item.collectionDate ? 'Сбор: ' + item.collectionDate : ''].filter(Boolean).join(' · '));
    if (item.id) text('Заявка: ' + item.id, 8);
    var siteLevel = level(result.meanFa);
    text('ФА точки: ' + number(result.meanFa) + '. Балл ' + siteLevel.grade + ': ' + siteLevel.label.toLowerCase(), 12, 5);
    text('Деревьев: ' + result.trees.length + '. Листьев: ' + result.leaves.length + '. Точка рассчитана как среднее значений деревьев: у каждой берёзы одинаковый вес, независимо от числа листьев.');
    text('ФА характеризует асимметрию развития. Шкала даёт косвенный сигнал о неблагоприятных условиях и не измеряет концентрацию загрязняющих веществ. Для отдельного листа или дерева указан только условный балл по тем же границам; диагноз загрязнения по нему не ставится.', 9, 7);
    table(['Берёза', 'Листьев', 'Средняя ФА', 'Условный балл'], result.trees.map(function (tree) { return [tree.treeIndex + 1, tree.leafCount, number(tree.meanFa), level(tree.meanFa).grade]; }), [30, 30, 60, 54]);
    text('Как получен результат', 12);
    text('Для каждого парного признака: |L − R| / (L + R). ФА листа: среднее пяти признаков. ФА дерева: среднее его листьев. ФА точки: среднее деревьев. Длины измеряются в пикселях исходного фото, углы в радианах. Итоги усредняются до округления.', 9);
    text('Шкала в этом отчёте: I < 0,040; II от 0,040 до 0,045; III от 0,045 до 0,050; IV от 0,050 до 0,055; V от 0,055. Нижняя граница включена, верхняя исключена.', 9);
    text('Ниже Ш: ширина половины листа; Ж: длина второй жилки; О: расстояние между основаниями жилок; К: расстояние между их концами; У: угол второй жилки к оси листа.', 9);
    result.trees.forEach(function (tree) {
      reserve(30); text('Берёза ' + (tree.treeIndex + 1) + ': листья', 12);
      var leaves = result.leaves.filter(function (leaf) { return leaf.treeIndex === tree.treeIndex; });
      table(['Лист', 'Ш', 'Ж', 'О', 'К', 'У', 'ФА', 'Балл'], leaves.map(function (leaf, i) { return [i + 1, number(leaf.traits.width), number(leaf.traits.secondVein), number(leaf.traits.bases), number(leaf.traits.ends), number(leaf.traits.angle), number(leaf.fa), level(leaf.fa).grade]; }), [14, 23, 23, 23, 23, 23, 29, 16]);
      leaves.forEach(function (leaf, i) { text('Лист ' + (i + 1) + ': ' + (leaf.fileName || 'без имени'), 8, 1); }); y += 5;
    });
    reserve(35);
    text('Разброс ФА листьев (выборочное стандартное отклонение): ' + number(result.standardDeviation), 9);
    if (Number.isFinite(result.treeStandardDeviation)) text('Разброс средних значений деревьев: ' + number(result.treeStandardDeviation), 9);
    text('Расчёт: ' + (result.engine || 'версия не указана') + '. Дата выгрузки: ' + new Date().toLocaleDateString('ru-RU'), 8);
    var count = pdf.getNumberOfPages();
    for (var pageIndex = 1; pageIndex <= count; pageIndex++) { pdf.setPage(pageIndex); pdf.setFontSize(8); pdf.setTextColor(90, 94, 70); pdf.text('ЭкоБиоМониторинг · ' + pageIndex + ' / ' + count, 18, 288); }
    return pdf;
  }
  window.EcoPdf = { loadFont: load, level: level, create: create, download: async function (item) { var pdf = await create(item); pdf.save('FA_' + String(item.id || 'preliminary').replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf'); } };
})();
