(function () {
  'use strict';
  var titles = { participant: 'Подготовка волонтёра', moderator: 'Подготовка модератора', curator: 'Подготовка куратора' };
  async function create(course) {
    if (!titles[course]) throw new Error('INVALID_COURSE');
    var status = await EcoAuth.refreshCourseStatus(course);
    var demo = status.preview === true;
    if (!status.completed) throw new Error('EDUCATION_REQUIRED');
    var certificate = status.certificate;
    if (!certificate && !demo) throw new Error('CERTIFICATE_UNAVAILABLE');
    certificate = certificate || { name: 'Образец участника', completedAt: new Date().toISOString(), id: 'ОБРАЗЕЦ' };
    var font = await EcoPdf.loadFont();
    var pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
    pdf.addFileToVFS('Comfortaa.ttf', font); pdf.addFont('Comfortaa.ttf', 'Comfortaa', 'normal'); pdf.setFont('Comfortaa');
    pdf.setProperties({ title: 'Сертификат: ' + titles[course], author: 'ЭкоБиоМониторинг' });
    pdf.setFillColor(249, 247, 241); pdf.rect(0, 0, 297, 210, 'F');
    pdf.setFillColor(232, 176, 194); pdf.rect(0, 0, 297, 14, 'F'); pdf.rect(0, 196, 297, 14, 'F');
    pdf.setDrawColor(47, 107, 63); pdf.setLineWidth(.5); pdf.rect(14, 24, 269, 161);
    function center(text, size, y, maxWidth) {
      pdf.setFontSize(size); pdf.setTextColor(47, 107, 63);
      var lines = pdf.splitTextToSize(text, maxWidth || 240); pdf.text(lines, 148.5, y, { align: 'center', lineHeightFactor: 1.35 });
      return lines.length * size * .48;
    }
    var leafResponse = await fetch('img/leaf1.png');
    if (leafResponse.ok) {
      var leaf = new Uint8Array(await leafResponse.arrayBuffer());
      pdf.addImage(leaf, 'PNG', 23, 30, 15, 18); pdf.addImage(leaf, 'PNG', 259, 155, 15, 18);
    }
    center('ЭкоБиоМониторинг', 17, 40);
    center(demo ? 'ОБРАЗЕЦ СЕРТИФИКАТА' : 'СЕРТИФИКАТ', 29, 62);
    center('подтверждает прохождение обучения', 11, 76);
    var name = String(certificate.name).slice(0, 80);
    var nameSize = name.length > 48 ? 15 : 20;
    var height = center(name, nameSize, 96, 225);
    center(titles[course], 16, Math.max(123, 101 + height));
    center('Правила сбора данных, работа на платформе и проверка знаний', 10, 141);
    center('Дата: ' + new Date(certificate.completedAt).toLocaleDateString('ru-RU') + '    ' + certificate.id, 9, 163);
    center(demo ? 'Демонстрационный документ. Не подтверждает обучение' : 'Сертификат образовательного модуля проекта. Не является документом о квалификации', 8, 175);
    return pdf;
  }
  window.EcoCertificates = { create: create, download: async function (course) { var pdf = await create(course); pdf.save('EcoBioMonitoring_certificate_' + course + '.pdf'); } };
})();
