(function () {
  'use strict';
  var labels = ['Нормальный лист берёзы', 'Повреждённый лист берёзы', 'Лист другого вида'];
  var modelPromise;
  function resizeGeometry(width, height) {
    if (!(width > 0 && height > 0)) throw new Error('Некорректный размер фотографии.');
    // Matches TensorFlow resize_with_pad: floor resized sizes, symmetric zero padding.
    var ratio = Math.max(width / 192, height / 192);
    var h = Math.max(1, Math.floor(height / ratio)), w = Math.max(1, Math.floor(width / ratio));
    var top = Math.floor((192 - height / ratio) / 2), left = Math.floor((192 - width / ratio) / 2);
    return { width: w, height: h, top: top, left: left, bottom: 192 - h - top, right: 192 - w - left };
  }
  function summarize(values) {
    if (values.length !== 3 || values.some(function (v) { return !Number.isFinite(v) || v < 0 || v > 1; }) || Math.abs(values.reduce(function (s, v) { return s + v; }, 0) - 1) > .02) throw new Error('Модель вернула некорректный результат.');
    var best = values.indexOf(Math.max.apply(null, values));
    return { title: labels[best], scores: labels.map(function (label, i) { return label + ': ' + (values[i] * 100).toFixed(1).replace('.', ',') + '%'; }) };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { resizeGeometry: resizeGeometry, summarize: summarize };
  if (typeof document === 'undefined') return;
  var form = document.getElementById('classifierForm');
  if (!form) return;
  var field = document.getElementById('leafPhoto'), button = document.getElementById('classifyButton');
  var preview = document.getElementById('leafPreview'), status = document.getElementById('classifierStatus');
  var result = document.getElementById('classifierResult'), objectURL, busy = false;
  field.addEventListener('change', function () { result.hidden = true; preview.hidden = true; status.textContent = ''; });
  async function loadModel() {
    if (!window.tf || !window.tflite) throw new Error('Не удалось загрузить библиотеку распознавания. Проверьте интернет и попробуйте ещё раз.');
    if (!modelPromise) {
      window.tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/');
      modelPromise = window.tf.ready().then(function () { return window.tflite.loadTFLiteModel('model/ecobio_leaf_classifier.tflite', { numThreads: 1 }); }).then(function (model) {
        var input = model.inputs[0];
        if (!input || input.dtype !== 'float32' || input.shape.join(',') !== '1,192,192,3') throw new Error('Формат модели не совпадает с настройками.');
        return model;
      }).catch(function (error) { modelPromise = null; throw error; });
    }
    return modelPromise;
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault(); if (busy) return;
    var file = field.files[0];
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { status.textContent = 'Выберите JPG, PNG или WebP размером до 15 МБ.'; return; }
    busy = true; button.disabled = true; field.disabled = true; result.hidden = true;
    var input, output;
    try {
      status.textContent = 'Подготовка фотографии…';
      if (objectURL) URL.revokeObjectURL(objectURL);
      objectURL = URL.createObjectURL(file); preview.src = objectURL;
      await preview.decode();
      if (preview.naturalWidth * preview.naturalHeight > 40000000) throw new Error('Слишком большая фотография. Уменьшите её до 40 мегапикселей.');
      preview.hidden = false; status.textContent = 'Загрузка модели и проверка листа… Первый запуск может занять больше времени.';
      var model = await loadModel();
      var g = resizeGeometry(preview.naturalWidth, preview.naturalHeight);
      input = window.tf.tidy(function () {
        var pixels = window.tf.browser.fromPixels(preview).toFloat();
        var resized = window.tf.image.resizeBilinear(pixels, [g.height, g.width], false, true);
        // Normalization x / 127.5 - 1 is already inside the exported model. Do not apply it twice.
        return window.tf.pad(resized, [[g.top, g.bottom], [g.left, g.right], [0, 0]], 0).expandDims(0);
      });
      output = model.predict(input);
      var tensors = Array.isArray(output) ? output : (output.data ? [output] : Object.values(output));
      if (tensors.length !== 1) throw new Error('Неожиданный формат ответа модели.');
      var summary = summarize(Array.from(await tensors[0].data()));
      document.getElementById('classifierTitle').textContent = summary.title;
      var list = document.getElementById('classifierScores'); list.replaceChildren();
      summary.scores.forEach(function (score) { var item = document.createElement('li'); item.textContent = score; list.appendChild(item); });
      result.hidden = false; status.textContent = 'Проверка завершена.';
    } catch (error) { status.textContent = 'Проверка не выполнена. ' + error.message; }
    finally { if (input) input.dispose(); if (output) window.tf.dispose(output); busy = false; button.disabled = false; field.disabled = false; }
  });
  window.addEventListener('pagehide', function () { if (objectURL) URL.revokeObjectURL(objectURL); });
})();
