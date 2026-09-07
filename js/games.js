/* games.js — три локальные мини-игры. Прогресс обучения, роли, заявки и API
   не затрагиваются. Фотографии подключаются по путям из GAMES_ASSETS.txt. */
(function () {
  'use strict';

  const ASSETS = {
    roadTree: { path: 'img/games/tree_road.jpg', alt: 'Берёза возле дороги', detail: 'Дерево у улицы, рядом асфальт.' },
    parkTree: { path: 'img/games/tree_park.jpg', alt: 'Берёза в парке', detail: 'Дерево в парке, вокруг открытая почва.' },
    normal1: { path: 'img/games/leaf_normal_1.png', alt: 'Образец с целым контуром', detail: 'Край целый. Обе стороны близки по форме.' },
    normal2: { path: 'img/games/leaf_normal_2.png', alt: 'Целый лист с небольшой естественной неровностью', detail: 'Отверстий и разрывов нет. Различия сторон небольшие.' },
    normal3: { path: 'img/games/leaf_normal_3.png', alt: 'Целый расправленный лист', detail: 'Пластинка расправлена. Край виден полностью.' },
    damaged1: { path: 'img/games/leaf_damaged_1.png', alt: 'Лист с утраченной частью края', detail: 'Часть края отсутствует: ткань оборвана.' },
    damaged2: { path: 'img/games/leaf_damaged_2.png', alt: 'Лист с разрывом пластинки', detail: 'От края к середине проходит разрыв.' },
    damaged3: { path: 'img/games/leaf_damaged_3.png', alt: 'Лист с отверстиями в пластинке', detail: 'Внутри пластинки видны отверстия.' },
    asymmetric1: { path: 'img/games/leaf_asymmetric_1.png', alt: 'Целый лист с разной шириной сторон', detail: 'Край целый. Одна сторона заметно шире другой.' },
    asymmetric2: { path: 'img/games/leaf_asymmetric_2.png', alt: 'Целый лист с различием формы сторон', detail: 'Ткань не утрачена. Форма сторон заметно различается.' },
    asymmetric3: { path: 'img/games/leaf_asymmetric_3.png', alt: 'Целый лист с различием расположения жилок', detail: 'Разрывов нет. Парные жилки расположены неодинаково.' },
    blurred: { path: 'img/games/moderator_leaf_blurred.jpg', alt: 'Нерезкая фотография листа', detail: 'Из-за нерезкости границы листа и жилки не различимы.' },
    cropped: { path: 'img/games/moderator_leaf_cropped.jpg', alt: 'Фотография с обрезанным краем листа', detail: 'Часть листа находится за границей снимка.' },
    street: { path: 'img/icons/games/territory-road.png', alt: 'Иконка: улица', detail: '∥', icon: true },
    park: { path: 'img/icons/games/territory-park.png', alt: 'Иконка: парк', detail: '◇', icon: true },
    asphalt: { path: 'img/icons/games/surface-asphalt.png', alt: 'Иконка: асфальт', detail: '▤', icon: true },
    soil: { path: 'img/icons/games/surface-soil.png', alt: 'Иконка: почва', detail: '▧', icon: true },
    near: { path: 'img/icons/games/distance-near.png', alt: 'Иконка: близко к дороге', detail: '↔', icon: true },
    far: { path: 'img/icons/games/distance-far.png', alt: 'Иконка: далеко от дороги', detail: '↤', icon: true }
  };
  const SITES = {
    road: { name: 'У дороги', asset: 'roadTree', description: 'Улица · асфальт · близко к дороге', fields: { territory: 'street', surface: 'asphalt', distance: 'near' } },
    park: { name: 'В парке', asset: 'parkTree', description: 'Парк · почва · далеко от дороги', fields: { territory: 'park', surface: 'soil', distance: 'far' } }
  };
  const LEAVES = [
    { asset: 'normal1', category: 'normal', note: 'Целый контур позволяет выполнить промеры. Небольшая естественная неровность допустима.' },
    { asset: 'damaged1', category: 'damaged', note: 'Утраченная ткань — повреждение, а не различие сторон при развитии листа.' },
    { asset: 'asymmetric1', category: 'asymmetric', note: 'Различие ширины нужно измерить. Целый асимметричный лист не исключают только из-за формы.' },
    { asset: 'normal2', category: 'normal', note: 'Материал целый. Отбирать только идеально симметричные листья нельзя.' },
    { asset: 'damaged2', category: 'damaged', note: 'Разрыв мешает восстановить исходную форму. Этот образец отмечают отдельно.' },
    { asset: 'asymmetric2', category: 'asymmetric', note: 'Целостность сохранена. По внешнему виду нельзя объявлять воздух загрязнённым.' },
    { asset: 'normal3', category: 'normal', note: 'Контур виден полностью. Пригодность снимка не означает нулевую асимметрию.' },
    { asset: 'damaged3', category: 'damaged', note: 'Отверстия относятся к повреждениям. Их нельзя подменять значением ФА.' },
    { asset: 'asymmetric3', category: 'asymmetric', note: 'Расположение жилок оценивают по методике. Один лист не характеризует всю территорию.' }
  ];
  // Это явно обозначенные учебные ситуации: нет координат, результатов ФА
  // или персональных данных реальных участников.
  const APPLICATIONS = [
    {
      name: 'Парк', photos: ['parkTree', 'normal1', 'asymmetric1'],
      fields: [['Комплект', 'Дерево и 30 листьев'], ['Место и дата', 'Указаны'], ['Паспорт', 'Заполнен']],
      expected: 'approve', summary: 'Полный комплект, заполненный паспорт и целые контуры.', note: 'Комплект полный, паспорт заполнен, контуры видны. Целый асимметричный лист не повод отклонять заявку.',
      next: 'В реальном проекте одобренная заявка переходит на автоматическую проверку, а не сразу на карту.'
    },
    {
      name: 'Сквер', photos: ['parkTree', 'blurred', 'normal2'],
      fields: [['Комплект', 'Дерево и 28 листьев'], ['Место и дата', 'Указаны'], ['Паспорт', 'Заполнен']],
      expected: 'reject', summary: '28 листьев вместо 30, один снимок нерезкий.', note: 'Не хватает двух листьев, один показанный снимок нерезкий. Причина возврата: дополнить комплект и переснять нерезкий образец.',
      next: 'Отклонение сопровождается понятной причиной. Участник должен знать, что исправить.'
    },
    {
      name: 'Улица', photos: ['roadTree', 'cropped', 'normal3'],
      fields: [['Комплект', 'Дерево и 30 листьев'], ['Место и дата', 'Указаны'], ['Паспорт', 'Нет расстояния до дороги']],
      expected: 'reject', summary: 'Обрезан край снимка, нет расстояния до дороги.', note: 'У одного снимка обрезан край, в паспорте нет расстояния до дороги. Нужны полный снимок и заполненное поле.',
      next: 'Количество файлов само по себе не гарантирует пригодность заявки для анализа.'
    }
  ];
  const CATEGORY_LABELS = { normal: 'Нормальный', damaged: 'Повреждённый', asymmetric: 'Асимметричный' };
  const ORDER = ['road', 'leaves', 'moderator'];
  const TITLES = { road: 'Детектив у дороги', leaves: 'Сортировщик листьев', moderator: 'Модератор на час' };

  // Состояния игр отделены от DOM: повторы клика и переносы вне зоны не
  // увеличивают счёт. Эти же модели проверяются локальными тестами Node.
  class RoadGame {
    constructor() { this.counts = { road: 0, park: 0 }; this.passports = {}; this.active = null; this.samples = []; this.concluded = false; }
    get total() { return this.samples.length; }
    get complete() { return this.total === 10; }
    savePassport(site, fields) {
      if (!SITES[site]) return false;
      if (!Object.keys(SITES[site].fields).every(key => fields[key] === SITES[site].fields[key])) return false;
      this.passports[site] = { ...fields };
      return true;
    }
    pick(site) {
      if (!SITES[site] || this.active || this.counts[site] >= 5 || !this.passports[site]) return false;
      this.active = site;
      return true;
    }
    collect() {
      if (!this.active || this.complete) return false;
      const site = this.active;
      this.counts[site] += 1;
      this.samples.push({ id: site + '-' + this.counts[site], site, passport: { ...this.passports[site] } });
      this.active = null;
      return true;
    }
    conclude(value) {
      if (!this.complete || value !== 'more') return false;
      this.concluded = true;
      return true;
    }
  }
  class SortGame {
    constructor(random = Math.random) {
      this.leaves = LEAVES.slice();
      for (let i = this.leaves.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [this.leaves[i], this.leaves[j]] = [this.leaves[j], this.leaves[i]];
      }
      this.index = 0; this.resolved = false; this.errors = 0; this.currentErrors = 0; this.firstTry = 0;
      this.bins = { normal: 0, damaged: 0, asymmetric: 0 };
    }
    get current() { return this.leaves[this.index]; }
    get sorted() { return this.index + Number(this.resolved); }
    get complete() { return this.sorted === 9; }
    drop(category) {
      if (!this.current || this.resolved || !Object.hasOwn(CATEGORY_LABELS, category)) return null;
      if (category !== this.current.category) { this.errors += 1; this.currentErrors += 1; return false; }
      this.resolved = true; this.bins[category] += 1;
      if (!this.currentErrors) this.firstTry += 1;
      return true;
    }
    advance() {
      if (!this.resolved) return false;
      this.index += 1; this.resolved = false; this.currentErrors = 0;
      return true;
    }
  }
  class ModeratorGame {
    constructor() { this.index = 0; this.decisions = []; this.accepted = 0; this.rejected = 0; }
    get current() { return APPLICATIONS[this.index]; }
    get resolved() { return this.decisions.length > this.index; }
    get score() { return this.decisions.filter(item => item.correct).length; }
    decide(choice) {
      if (!this.current || this.resolved || !['approve', 'reject'].includes(choice)) return null;
      const entry = { index: this.index, choice, correct: choice === this.current.expected };
      this.decisions.push(entry);
      if (choice === 'approve') this.accepted += 1; else this.rejected += 1;
      return entry;
    }
    advance() { if (!this.resolved) return false; this.index += 1; return true; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { RoadGame, SortGame, ModeratorGame, ASSETS, SITES, LEAVES, APPLICATIONS };
  if (typeof document === 'undefined') return;

  const stage = document.getElementById('gameStage');
  if (!stage) return;
  const title = document.getElementById('sessionTitle');
  const label = document.getElementById('sessionLabel');
  const finishButton = document.getElementById('finishGame');
  const notice = document.getElementById('gameNotice');
  const missingAssets = new Set();
  const motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let currentGame = '';
  let model = null;
  let playAll = false;
  let selected = false;
  let editingSite = '';
  let passportDraft = {};
  let activePhoto = 0;
  let cancelDrag = null;
  let animationTimer = null;
  let suppressClickUntil = 0;
  let viewVersion = 0;
  let ended = false;

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function assetMarkup(key) {
    const asset = ASSETS[key];
    const placeholder = asset.icon ? asset.detail : '<span class="asset-label">Фото пока нет</span><span>' + escapeHTML(asset.detail) + '</span>';
    return '<span class="asset' + (asset.icon ? ' asset-icon' : '') + '" title="' + escapeHTML(asset.alt) + '">' +
      '<img hidden draggable="false" data-asset="' + escapeHTML(key) + '" alt="' + escapeHTML(asset.alt) + '">' +
      '<span class="asset-fallback"' + (asset.icon ? ' aria-hidden="true"' : '') + '>' + placeholder + '</span></span>';
  }
  function hydrateAssets() {
    stage.querySelectorAll('img[data-asset]').forEach(img => {
      const asset = ASSETS[img.dataset.asset];
      if (missingAssets.has(asset.path)) return;
      img.addEventListener('load', () => { img.hidden = false; img.parentElement.classList.add('asset-loaded'); }, { once: true });
      img.addEventListener('error', () => { missingAssets.add(asset.path); img.hidden = true; }, { once: true });
      img.src = asset.path;
    });
  }
  function message(text, tone = '') { notice.textContent = text; notice.dataset.tone = tone; }
  function show(markup, focus = false) {
    if (cancelDrag) cancelDrag();
    window.clearTimeout(animationTimer);
    viewVersion += 1;
    stage.innerHTML = markup;
    hydrateAssets();
    if (focus) title.focus({ preventScroll: true });
  }
  function focusElement(selector) {
    const node = stage.querySelector(selector);
    if (node) node.focus({ preventScroll: true });
  }
  function updateTitle() {
    title.textContent = TITLES[currentGame] || 'Экологический детектив';
    label.textContent = currentGame ? 'Учебный раунд · результаты не сохраняются' : 'Три мини-игры';
    finishButton.hidden = !currentGame || ended;
  }
  function lobby() {
    currentGame = ''; model = null; ended = false; selected = false; playAll = false;
    updateTitle();
    const descriptions = { road: 'Соберите образцы с двух деревьев и заполните паспорта.', leaves: 'Перенесите девять листьев в подходящие контейнеры.', moderator: 'Изучите фотографии и разложите три заявки по стопкам.' };
    show('<section class="lobby" aria-label="Выбор игры"><p>Сбор, сортировка и проверка данных. Без рейтинга.</p>' +
      '<div class="game-catalog">' + ORDER.map((game, index) => '<button class="game-choice" data-start="' + game + '" type="button">' +
        '<span class="choice-number">0' + (index + 1) + '</span><span class="choice-title">' + TITLES[game] + '</span>' +
        '<span class="choice-description">' + descriptions[game] + '</span><span class="choice-action">Играть</span></button>').join('') + '</div>' +
      '<div class="actions"><button class="button button-primary" type="button" data-action="start-all">Пройти все три</button></div>' +
      '<nav class="lobby-links" aria-label="О проекте"><a href="education.html">Инструкция</a><a href="account.html">Личный кабинет</a><a href="about.html">О проекте и авторе</a><a href="feedback.html">Обратная связь</a></nav></section>', true);
    message('На телефоне перетаскивайте пальцем. Без перетаскивания: выберите предмет, затем место назначения.');
  }
  function start(game, all = false) {
    if (!ORDER.includes(game)) return;
    currentGame = game; playAll = all; ended = false; selected = false; editingSite = ''; activePhoto = 0;
    model = game === 'road' ? new RoadGame() : game === 'leaves' ? new SortGame() : new ModeratorGame();
    updateTitle();
    if (game === 'road') renderRoad();
    if (game === 'leaves') renderSorter();
    if (game === 'moderator') renderModerator();
    title.focus({ preventScroll: true });
  }

  // Единое перетаскивание на Pointer Events поддерживает мышь, перо и касание.
  // Нет HTML Drag API, несовместимого с частью мобильных браузеров.
  function bindDrag(onDrop) {
    const item = stage.querySelector('[data-draggable]');
    if (!item || item.disabled) return;
    let pointer = null;
    function clearTargets() { stage.querySelectorAll('.drop-hover').forEach(node => node.classList.remove('drop-hover')); }
    function targetAt(x, y) {
      return Array.from(stage.querySelectorAll('[data-drop]:not(:disabled)')).find(node => {
        const rect = node.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      });
    }
    function reset() {
      if (!pointer) return;
      const id = pointer.id;
      pointer = null;
      clearTargets();
      item.classList.remove('dragging');
      item.classList.add('returning');
      item.style.removeProperty('transform');
      if (item.hasPointerCapture && item.hasPointerCapture(id)) item.releasePointerCapture(id);
    }
    cancelDrag = reset;
    item.addEventListener('pointerdown', event => {
      if (item.disabled || pointer || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      item.classList.remove('returning', 'arrived');
      item.focus({ preventScroll: true });
      item.setPointerCapture(event.pointerId);
    });
    item.addEventListener('pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.hypot(dx, dy) < 6 && !pointer.moved) return;
      pointer.moved = true;
      item.classList.add('dragging');
      item.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      clearTargets();
      const target = targetAt(event.clientX, event.clientY);
      if (target) target.classList.add('drop-hover');
      event.preventDefault();
    });
    item.addEventListener('pointerup', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const moved = pointer.moved;
      const target = targetAt(event.clientX, event.clientY);
      reset();
      if (!moved) return;
      suppressClickUntil = Date.now() + 250;
      if (target) onDrop(target.dataset.drop, target);
      else message('Образец вернулся на стол. Перенесите его внутрь контейнера.');
    });
    item.addEventListener('pointercancel', reset);
    item.addEventListener('lostpointercapture', reset);
  }
  function chooseItem(button) {
    selected = !selected;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    message(selected ? 'Образец выбран. Нажмите нужный контейнер.' : 'Выбор образца отменён.');
  }

  function renderRoad() {
    if (model.complete) { renderComparison(); return; }
    selected = false;
    const area = site => '<section class="map-area" aria-label="' + SITES[site].name + '"><p>' + SITES[site].description + '</p>' +
      '<button class="tree-button" type="button" data-tree="' + site + '"' + (model.counts[site] >= 5 ? ' disabled' : '') + '>' + assetMarkup(SITES[site].asset) +
      '<span class="tree-title">' + SITES[site].name + ' · ' + model.counts[site] + '/5</span></button><div class="tree-meta"><span>' +
      (model.passports[site] ? 'Паспорт готов' : 'Нет паспорта') + '</span><button type="button" class="passport-link" data-passport="' + site + '">Паспорт</button></div></section>';
    const token = model.active ? '<button class="leaf-token drag-item" type="button" data-draggable data-action="select-item" aria-pressed="false" aria-label="Выбрать лист ' + SITES[model.active].name.toLowerCase() + '">' +
      assetMarkup('normal1') + '<span>Лист ' + (model.counts[model.active] + 1) + '<br>' + SITES[model.active].name + '</span></button>' : '<p class="caption">Нажмите на дерево</p>';
    show('<section class="road-scene" aria-label="Сбор образцов"><div class="scene-toolbar"><p>Учебная схема города</p><p>Собрано ' + model.total + '/10</p></div>' +
      '<div class="map-board">' + area('road') + '<div class="map-road">Дорога</div>' + area('park') + '</div>' +
      '<div class="collection-dock"><div class="sample-bay">' + token + '</div><button type="button" class="drop-zone" data-drop="basket" aria-label="Положить выбранный лист в корзину">' +
      '<strong>Корзина · ' + model.total + '/10</strong><span>Дорога ' + model.counts.road + ' · парк ' + model.counts.park + '</span></button></div></section>');
    bindDrag(dropRoad);
    message(model.active ? 'Перенесите лист в корзину. Или выберите лист и нажмите корзину.' : 'Соберите по пять игровых листьев с каждого дерева. Паспорт сохраняет место сбора.');
  }
  function openPassport(site) {
    if (!SITES[site]) return;
    editingSite = site;
    passportDraft = { ...(model.passports[site] || {}) };
    const fields = [
      { key: 'territory', title: 'Тип территории', values: [['street', 'Улица'], ['park', 'Парк']] },
      { key: 'surface', title: 'Покрытие', values: [['asphalt', 'Асфальт'], ['soil', 'Почва']] },
      { key: 'distance', title: 'Расстояние до дороги', values: [['near', 'Близко'], ['far', 'Далеко']] }
    ];
    show('<section class="passport" aria-label="Паспорт места"><h2>' + SITES[site].name + '</h2><p class="caption">На схеме: ' + SITES[site].description.toLowerCase() + '.</p>' +
      fields.map(field => '<fieldset class="passport-field"><legend>' + field.title + '</legend><div class="passport-options">' +
        field.values.map(([value, name]) => '<button type="button" class="passport-option" data-field="' + field.key + '" data-value="' + value + '" aria-pressed="' + String(passportDraft[field.key] === value) + '">' +
          assetMarkup(value) + '<span>' + name + '</span></button>').join('') + '</div></fieldset>').join('') +
      '<div class="actions"><button class="button button-primary" type="button" data-action="save-passport">Сохранить паспорт</button>' +
      '<button class="button" type="button" data-action="back-map">К схеме</button></div></section>', true);
    message('Отметьте условия выбранного места. В реальной заявке расстояние записывают числом.');
  }
  function savePassport() {
    if (!model.savePassport(editingSite, passportDraft)) { message('Заполните три поля по условиям, указанным над паспортом.', 'error'); return; }
    if (!model.active) model.pick(editingSite);
    editingSite = '';
    renderRoad();
    focusElement('[data-draggable]');
  }
  function dropRoad(target) {
    if (target !== 'basket' || !model.collect()) { message('Сначала возьмите лист с дерева.'); return; }
    selected = false;
    renderRoad();
    if (!model.complete) {
      message('Лист в корзине. Место сбора сохранено. Нажмите на дерево для следующего образца.', 'success');
      focusElement('[data-tree]:not(:disabled)');
    } else title.focus({ preventScroll: true });
  }
  function renderComparison() {
    show('<section class="comparison"><h2>Два места, разные условия</h2><div class="comparison-grid">' +
      Object.keys(SITES).map(site => '<div><h3>' + SITES[site].name + '</h3><p>Собрано: ' + model.counts[site] + ' игровых листьев</p><p>' + SITES[site].description + '</p></div>').join('') +
      '</div><p>Сбор закончен, но ФА не измерена. Достаточно ли этих наблюдений, чтобы назвать дорогу причиной изменений?</p>' +
      '<div class="actions"><button class="button" type="button" data-conclusion="cause">Дорога влияет</button>' +
      '<button class="button button-primary" type="button" data-conclusion="more">Нужно больше данных</button></div><p class="caption">Это сравнение условий учебной схемы, а не экологические результаты Кингисеппа.</p></section>');
    message('Различия мест помогают поставить вопрос. Причину ещё нужно проверить.');
  }

  function renderSorter() {
    if (!model.current) { results(true); return; }
    selected = false;
    show('<section class="sorter-scene" aria-label="Сортировка листьев"><div class="scene-toolbar"><p>Образец ' + (model.index + 1) + '/9</p><p>С первого раза: ' + model.firstTry + '</p></div>' +
      '<div class="progress-track" role="progressbar" aria-label="Отсортировано листьев" aria-valuemin="0" aria-valuemax="9" aria-valuenow="' + model.sorted + '"><div class="progress-value" style="width:' + (model.sorted / 9 * 100) + '%"></div></div>' +
      '<div class="sorting-table"><button class="sorting-leaf drag-item" type="button" data-draggable data-action="select-item" aria-pressed="false" aria-label="Выбрать текущий лист">' +
      assetMarkup(model.current.asset) + '<span class="leaf-caption">Перетащите в контейнер</span></button></div>' +
      '<div class="sorting-zones">' + Object.keys(CATEGORY_LABELS).map(category => '<button class="drop-zone" type="button" data-drop="' + category + '"><strong>' +
        CATEGORY_LABELS[category] + '</strong><span>В контейнере: ' + model.bins[category] + '</span></button>').join('') + '</div>' +
      '<div class="sort-footer"><p>Категории учебные. Целый асимметричный лист тоже пригоден для промеров.</p><button class="button button-primary" data-action="next-leaf" type="button" hidden>Следующий лист</button></div></section>');
    bindDrag(dropSorter);
    message('Смотрите на целостность края и различие сторон. Ошибочный перенос можно исправить.');
  }
  function dropSorter(category, target) {
    const correct = model.drop(category);
    if (correct === null) return;
    stage.querySelectorAll('.drop-wrong').forEach(node => node.classList.remove('drop-wrong'));
    target = target || stage.querySelector('[data-drop="' + category + '"]');
    if (!correct) {
      if (target) target.classList.add('drop-wrong');
      message('Проверьте образец: ' + ASSETS[model.current.asset].detail + ' Попробуйте другой контейнер.', 'error');
      return;
    }
    target.classList.add('drop-correct');
    target.querySelector('span').textContent = 'В контейнере: ' + model.bins[category];
    const item = stage.querySelector('[data-draggable]');
    item.disabled = true; item.classList.remove('selected', 'returning');
    const sourceRect = item.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    item.classList.add('transferring');
    item.style.transform = 'translate(' + (targetRect.left + targetRect.width / 2 - sourceRect.left - sourceRect.width / 2) + 'px,' +
      (targetRect.top + targetRect.height / 2 - sourceRect.top - sourceRect.height / 2) + 'px) scale(.18)';
    const version = viewVersion;
    animationTimer = window.setTimeout(() => {
      if (version !== viewVersion) return;
      item.classList.add('deposited'); item.classList.remove('transferring'); item.style.removeProperty('transform');
    }, motion ? 0 : 160);
    item.querySelector('.leaf-caption').textContent = 'В контейнере «' + CATEGORY_LABELS[category] + '»';
    stage.querySelectorAll('[data-drop]').forEach(node => { node.disabled = true; });
    const track = stage.querySelector('[role="progressbar"]');
    track.setAttribute('aria-valuenow', String(model.sorted));
    track.firstElementChild.style.width = (model.sorted / 9 * 100) + '%';
    const next = stage.querySelector('[data-action="next-leaf"]');
    next.hidden = false; next.textContent = model.complete ? 'Результат' : 'Следующий лист';
    message(model.current.note, 'success');
    next.focus({ preventScroll: true });
  }

  function renderModerator() {
    if (!model.current) { results(true); return; }
    const application = model.current;
    show('<section class="moderator-scene" aria-label="Стол модератора"><div class="scene-toolbar"><p>Учебная заявка ' + (model.index + 1) + '/3</p><p>Решений без ошибки: ' + model.score + '</p></div>' +
      '<div class="moderation-stacks"><div class="paper-stack" id="acceptedStack"><span>Принятые</span><strong>' + model.accepted + '</strong></div><div class="paper-stack" id="rejectedStack"><span>Отклонённые</span><strong>' + model.rejected + '</strong></div></div>' +
      '<div class="application-desk"><article class="application-card" id="applicationCard"><h2>' + application.name + '</h2><div class="application-body">' +
      '<div class="application-photos">' + assetMarkup(application.photos[activePhoto]) + '<div class="photo-tabs" aria-label="Фотографии заявки">' +
      application.photos.map((asset, index) => '<button class="photo-tab" type="button" data-photo="' + index + '" aria-pressed="' + String(index === activePhoto) + '">' +
        assetMarkup(asset) + '<span>' + (index ? 'Лист ' + index : 'Дерево') + '</span></button>').join('') + '</div><p class="caption">Показаны дерево и два образца.</p></div>' +
      '<dl class="application-fields">' + application.fields.map(([key, value]) => '<div><dt>' + key + '</dt><dd>' + value + '</dd></div>').join('') + '</dl></div></article></div>' +
      '<div class="decision-actions"><button class="button button-primary" type="button" data-decision="approve">Одобрить</button>' +
      '<button class="button decision-reject" type="button" data-decision="reject">Отклонить</button></div></section>');
    message('Откройте фотографии под карточкой и проверьте комплектность. Все заявки в этой игре учебные.');
  }
  function decide(choice) {
    const entry = model.decide(choice);
    if (!entry) return;
    stage.querySelectorAll('[data-decision], [data-photo]').forEach(node => { node.disabled = true; });
    const card = document.getElementById('applicationCard');
    card.classList.add(choice === 'approve' ? 'to-accepted' : 'to-rejected');
    document.querySelector('#acceptedStack strong').textContent = model.accepted;
    document.querySelector('#rejectedStack strong').textContent = model.rejected;
    message(entry.correct ? 'Решение соответствует материалам заявки.' : 'Решение требует пересмотра. Ниже будет причина.', entry.correct ? 'success' : 'error');
    const version = viewVersion;
    animationTimer = window.setTimeout(() => {
      if (version !== viewVersion || ended) return;
      card.classList.remove('to-accepted', 'to-rejected');
      card.classList.add('reviewed');
      card.innerHTML = '<div class="review-message" data-correct="' + entry.correct + '"><h3>' + (entry.correct ? 'Решение обосновано' : 'Есть упущенный признак') + '</h3>' +
        '<p>' + model.current.note + '</p><p>' + model.current.next + '</p><div class="actions"><button class="button button-primary" type="button" data-action="next-application">' +
        (model.index === APPLICATIONS.length - 1 ? 'Результат' : 'Следующая заявка') + '</button></div></div>';
      focusElement('[data-action="next-application"]');
    }, motion ? 0 : 160);
  }

  function results(completed) {
    ended = true;
    updateTitle();
    let facts;
    let result;
    if (currentGame === 'road') {
      result = 'Собрано ' + model.total + ' из 10 игровых листьев.';
      facts = ['Паспорт связывает каждый образец с местом сбора.', 'Различие условий не доказывает влияние дороги: нужны измерения, повторы и сравнение.', 'В реальном проекте одна заявка включает дерево, его фотографию и 30 листьев.'];
    } else if (currentGame === 'leaves') {
      result = 'Разложено ' + model.sorted + '/9. С первого раза: ' + model.firstTry + '. Ошибочных переносов: ' + model.errors + '.';
      facts = ['Повреждение ткани и различие сторон — разные признаки.', 'Целые асимметричные листья не отбрасывают ради красивого результата.', 'На платформе пригодность материала проверяется по методике, а ФА рассчитывается по промерам.'];
    } else {
      result = 'Проверено ' + model.decisions.length + '/3. Обоснованных решений: ' + model.score + '.';
      facts = model.decisions.map(entry => {
        const application = APPLICATIONS[entry.index];
        return application.name + ': ' + (application.expected === 'approve' ? 'принимаем. ' : 'возвращаем. ') + application.summary;
      });
      if (!facts.length) facts.push('До решения нужно проверить паспорт, комплект и качество фотографий.');
    }
    const nextGame = ORDER[ORDER.indexOf(currentGame) + 1];
    show('<section class="result-scene" aria-label="Результат игры"><h2>' + (completed ? 'Раунд завершён' : 'Раунд остановлен') + '</h2><p>' + result + '</p>' +
      '<div class="result-facts">' + facts.map(fact => '<p>' + escapeHTML(fact) + '</p>').join('') + '</div>' +
      (currentGame === 'moderator' ? '<p class="caption">В проекте после человека следует автоматическая проверка. Игровое решение ничего не публикует и не выдаёт роль.</p>' : '') +
      '<div class="actions"><button class="button button-primary" type="button" data-action="replay">Играть снова</button>' +
      (playAll && nextGame ? '<button class="button" type="button" data-next-game="' + nextGame + '">Следующая игра</button>' : '') +
      '<button class="button" type="button" data-action="lobby">К выбору игр</button><a class="button" href="education.html">К реальному проекту</a></div></section>', true);
    message('Результат относится только к этому раунду. Обучение, сертификаты и настоящие заявки не изменены.');
  }

  // Делегирование кликов не создаёт повторных обработчиков при смене экранов.
  stage.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) return;
    const button = event.target.closest('button');
    if (!button || button.disabled || !stage.contains(button)) return;
    if (button.dataset.start) { start(button.dataset.start); return; }
    if (button.dataset.nextGame) { start(button.dataset.nextGame, true); return; }
    const action = button.dataset.action;
    if (action === 'start-all') { start(ORDER[0], true); return; }
    if (action === 'lobby') { lobby(); return; }
    if (action === 'replay') { start(currentGame, playAll); return; }
    if (!model || ended) return;
    if (action === 'select-item') { chooseItem(button); return; }
    if (button.dataset.drop) {
      if (!selected) { message('Сначала выберите лист или перетащите его в контейнер.'); return; }
      if (currentGame === 'road') dropRoad(button.dataset.drop);
      if (currentGame === 'leaves') dropSorter(button.dataset.drop, button);
      return;
    }
    if (currentGame === 'road') {
      if (button.dataset.tree) {
        const site = button.dataset.tree;
        if (model.active) { message('Сначала положите уже взятый лист в корзину.'); return; }
        if (!model.passports[site]) { openPassport(site); return; }
        if (model.pick(site)) { renderRoad(); focusElement('[data-draggable]'); }
      }
      if (button.dataset.passport) openPassport(button.dataset.passport);
      if (button.dataset.field) {
        passportDraft[button.dataset.field] = button.dataset.value;
        stage.querySelectorAll('[data-field="' + button.dataset.field + '"]').forEach(node => node.setAttribute('aria-pressed', String(node === button)));
      }
      if (action === 'save-passport') savePassport();
      if (action === 'back-map') { editingSite = ''; renderRoad(); focusElement('[data-tree]:not(:disabled)'); }
      if (button.dataset.conclusion) {
        if (model.conclude(button.dataset.conclusion)) results(true);
        else message('Сбор не доказывает причину. ФА ещё не измерена; различаются также покрытие и другие условия.', 'error');
      }
    }
    if (currentGame === 'leaves' && action === 'next-leaf' && model.advance()) { renderSorter(); focusElement('[data-draggable]'); }
    if (currentGame === 'moderator') {
      if (button.dataset.photo !== undefined && !model.resolved) {
        activePhoto = Number(button.dataset.photo); renderModerator(); focusElement('[data-photo="' + activePhoto + '"]');
      }
      if (button.dataset.decision) decide(button.dataset.decision);
      if (action === 'next-application' && model.advance()) { activePhoto = 0; renderModerator(); title.focus({ preventScroll: true }); }
    }
  });
  finishButton.addEventListener('click', () => {
    if (!model || ended) return;
    const completed = currentGame === 'road' ? model.concluded : currentGame === 'leaves' ? model.complete : model.decisions.length === 3;
    results(completed);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (cancelDrag) cancelDrag();
    selected = false;
    const item = stage.querySelector('[data-draggable]');
    if (item) { item.classList.remove('selected'); item.setAttribute('aria-pressed', 'false'); }
  });
  window.addEventListener('resize', () => { if (cancelDrag) cancelDrag(); });

  // Только выбор темы сохраняется локально; блокировка хранилища не мешает игре.
  const themeToggle = document.getElementById('themeToggle');
  function theme(dark, persist = false) {
    document.documentElement.classList.toggle('dark', dark);
    themeToggle.textContent = dark ? 'Светлая тема' : 'Тёмная тема';
    themeToggle.setAttribute('aria-label', 'Тёмная тема');
    themeToggle.setAttribute('aria-pressed', String(dark));
    if (persist) { try { localStorage.setItem('eco-theme', dark ? 'dark' : 'light'); } catch (_) { /* Игра работает и без localStorage. */ } }
  }
  let savedTheme = '';
  try { savedTheme = localStorage.getItem('eco-theme'); } catch (_) { /* Ограниченный режим браузера. */ }
  theme(savedTheme === 'dark' || (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
  themeToggle.addEventListener('click', () => theme(!document.documentElement.classList.contains('dark'), true));
  lobby();
})();
