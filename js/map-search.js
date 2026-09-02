// map-search.js — локальные ответы и запросы умного поиска
(function () {
  'use strict';

  // локальные ответы на типовые вопросы (без AI)
  function localAnswer(question) {
    var value = question.toLowerCase().trim();

    if (/принять участ|участв|волонт[её]р|стать участник/.test(value)) {
      return 'Для участия нужен личный кабинет. После входа участник проходит обучение по методике, затем получает доступ к отправке наблюдения. Публикация на карте происходит только после проверки модератором и автоматической проверки.';
    }
    if (/флуктуир|асиммет|метод фа/.test(value)) {
      return 'Флуктуирующая асимметрия - небольшие случайные отклонения от двусторонней симметрии листа. В методике сопоставляются пять пар промеров левой и правой сторон, после чего рассчитывается интегральный показатель.';
    }
    if (/выбрать.*бер[её]з|бер[её]з.*выбрать|какое дерево|выбор дерева/.test(value)) {
      return 'Для наблюдения выбирают взрослую берёзу повислую без выраженных болезней и сильных повреждений. Подробные признаки дерева и правила отбора материала находятся в обязательном обучении.';
    }
    if (/фотограф|фото лист|снимать лист/.test(value)) {
      return 'Лист фотографируют полностью расправленным на белом фоне, строго сверху и при равномерном освещении. В кадре не должно быть посторонних предметов, сильных теней, бликов или перспективного наклона.';
    }
    if (/после.*отправ|провер|модерац|одобр|отклон/.test(value)) {
      return 'После отправки наблюдение получает статус проверки. Сначала модератор сверяет данные и фотографии, затем запускается автоматическая проверка. Публичной точкой на карте становится только наблюдение, прошедшее оба этапа.';
    }
    if (/сколько.*точ|количеств.*точ|точек будет/.test(value)) {
      return 'Точное число точек будущей сети пока не зафиксировано. Проект расширяется по мере полевой работы и проверки данных; рабочий диапазон сейчас рассматривается примерно от 14 до 25 точек.';
    }
    if (/самое высок|наибольш|самое загряз|где загряз|сравн.*точ/.test(value)) {
      return 'Актуальное сравнение появится после накопления и модерации новой сети наблюдений. Пока подтверждённых данных недостаточно, корректно назвать наиболее загрязнённое место нельзя.';
    }
    if (/шкал|балл|уровень загряз/.test(value)) {
      return 'В методике используется пятибалльная шкала стабильности развития: от условной нормы до критического значения. Конкретный уровень для точки публикуется только вместе с проверенными данными.';
    }
    return null;
  }

  // внешний AI временно отключён, чтобы не добавлять серверные функции на Vercel Hobby
  async function askAi(question) {
    void question;
    throw new Error('AI_NOT_AVAILABLE');
  }

  document.addEventListener('DOMContentLoaded', function () {
    // элементы поиска
    var input = document.getElementById('poiskVopros');
    var button = document.getElementById('poiskKnopka');
    var answerWrap = document.getElementById('poiskOtvet');
    var answerText = document.getElementById('poiskOtvetTekst');
    var source = document.getElementById('poiskOtvetIstochnik');
    if (!input || !button || !answerWrap || !answerText || !source) return;

    // примеры вопросов
    document.querySelectorAll('[data-vopros]').forEach(function (example) {
      example.addEventListener('click', function () {
        input.value = example.dataset.vopros;
        input.focus();
      });
    });

    // обработка ввода
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') run();
    });
    button.addEventListener('click', run);

    async function run() {
      var question = input.value.trim();
      if (!question || button.disabled) return;
      button.disabled = true;
      answerWrap.hidden = false;
      answerText.textContent = 'Проверяю данные';
      source.textContent = '';

      try {
        var local = localAnswer(question);
        if (local) {
          answerText.textContent = local;
          source.textContent = 'Методика и текущая логика проекта';
          return;
        }

        answerText.textContent = await askAi(question);
        source.textContent = 'Ответ помощника по материалам проекта';
      } catch (_) {
        answerText.textContent = 'Для этого вопроса нужен AI endpoint. Локальная часть поиска работает, а внешний анализ подключим после настройки серверной модели.';
        source.textContent = '';
      } finally {
        button.disabled = false;
      }
    }
  });
})();
