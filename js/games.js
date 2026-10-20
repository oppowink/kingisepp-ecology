(function () {
  'use strict';

  const ASSETS = {
    roadTree: { path: 'img/games/tree-street.jpg', alt: 'Берёза у дороги, игровая фотография', detail: 'Берёза у дороги.' },
    parkTree: { path: 'img/games/tree-park.jpg', alt: 'Берёза в зелёной зоне Кингисеппа, игровая версия снимка', detail: 'Берёза в зелёной зоне.' },
    treePreview: { path: 'img/games/tree-road-cutout.png', alt: 'Берёза', detail: 'Берёза.' },
    normal1: { path: 'img/games/normal1-cutout.webp', leaf: true, alt: 'Первый целый лист берёзы', detail: 'Край листа целый и различим.' },
    normal2: { path: 'img/games/normal2-cutout.webp', leaf: true, alt: 'Второй целый лист берёзы', detail: 'Жилки и контур видны.' },
    normal3: { path: 'img/games/normal3-cutout.webp', leaf: true, alt: 'Третий целый лист берёзы', detail: 'Пластинка расправлена.' },
    damaged1: { path: 'img/games/damaged1-cutout.webp', leaf: true, alt: 'Лист берёзы с отмершим краем', detail: 'Край повреждён и изменил форму.' },
    damaged2: { path: 'img/games/damaged2-cutout.webp', leaf: true, alt: 'Лист берёзы с утратой ткани', detail: 'По такому краю нельзя восстановить исходную форму.' },
    damaged3: { path: 'img/games/damaged3-cutout.webp', leaf: true, alt: 'Третий повреждённый лист берёзы', detail: 'Заметны обширные повреждения.' },
    other1: { path: 'img/games/other1-cutout.webp', leaf: true, alt: 'Неберёзовый узкий лист', detail: 'Форма и край не подходят под берёзу повислую.' },
    other2: { path: 'img/games/other2-cutout.webp', leaf: true, alt: 'Неберёзовый ярко-зелёный лист', detail: 'Это лист другого растения.' },
    other3: { path: 'img/games/other3-cutout.webp', leaf: true, alt: 'Крупный кленовый лист', detail: 'Лист клёна, а не берёзы.' },
    goodPhoto: { path: 'img/games/leaf-good-angle-cutout.webp', leaf: true, alt: 'Лист на удачном учебном снимке', detail: 'Виден весь контур листа.' },
    normalPhoto: { path: 'img/games/normal2-cutout.webp', leaf: true, alt: 'Целый лист берёзы', detail: 'Контур листа сохранён полностью.' },
    blurred: { path: 'img/games/leaf-sideways-cutout.webp', alt: 'Исходный снимок листа под неудобным углом', detail: 'Положение листа на снимке не подходит для разметки.' },
    cropped: { path: 'img/games/leaf-damaged-cutout.webp', alt: 'Сильно повреждённый лист на фоне съёмки', detail: 'Повреждение искажает контур.' },
    containerNormal: { path: 'img/games/container-cutout.png', alt: 'Пластиковый контейнер для подходящих листьев', detail: 'Контейнер для подходящих листьев.' },
    containerDamaged: { path: 'img/games/container-cutout.png', alt: 'Пластиковый контейнер для повреждённых листьев', detail: 'Контейнер для повреждённых листьев.' },
    containerOther: { path: 'img/games/container-cutout.png', alt: 'Пластиковый контейнер для листьев другого вида', detail: 'Контейнер для другого вида.' },
    street: { path: '', alt: 'Улица', detail: 'улица', icon: true }, park: { path: '', alt: 'Парк', detail: 'парк', icon: true },
    asphalt: { path: '', alt: 'Асфальт', detail: 'асфальт', icon: true }, soil: { path: '', alt: 'Почва', detail: 'почва', icon: true },
    near: { path: '', alt: 'Близко к дороге', detail: 'близко', icon: true }, far: { path: '', alt: 'Далеко от дороги', detail: 'далеко', icon: true }
  };
  const SITES = {
    road: { name: 'У дороги', asset: 'roadTree', description: 'Улица · асфальт · близко к дороге', fields: { territory: 'street', surface: 'asphalt', distance: 'near' } },
    park: { name: 'В парке', asset: 'parkTree', description: 'Парк · почва · далеко от дороги', fields: { territory: 'park', surface: 'soil', distance: 'far' } }
  };
  const LEAVES = [
    { asset: 'normal1', category: 'normal', note: 'Целый контур позволяет выполнить промеры. Небольшая естественная неровность допустима.' },
    { asset: 'damaged1', category: 'damaged', note: 'Утраченная ткань, повреждение, а не различие сторон при развитии листа.' },
    { asset: 'other1', category: 'other', note: 'Сначала проверьте вид: перед вами лист другого растения.' },
    { asset: 'normal2', category: 'normal', note: 'Материал целый. Отбирать только идеально симметричные листья нельзя.' },
    { asset: 'damaged2', category: 'damaged', note: 'Разрыв мешает восстановить исходную форму. Этот образец отмечают отдельно.' },
    { asset: 'other2', category: 'other', note: 'Это другой вид растения. Его не используют в расчёте ФА берёзы.' },
    { asset: 'normal3', category: 'normal', note: 'Контур виден полностью. Пригодность снимка не означает нулевую асимметрию.' },
    { asset: 'damaged3', category: 'damaged', note: 'Отверстия относятся к повреждениям. Их нельзя подменять значением ФА.' },
    { asset: 'other3', category: 'other', note: 'Клён отличается формой пластинки. Проверьте вид до разметки.' }
  ];
  const APPLICATIONS = [
    {
      name: 'Парк', photos: ['parkTree', 'goodPhoto', 'normalPhoto'],
      fields: [['Комплект', '2 дерева, по 12 листьев'], ['Место и дата', 'Указаны'], ['Паспорт', 'Заполнен']],
      expected: 'approve', summary: 'Полный комплект, заполненный паспорт и целые контуры.', note: 'Комплект полный, паспорт заполнен, контуры видны. Целый асимметричный лист не повод отклонять заявку.',
      next: 'После решения модератора программа считает ФА по проверенным точкам. Модератор ещё раз смотрит результат.'
    },
    {
      name: 'Сквер', photos: ['parkTree', 'blurred', 'normalPhoto'],
      fields: [['Комплект', '2 дерева, 12 и 8 листьев'], ['Место и дата', 'Указаны'], ['Паспорт', 'Заполнен']],
      expected: 'reject', summary: 'На втором дереве только 8 листьев; один снимок под углом.', note: 'На втором дереве меньше 10 листьев и один снимок не подходит для разметки. Нужно дополнить набор и переснять.',
      next: 'Отклонение сопровождается понятной причиной. Участник должен знать, что исправить.'
    },
    {
      name: 'Улица', photos: ['roadTree', 'cropped', 'goodPhoto'],
      fields: [['Комплект', '3 дерева, по 10 листьев'], ['Место и дата', 'Указаны'], ['Паспорт', 'Нет расстояния до дороги']],
      expected: 'reject', summary: 'Лист сильно повреждён, нет расстояния до дороги.', note: 'Один лист сильно повреждён, а в паспорте нет расстояния до дороги. Нужны подходящий образец и заполненное поле.',
      next: 'Количество файлов само по себе не гарантирует пригодность заявки для анализа.'
    }
  ];
  const CATEGORY_LABELS = { normal: 'Берёза, целый', damaged: 'Берёза, повреждённый', other: 'Другой вид' };
  const CATEGORY_ASSETS = { normal: 'containerNormal', damaged: 'containerDamaged', other: 'containerOther' };
  const ORDER = ['road', 'leaves', 'moderator'];
  const TITLES = { road: 'Детектив у дороги', leaves: 'Сортировщик листьев', moderator: 'Модератор на час' };
  const GAME_PREVIEWS = { road: 'treePreview', leaves: 'containerNormal', moderator: 'goodPhoto' };

  class GameProgress {
    constructor(storage) {
      this.storage = storage;
      this.completed = new Set();
      try {
        const saved = JSON.parse(storage.getItem('eco-games-completed-v1') || '[]');
        if (Array.isArray(saved)) saved.forEach(game => { if (ORDER.includes(game)) this.completed.add(game); });
      } catch (_) {}
    }
    mark(game) {
      if (!ORDER.includes(game)) return;
      this.completed.add(game);
      try { this.storage.setItem('eco-games-completed-v1', JSON.stringify(Array.from(this.completed))); } catch (_) {}
    }
    has(game) { return this.completed.has(game); }
  }

  class RoadGame {
    constructor() { this.counts = { road: 0, park: 0 }; this.waiting = { road: 0, park: 0 }; this.passports = {}; this.active = null; this.samples = []; this.concluded = false; }
    get total() { return this.samples.length; }
    get complete() { return this.total === 10; }
    savePassport(site, fields) {
      if (!SITES[site]) return false;
      if (!Object.keys(SITES[site].fields).every(key => fields[key] === SITES[site].fields[key])) return false;
      this.passports[site] = { ...fields };
      return true;
    }
    pick(site) {
      if (!SITES[site] || this.counts[site] + this.waiting[site] >= 5 || !this.passports[site]) return false;
      this.waiting[site] += 1;
      if (!this.active) this.active = site;
      return true;
    }
    collect() {
      if (!this.active || !this.waiting[this.active] || this.complete) return false;
      const site = this.active;
      this.counts[site] += 1;
      this.samples.push({ id: site + '-' + this.counts[site], site, passport: { ...this.passports[site] } });
      this.waiting[site] -= 1;
      this.active = this.waiting.road ? 'road' : this.waiting.park ? 'park' : null;
      return true;
    }
    selectSample(site) {
      if (!SITES[site] || !this.waiting[site]) return false;
      this.active = site;
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
      this.bins = { normal: 0, damaged: 0, other: 0 };
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
  if (typeof module !== 'undefined' && module.exports) module.exports = { RoadGame, SortGame, ModeratorGame, GameProgress, ASSETS, SITES, LEAVES, APPLICATIONS };
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
  let selected = false;
  let editingSite = '';
  let passportDraft = {};
  let activePhoto = 0;
  let cancelDrag = null;
  let animationTimer = null;
  let suppressClickUntil = 0;
  let viewVersion = 0;
  let ended = false;
  let storage = null;
  try { storage = window.localStorage; } catch (_) {}
  const progress = new GameProgress(storage);

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function assetMarkup(key) {
    const asset = ASSETS[key];
    const placeholder = asset.icon ? asset.detail : '<span>' + escapeHTML(asset.detail) + '</span>';
    return '<span class="asset' + (asset.icon ? ' asset-icon' : '') + (asset.leaf ? ' asset-leaf asset-leaf--' + key : '') + '" title="' + escapeHTML(asset.alt) + '">' +
      '<img hidden draggable="false" data-asset="' + escapeHTML(key) + '" alt="' + escapeHTML(asset.alt) + '">' +
      '<span class="asset-fallback"' + (asset.icon ? ' aria-hidden="true"' : '') + '>' + placeholder + '</span></span>';
  }
  function preloadAssets() {
    Object.values(GAME_PREVIEWS).map(key => ASSETS[key]).forEach(asset => {
      if (!asset.path) return;
      const image = new Image();
      image.decoding = 'async';
      image.src = asset.path;
    });
  }
  function hydrateAssets(root = stage) {
    root.querySelectorAll('img[data-asset]:not([src])').forEach(img => {
      const asset = ASSETS[img.dataset.asset];
      if (!asset.path || missingAssets.has(asset.path)) return;
      img.addEventListener('load', () => { img.hidden = false; img.parentElement.classList.add('asset-loaded'); }, { once: true });
      img.addEventListener('error', () => { missingAssets.add(asset.path); img.hidden = true; }, { once: true });
      img.src = asset.path;
    });
  }
  function message(text, tone = '') { notice.textContent = text; notice.dataset.tone = tone; }
  function show(markup, focus = false) {
    if (cancelDrag) cancelDrag();
    cancelDrag = null;
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
    title.textContent = TITLES[currentGame] || 'Игры';
    if (label) {
      label.classList.add('game-intro');
      label.hidden = ended;
      label.textContent = !currentGame ? 'От сбора листьев до проверки заявки.' : currentGame === 'road' ?
        'Изучите условия точек, где растут деревья, и заполните паспорта для заявок. Затем соберите листья в контейнер.' +
        (model && Object.keys(model.passports).length ? ' Собирайте по методике: с разной доступной высоты и из разных частей кроны.' : '') :
        currentGame === 'leaves' ? 'После сбора листья нужно перепроверить. Отделите целые листья берёзы от повреждённых и листьев других видов.' :
        'Представьте, что вы модератор: проверьте паспорт и фотографии каждой учебной заявки. Решите, какие заявки принять, а какие вернуть на исправление.';
    }
    finishButton.hidden = !currentGame || ended;
  }
  function lobby() {
    currentGame = ''; model = null; ended = false; selected = false;
    updateTitle();
    const descriptions = { road: 'Заполните паспорта двух точек и соберите листья.', leaves: 'Проверьте листья перед измерениями.', moderator: 'Разберите три учебные заявки.' };
    show('<section class="lobby" aria-label="Выбор игры">' +
      '<div class="game-catalog">' + ORDER.map(game => '<button class="game-choice' + (progress.has(game) ? ' game-choice--completed' : '') + '" data-start="' + game + '" type="button">' +
        '<span class="choice-media">' + assetMarkup(GAME_PREVIEWS[game]) + '</span><span class="choice-copy"><span class="choice-title">' + TITLES[game] + '</span>' +
        '<span class="choice-description">' + descriptions[game] + '</span><span class="choice-action">' + (progress.has(game) ? 'Ещё раз' : 'Играть') + '</span>' +
        (progress.has(game) ? '<span class="choice-status">Пройдено</span>' : '') + '</span></button>').join('') + '</div>' +
      '</section>', true);
    message('На телефоне перетаскивайте пальцем. Без перетаскивания: выберите предмет, затем место назначения.');
  }
  function start(game) {
    if (!ORDER.includes(game)) return;
    currentGame = game; ended = false; selected = false; editingSite = ''; activePhoto = 0;
    model = game === 'road' ? new RoadGame() : game === 'leaves' ? new SortGame() : new ModeratorGame();
    updateTitle();
    if (game === 'road') renderRoad();
    if (game === 'leaves') renderSorter();
    if (game === 'moderator') renderModerator();
    title.focus({ preventScroll: true });
  }

  function bindDrag(onDrop) {
    const resets = [];
    let activePointer = null;
    stage.querySelectorAll('[data-draggable]').forEach(item => {
      if (item.disabled) return;
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
        pointer = null; activePointer = null;
        clearTargets();
        item.classList.remove('dragging');
        item.classList.add('returning');
        item.style.removeProperty('transform');
        if (item.hasPointerCapture && item.hasPointerCapture(id)) item.releasePointerCapture(id);
      }
      resets.push(reset);
      item.addEventListener('pointerdown', event => {
        if (item.disabled || activePointer !== null || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
        if (currentGame === 'road' && !model.selectSample(item.dataset.sampleSite)) return;
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        activePointer = event.pointerId;
        item.classList.remove('returning', 'arrived');
        item.focus({ preventScroll: true });
        item.setPointerCapture(event.pointerId);
      });
      item.addEventListener('pointermove', event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
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
        const moved = pointer.moved, target = targetAt(event.clientX, event.clientY);
        reset();
        if (!moved) return;
        suppressClickUntil = Date.now() + 250;
        if (target) onDrop(target.dataset.drop, target, item);
        else message('Лист вернулся на место. Перенесите его в контейнер.');
      });
      item.addEventListener('pointercancel', reset);
      item.addEventListener('lostpointercapture', reset);
    });
    cancelDrag = () => resets.forEach(reset => reset());
  }
  function chooseItem(button) {
    if (currentGame === 'road' && !model.selectSample(button.dataset.sampleSite)) return;
    const wasSelected = button.getAttribute('aria-pressed') === 'true';
    stage.querySelectorAll('[data-draggable]').forEach(node => {
      node.classList.remove('selected');
      node.setAttribute('aria-pressed', 'false');
    });
    selected = !wasSelected;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    message(selected ? 'Лист выбран. Нажмите нужный контейнер.' : 'Выбор листа отменён.');
  }

  function pendingLeaves() {
    return Object.keys(SITES).map(site => Array.from({ length: model.waiting[site] }, (_, index) =>
      '<button class="leaf-token drag-item" type="button" data-draggable data-action="select-item" data-sample-site="' + site +
      '" aria-pressed="false" aria-label="Выбрать лист ' + (model.counts[site] + index + 1) + ': ' + SITES[site].name.toLowerCase() + '">' +
      assetMarkup('normal1') + '<span>' + SITES[site].name + '</span></button>').join('')).join('') ||
      '<p class="caption">' + (model.complete ? 'Все листья в контейнере.' : 'Нажимайте на берёзу: листья появятся здесь.') + '</p>';
  }
  function updateRoadCollection() {
    if (cancelDrag) cancelDrag();
    selected = false;
    const tray = stage.querySelector('.sample-bay');
    tray.innerHTML = pendingLeaves();
    hydrateAssets(tray);
    Object.keys(SITES).forEach(site => {
      stage.querySelector('[data-tree="' + site + '"]').disabled = model.counts[site] + model.waiting[site] >= 5;
      stage.querySelector('[data-tree-count="' + site + '"]').textContent = 'Снято ' + (model.counts[site] + model.waiting[site]) + ' из 5';
    });
    stage.querySelector('[data-collected-total]').textContent = 'В контейнере: ' + model.total + ' из 10';
    stage.querySelector('[data-collected-sites]').textContent = 'У дороги: ' + model.counts.road + ' · в парке: ' + model.counts.park;
    stage.querySelector('.container-fill').innerHTML = model.samples.map((sample, index) =>
      '<img src="img/leaf1.png" alt="" style="--leaf-x:' + (index % 5 * 17) + '%;--leaf-y:' + (Math.floor(index / 5) * 16) + 'px' + ';--leaf-turn:' + (index % 2 ? 18 : -16) + 'deg">').join('');
    stage.querySelector('[data-action="compare-sites"]').hidden = !model.complete;
    stage.querySelector('.collection-dock').classList.toggle('collection-dock--complete', model.complete);
    bindDrag(dropRoad);
  }
  function fallingLeaf(source) {
    if (motion) return;
    const leaf = document.createElement('img');
    leaf.className = 'falling-leaf'; leaf.src = 'img/leaf1.png'; leaf.alt = '';
    leaf.width = 32; leaf.height = 42; leaf.setAttribute('aria-hidden', 'true');
    leaf.style.left = (25 + Math.random() * 45) + '%';
    leaf.style.top = (14 + Math.random() * 28) + '%';
    leaf.style.setProperty('--fall-x', (-45 + Math.random() * 90) + 'px');
    leaf.style.setProperty('--fall-turn', (-80 + Math.random() * 160) + 'deg');
    leaf.addEventListener('animationend', () => leaf.remove(), { once: true });
    source.appendChild(leaf);
  }
  function renderRoad() {
    updateTitle();
    const unlocked = Object.keys(model.passports).length > 0;
    const area = site => '<section class="map-area" aria-label="' + SITES[site].name + '"><h2>' + SITES[site].name + '</h2>' +
      '<ul class="site-facts">' + SITES[site].description.split(' · ').map(fact => '<li>' + fact + '</li>').join('') + '</ul>' +
      '<button class="tree-button" type="button" data-tree="' + site + '">' + assetMarkup(SITES[site].asset) +
      '<span class="tree-title" data-tree-count="' + site + '"></span></button><div class="tree-meta"><span>' +
      (model.passports[site] ? 'Паспорт заполнен' : 'Сначала заполните паспорт') + '</span><button type="button" class="passport-link" data-passport="' + site + '">Паспорт точки</button></div></section>';
    show('<section class="road-scene" aria-label="Сбор листьев"><div class="map-board">' + area('road') + area('park') + '</div>' +
      '<div class="collection-dock"' + (unlocked ? '' : ' hidden') + '><h2>Сбор листьев</h2><p class="collection-method">Нажмите на дерево несколько раз. Соберите по 5 игровых листьев с каждой берёзы и перенесите их в контейнер.</p>' +
      '<div class="sample-bay" aria-label="Листья для переноса"></div><button type="button" class="drop-zone collection-container" data-drop="basket" aria-label="Положить выбранный лист в контейнер">' +
      '<span class="container-picture">' + assetMarkup('containerNormal') + '<span class="container-fill" aria-hidden="true"></span></span>' +
      '<strong data-collected-total></strong><span data-collected-sites></span></button>' +
      '<p class="caption">В игре — 5 листьев с каждого дерева. В полевой работе — от 10 до 30.</p>' +
      '<button class="button button-primary" type="button" data-action="compare-sites" hidden>Набор готов — сравнить точки</button></div></section>');
    updateRoadCollection();
    message(unlocked ? 'Можно собрать несколько листьев подряд. Затем перетащите каждый в контейнер или выберите лист и нажмите контейнер.' : 'Откройте паспорт точки, сравните условия с фотографией и заполните три поля.');
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
          '<span>' + name + '</span></button>').join('') + '</div></fieldset>').join('') +
      '<div class="actions"><button class="button button-primary" type="button" data-action="save-passport">Сохранить паспорт</button>' +
      '<button class="button" type="button" data-action="back-map">К схеме</button></div></section>', true);
    message('Отметьте условия выбранного места. В реальной заявке расстояние записывают числом.');
  }
  function savePassport() {
    const fieldNames = { territory: 'тип территории', surface: 'покрытие', distance: 'расстояние до дороги' };
    const missing = Object.keys(fieldNames).filter(key => !passportDraft[key]);
    if (missing.length) { message('Не выбрано: ' + missing.map(key => fieldNames[key]).join(', ') + '.', 'error'); return; }
    const wrong = Object.keys(fieldNames).filter(key => passportDraft[key] !== SITES[editingSite].fields[key]);
    if (wrong.length) { message('Все поля заполнены, но со сценой не совпадает: ' + wrong.map(key => fieldNames[key]).join(', ') + '. Сверьтесь с фотографией и подписью.', 'error'); return; }
    if (!model.savePassport(editingSite, passportDraft)) { message('Паспорт не удалось сохранить. Откройте его ещё раз.', 'error'); return; }

    const site = editingSite;
    editingSite = '';
    renderRoad();
    focusElement('[data-tree="' + site + '"]');
  }
  function dropRoad(target) {
    if (target !== 'basket' || !model.collect()) { message('Сначала выберите лист с дерева.'); return; }
    updateRoadCollection();
    message(model.complete ? 'Все 10 листьев в контейнере. Теперь можно сравнить две точки.' : 'Лист в контейнере. Его место сбора сохранено.', 'success');
    focusElement(model.complete ? '[data-action="compare-sites"]' : '[data-draggable], [data-tree]:not(:disabled)');
  }
  function renderComparison() {
    show('<section class="comparison"><h2>Два места, разные условия</h2><div class="comparison-grid">' +
      Object.keys(SITES).map(site => '<div>' + assetMarkup(SITES[site].asset) + '<h3>' + SITES[site].name + '</h3><strong>' + model.counts[site] + ' листьев</strong><p>' + SITES[site].description + '</p></div>').join('') +
      '</div><p>Сбор закончен, но ФА не измерена. Достаточно ли этих наблюдений, чтобы назвать дорогу причиной изменений?</p>' +
      '<div class="actions"><button class="button" type="button" data-conclusion="cause">Дорога влияет</button>' +
      '<button class="button button-primary" type="button" data-conclusion="more">Нужно больше данных</button></div><p class="caption">Это сравнение условий учебной схемы, а не экологические результаты Кингисеппа.</p></section>');
    message('Различия мест помогают поставить вопрос. Причину ещё нужно проверить.');
  }

  function renderSorter() {
    if (!model.current) { results(true); return; }
    selected = false;
    show('<section class="sorter-scene" aria-label="Сортировка листьев">' +
      '<div class="progress-track" role="progressbar" aria-label="Отсортировано листьев" aria-valuemin="0" aria-valuemax="9" aria-valuenow="' + model.sorted + '"><div class="progress-value" style="width:' + (model.sorted / 9 * 100) + '%"></div></div>' +
      '<p class="sort-count" aria-hidden="true">Проверено <strong data-sorted-count>' + model.sorted + '</strong> из 9</p><div class="sorting-table"><button class="sorting-leaf drag-item" type="button" data-draggable data-action="select-item" aria-pressed="false" aria-label="Выбрать текущий лист">' +
      assetMarkup(model.current.asset) + '</button></div>' +
      '<div class="sorting-zones">' + Object.keys(CATEGORY_LABELS).map(category => '<button class="drop-zone specimen-bin" type="button" data-drop="' + category + '" aria-label="' + CATEGORY_LABELS[category] + ', в контейнере ' + model.bins[category] + '">' +
        assetMarkup(CATEGORY_ASSETS[category]) + '<strong class="specimen-bin__label">' + CATEGORY_LABELS[category] + '</strong><span class="bin-count" data-bin-count="' + category + '">Листьев: ' + model.bins[category] + '</span></button>').join('') + '</div>' +
      '<div class="sort-footer"><button class="button button-primary" data-action="next-leaf" type="button" hidden>Следующий лист</button></div></section>');
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
    target.querySelector('[data-bin-count]').textContent = 'Листьев: ' + model.bins[category];
    stage.querySelector('[data-sorted-count]').textContent = model.sorted;
    target.setAttribute('aria-label', CATEGORY_LABELS[category] + ', в контейнере ' + model.bins[category]);
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
    show('<section class="moderator-scene" aria-label="Стол модератора">' +
      '<div class="moderation-stacks"><div class="paper-stack" id="acceptedStack"><span>Принятые</span><strong>' + model.accepted + '</strong></div><div class="paper-stack" id="rejectedStack"><span>Отклонённые</span><strong>' + model.rejected + '</strong></div></div>' +
      '<div class="application-desk"><article class="application-card" id="applicationCard"><h2>' + application.name + '</h2><div class="application-body">' +
      '<div class="application-photos">' + assetMarkup(application.photos[activePhoto]) + '<div class="photo-tabs" aria-label="Фотографии заявки">' +
      application.photos.map((asset, index) => '<button class="photo-tab" type="button" data-photo="' + index + '" aria-label="' + (index ? 'Открыть фотографию листа ' + index : 'Открыть фотографию дерева') + '" aria-pressed="' + String(index === activePhoto) + '">' +
        assetMarkup(asset) + '</button>').join('') + '</div></div>' +
      '<dl class="application-fields">' + application.fields.map(([key, value]) => '<div><dt>' + key + '</dt><dd>' + value + '</dd></div>').join('') + '</dl></div></article></div>' +
      '<div class="decision-actions"><button class="button decision-button decision-approve" type="button" data-decision="approve">Одобрить</button>' +
      '<button class="button decision-button decision-reject" type="button" data-decision="reject">Отклонить</button></div></section>');
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
    if (completed) progress.mark(currentGame);
    updateTitle();
    let facts, metrics, heading;
    if (currentGame === 'road') {
      heading = 'Листья собраны';
      metrics = [[model.total + '/10', 'листьев в контейнере'], [model.counts.road, 'у дороги'], [model.counts.park, 'в парке']];
      facts = ['Паспорт связывает каждый лист с местом сбора.', 'Разные условия дают повод для исследования. Влияние дороги ещё нужно проверить измерениями.', 'В полевой заявке — от 2 до 5 деревьев и от 10 до 30 фотографий листьев с каждого.'];
    } else if (currentGame === 'leaves') {
      heading = 'Листья проверены';
      metrics = [[model.sorted + '/9', 'листьев распределено'], [model.firstTry, 'верно без исправлений'], [model.errors, 'ошибочных переносов']];
      facts = ['Повреждённые листья берёзы и листья других видов не используют для измерения ФА берёзы.', 'Целые асимметричные листья сохраняют. Отбор только симметричных листьев исказит результат.', 'Материал перепроверяют до разметки и расчёта ФА.'];
    } else {
      heading = 'Заявки разобраны';
      metrics = [[model.decisions.length + '/3', 'заявок проверено'], [model.score, 'решений по методике'], [model.decisions.length - model.score, 'решений стоит пересмотреть']];
      facts = model.decisions.map(entry => {
        const application = APPLICATIONS[entry.index];
        return application.name + ': ' + (application.expected === 'approve' ? 'принимаем. ' : 'возвращаем на исправление. ') + application.summary;
      });
      if (!facts.length) facts.push('До решения проверьте паспорт, комплект и качество фотографий.');
    }
    const nextGame = ORDER[ORDER.indexOf(currentGame) + 1];
    show('<section class="result-scene" aria-label="Итоги игры"><div class="result-board"><img src="img/leaf1.png" width="62" height="81" alt="" aria-hidden="true">' +
      '<div><p class="result-state">' + (completed ? 'Пройдено' : 'Раунд завершён') + '</p><h2>' + (completed ? heading : 'Можно попробовать ещё раз') + '</h2></div></div>' +
      '<div class="result-metrics">' + metrics.map(([value, name]) => '<div><strong>' + value + '</strong><span>' + name + '</span></div>').join('') + '</div>' +
      '<div class="result-facts">' + facts.map(fact => '<p>' + escapeHTML(fact) + '</p>').join('') + '</div>' +
      '<div class="actions"><button class="button button-primary" type="button" data-action="replay">Ещё раз</button>' +
      (completed && nextGame ? '<button class="button" type="button" data-next-game="' + nextGame + '">Дальше: ' + TITLES[nextGame] + '</button>' : '') +
      '<button class="button" type="button" data-action="lobby">К играм</button></div></section>', true);
    message(completed ? 'Игра отмечена как пройденная.' : 'Этот раунд не отмечен как пройденный.');
  }

  stage.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) return;
    const button = event.target.closest('button');
    if (!button || button.disabled || !stage.contains(button)) return;
    if (button.dataset.start) { start(button.dataset.start); return; }
    if (button.dataset.nextGame) { start(button.dataset.nextGame); return; }
    const action = button.dataset.action;
    if (action === 'lobby') { lobby(); return; }
    if (action === 'replay') { start(currentGame); return; }
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

        if (!model.passports[site]) { openPassport(site); return; }
        if (model.pick(site)) {
          fallingLeaf(button);
          updateRoadCollection();
          message('Лист снят с дерева. Можно снять ещё или перенести собранные листья в контейнер.', 'success');
          if (button.disabled) focusElement('[data-draggable]');
        }
      }
      if (button.dataset.passport) openPassport(button.dataset.passport);
      if (button.dataset.field) {
        passportDraft[button.dataset.field] = button.dataset.value;
        stage.querySelectorAll('[data-field="' + button.dataset.field + '"]').forEach(node => node.setAttribute('aria-pressed', String(node === button)));
      }
      if (action === 'compare-sites' && model.complete) { renderComparison(); title.focus({ preventScroll: true }); }
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
    stage.querySelectorAll('[data-draggable]').forEach(item => {
      item.classList.remove('selected'); item.setAttribute('aria-pressed', 'false');
    });
  });
  window.addEventListener('resize', () => { if (cancelDrag) cancelDrag(); });

  preloadAssets();
  lobby();
})();
