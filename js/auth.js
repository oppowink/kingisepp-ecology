// auth.js — состояние авторизации, роли, обучение и заявки (локальный прототип, затем сервер)
(function () {
  'use strict';

  // ключи для sessionStorage и localStorage
  var SESSION_CACHE = 'eco-session-user-v1';
  var PREVIEW_USER = 'eco-preview-user-v1';
  var ROLE_TEST_ORIGINAL = 'eco-role-test-original-v1';
  var LEGACY_USER = 'eco-user-v1';
  var EDUCATION_KEY = 'eco-education-v2';
  var REQUESTS_KEY = 'eco-requests-v1';
  var FEEDBACK_KEY = 'eco-feedback-v1';
  var PARTICIPATION_KEY = 'eco-participation-v1';
  var TRAINING_VERSION = '2026-08';
  var CONFIRMATION_TEST_ENABLED = false;
  var MODERATOR_TRAINING_KEY = 'eco-moderator-training-v1';
  var MODERATOR_EXAM_KEY = 'eco-moderator-exam-v1';
  var MODERATOR_EXAM_VERSION = '2026-09';

  // построение URL для API (с учетом базового пути)
  function api(path) {
    var base = String(window.ECO_API_BASE || '').replace(/\/$/, '');
    return base + path;
  }

  // чтение из storage с парсингом JSON
  function read(storage, key, fallback) {
    try {
      var value = storage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) { return fallback; }
  }

  // запись в storage
  function write(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  // установка режима предпросмотра (для разработки)
  function setPreview(role) {
    if (!['participant', 'curator', 'moderator', 'admin'].includes(role)) return null;
    var previewEmails = {
      participant: 'participant-preview@example.invalid',
      curator: 'dev-curator@kingisepp.ru',
      moderator: 'moderator-preview@example.invalid',
      admin: 'admin-preview@example.invalid'
    };
    var previewNames = {
      participant: 'Участник предпросмотра',
      curator: 'Куратор предпросмотра',
      moderator: 'Модератор предпросмотра',
      admin: 'Администратор предпросмотра'
    };
    var user = {
      id: 'preview-' + role,
      email: previewEmails[role],
      name: previewNames[role],
      role: role,
      preview: true
    };
    write(sessionStorage, PREVIEW_USER, user);
    return user;
  }

  function roleTitle(role) {
    if (role === 'admin') return 'админ';
    if (role === 'moderator') return 'модератор';
    if (role === 'curator') return 'куратор';
    return 'волонтёр';
  }

  function applyRoleTest(user) {
    if (!user?.email) return user;
    var original = read(sessionStorage, ROLE_TEST_ORIGINAL, null);
    var cached = read(sessionStorage, SESSION_CACHE, null);
    var testRole = cached && ['participant', 'curator', 'moderator', 'admin'].includes(cached.testRole)
      ? cached.testRole
      : '';
    if (!original || original.role !== 'admin' || !testRole) return user;
    if (String(original.email || '').toLowerCase() !== String(user.email || '').toLowerCase()) return user;
    return Object.assign({}, user, {
      email: testRole === 'curator' ? 'dev-curator@kingisepp.ru' : user.email,
      role: testRole,
      testRole: testRole,
      originalRole: 'admin',
      name: (original.name || user.name || user.email) + ' (режим: ' + roleTitle(testRole) + ')'
    });
  }

  function canSwitchRoleForTesting(user) {
    var current = user || getUser();
    return Boolean(current && current.role === 'admin' && !current.testRole);
  }

  function switchRoleForTesting(role) {
    if (!['participant', 'curator', 'moderator', 'admin'].includes(role)) return null;
    var current = getUser();
    var original = read(sessionStorage, ROLE_TEST_ORIGINAL, null) || current;
    if (!original || original.role !== 'admin') return null;
    write(sessionStorage, ROLE_TEST_ORIGINAL, original);
    var switched = Object.assign({}, original, {
      email: role === 'curator' ? 'dev-curator@kingisepp.ru' : original.email,
      role: role,
      testRole: role,
      originalRole: 'admin',
      name: (original.name || original.email || 'Администратор') + ' (режим: ' + roleTitle(role) + ')'
    });
    setCachedUser(switched);
    return switched;
  }

  // проверка параметров URL для включения предпросмотра
  function previewFromUrl() {
    if (!previewAvailable()) return;
    var role = new URLSearchParams(location.search).get('preview');
    if (['participant', 'curator', 'moderator', 'admin'].includes(role)) setPreview(role);
  }
  previewFromUrl();

  // предпросмотр доступен только при локальной разработке
  function previewAvailable() {
    if (location.protocol === 'file:') return true;
    return ['localhost', '127.0.0.1'].includes(location.hostname);
  }

  // получить текущего пользователя из сессии
  function getUser() {
    return read(sessionStorage, PREVIEW_USER, null) || read(sessionStorage, SESSION_CACHE, null);
  }

  // сохранить пользователя в кэш
  function setCachedUser(user) {
    if (user) write(sessionStorage, SESSION_CACHE, user);
    else sessionStorage.removeItem(SESSION_CACHE);
  }

  // проверка авторизации
  function isAuthenticated() { return Boolean(getUser()?.email); }

  // обновить данные пользователя с сервера
  async function refreshUser() {
    var preview = read(sessionStorage, PREVIEW_USER, null);
    if (preview) return preview;
    if (backendUnavailableHere()) return getUser();

    try {
      var response = await fetch(api('/api/auth/me'), { credentials: 'include', cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setCachedUser(null);
        return getUser();
      }
      var data = await response.json();
      var user = applyRoleTest(data.user || null);
      setCachedUser(user || null);
      return user || null;
    } catch (_) {
      return getUser();
    }
  }

  // проверка, доступен ли бекенд (если нет — работаем локально)
  function backendUnavailableHere() {
    if (window.ECO_API_BASE) return false;
    if (location.protocol === 'file:') return true;
    return ['localhost', '127.0.0.1'].includes(location.hostname);
  }

  async function passwordRequest(path, payload) {
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api(path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.error || 'AUTH_FAILED');
      error.detail = data.message || '';
      error.status = response.status;
      throw error;
    }
    setCachedUser(data.user || null);
    return data.user || null;
  }

  function registerWithPassword(payload) {
    return passwordRequest('/api/auth/password/register', {
      email: String(payload?.email || '').trim(),
      name: String(payload?.name || '').trim(),
      password: String(payload?.password || ''),
      passwordConfirm: String(payload?.passwordConfirm || '')
    });
  }

  function signInWithPassword(payload) {
    return passwordRequest('/api/auth/password/login', {
      email: String(payload?.email || '').trim(),
      password: String(payload?.password || '')
    });
  }

  // выход (удаление сессии)
  async function signOut() {
    if (!backendUnavailableHere()) {
      try {
        await fetch(api('/api/auth/logout'), { method: 'POST', credentials: 'include' });
      } catch (_) {}
    }
    sessionStorage.removeItem(SESSION_CACHE);
    sessionStorage.removeItem(PREVIEW_USER);
    sessionStorage.removeItem(ROLE_TEST_ORIGINAL);
    localStorage.removeItem(LEGACY_USER);
  }

  // карта завершённых обучений (локально)
  function educationMap() { return read(localStorage, EDUCATION_KEY, {}); }

  function saveLocalEducation(email, record) {
    var key = String(email || '').trim().toLowerCase();
    if (!key) return;
    var map = educationMap();
    map[key] = Object.assign({
      completed: false,
      score: 0,
      total: 0,
      version: TRAINING_VERSION,
      completedAt: null
    }, record || {}, { version: TRAINING_VERSION });
    write(localStorage, EDUCATION_KEY, map);

    var user = getUser();
    if (user?.email && user.email.toLowerCase() === key) {
      user.educationCompleted = Boolean(map[key].completed);
      user.educationScore = Number(map[key].score || 0);
      user.educationCompletedAt = map[key].completedAt || null;
      setCachedUser(user);
    }
  }

  function getEducationRecord(email) {
    var user = getUser();
    var key = String(email || user?.email || '').trim().toLowerCase();
    if (!key) return null;
    return educationMap()[key] || null;
  }

  // проверка, пройдено ли обучение для данного email
  function isEducationCompleted(email) {
    if (!CONFIRMATION_TEST_ENABLED) return false;
    var user = getUser();
    if (user?.preview) return true;
    if (user?.educationCompleted) return true;
    var key = String(email || user?.email || '').trim().toLowerCase();
    var record = key ? educationMap()[key] : null;
    return Boolean(record && record.completed && record.version === TRAINING_VERSION);
  }

  // отметить обучение как пройденное
  async function completeEducation(result) {
    var user = getUser();
    if (!user?.email) return false;
    result = result || {};

    if (!backendUnavailableHere()) {
      try {
        var response = await fetch(api('/api/education/complete'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ answers: result.answers || {} })
        });
        var data = await response.json().catch(function () { return {}; });
        if (response.ok) {
          saveLocalEducation(user.email, {
            completed: Boolean(data.completed),
            score: Number(data.score || 0),
            total: Number(data.total || 0),
            completedAt: data.completedAt || null
          });
          return data;
        }
      } catch (_) {}
    }

    var passed = result.completed !== false;
    var local = {
      completed: passed,
      score: Number(result.score || 0),
      total: Number(result.total || 0),
      completedAt: passed ? new Date().toISOString() : null
    };
    saveLocalEducation(user.email, local);
    return local;
  }

  async function refreshEducationStatus() {
    var user = getUser();
    if (!user?.email) return false;
    if (!CONFIRMATION_TEST_ENABLED) return false;
    if (user.preview || backendUnavailableHere()) return isEducationCompleted(user.email);

    try {
      var response = await fetch(api('/api/education/status'), {
        credentials: 'include',
        cache: 'no-store'
      });
      var data = await response.json().catch(function () { return {}; });
      if (response.ok) {
        saveLocalEducation(user.email, {
          completed: Boolean(data.completed),
          score: Number(data.score || 0),
          total: Number(data.total || 0),
          completedAt: data.completedAt || null
        });
        return Boolean(data.completed);
      }
    } catch (_) {}

    return isEducationCompleted(user.email);
  }

  function moderatorExamMap() { return read(localStorage, MODERATOR_EXAM_KEY, {}); }

  function moderatorTrainingMap() { return read(localStorage, MODERATOR_TRAINING_KEY, {}); }

  function saveModeratorTraining(email, record) {
    var key = String(email || '').trim().toLowerCase();
    if (!key) return;
    var map = moderatorTrainingMap();
    map[key] = Object.assign({
      completed: false,
      version: MODERATOR_EXAM_VERSION,
      completedAt: null
    }, record || {}, { version: MODERATOR_EXAM_VERSION });
    write(localStorage, MODERATOR_TRAINING_KEY, map);
  }

  function getModeratorTrainingRecord(email) {
    var user = getUser();
    var key = String(email || user?.email || '').trim().toLowerCase();
    if (!key) return null;
    return moderatorTrainingMap()[key] || null;
  }

  function isModeratorTrainingCompleted(email) {
    var record = getModeratorTrainingRecord(email);
    return Boolean(record && record.completed && record.version === MODERATOR_EXAM_VERSION);
  }

  function completeModeratorTraining() {
    var user = getUser();
    if (!user?.email) return null;
    var record = {
      completed: true,
      completedAt: new Date().toISOString()
    };
    saveModeratorTraining(user.email, record);
    return getModeratorTrainingRecord(user.email);
  }

  function saveModeratorExam(email, record) {
    var key = String(email || '').trim().toLowerCase();
    if (!key) return;
    var map = moderatorExamMap();
    map[key] = Object.assign({
      completed: false,
      score: 0,
      total: 10,
      version: MODERATOR_EXAM_VERSION,
      completedAt: null
    }, record || {}, { version: MODERATOR_EXAM_VERSION });
    write(localStorage, MODERATOR_EXAM_KEY, map);
  }

  function getModeratorExamRecord(email) {
    var user = getUser();
    var key = String(email || user?.email || '').trim().toLowerCase();
    if (!key) return null;
    return moderatorExamMap()[key] || null;
  }

  function isModeratorExamCompleted(email) {
    var record = getModeratorExamRecord(email);
    return Boolean(record && record.completed && record.version === MODERATOR_EXAM_VERSION);
  }

  function completeModeratorExam(result) {
    var user = getUser();
    if (!user?.email) return null;
    result = result || {};
    var passed = Number(result.score || 0) >= 9 && Number(result.total || 10) === 10;
    var record = {
      completed: passed,
      score: Number(result.score || 0),
      total: Number(result.total || 10),
      answers: result.answers || {},
      completedAt: passed ? new Date().toISOString() : null
    };
    saveModeratorExam(user.email, record);
    return record;
  }

  // получить все заявки из локального кэша
  function getAllRequests() { return read(localStorage, REQUESTS_KEY, []); }

  function sortRequests(list) {
    return (list || []).slice().sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  function saveRequests(list) {
    write(localStorage, REQUESTS_KEY, sortRequests(list));
  }

  function mergeRequest(request) {
    if (!request || !request.id) return null;
    var all = getAllRequests();
    var index = all.findIndex(function (item) { return item.id === request.id; });
    if (index >= 0) all[index] = request;
    else all.unshift(request);
    saveRequests(all);
    return request;
  }

  async function refreshRequests(scope) {
    var user = getUser();
    if (!user?.email || backendUnavailableHere()) return getAllRequests();

    var requestedScope = scope === 'all' ? 'all' : 'mine';
    try {
      var response = await fetch(api('/api/requests/list?scope=' + encodeURIComponent(requestedScope)), {
        credentials: 'include',
        cache: 'no-store'
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) return getAllRequests();

      var fresh = Array.isArray(data.requests) ? data.requests : [];
      if (requestedScope === 'all') {
        saveRequests(fresh);
      } else {
        var email = String(user.email || '').toLowerCase();
        var others = getAllRequests().filter(function (item) {
          return String(item.userEmail || '').toLowerCase() !== email;
        });
        saveRequests(fresh.concat(others));
      }
      return getAllRequests();
    } catch (_) {
      return getAllRequests();
    }
  }

  // получить заявки текущего пользователя
  function getMyRequests() {
    var user = getUser();
    if (!user?.email) return [];
    return getAllRequests().filter(function (item) { return item.userEmail === user.email; });
  }

  function isRequestPublished(item) {
    if (!item) return false;
    if (item.status === 'published') return true;
    return item.status === 'approved' && !item.aiStatus;
  }

  function getFirstApprovedRequest() {
    return getMyRequests().find(isRequestPublished) || null;
  }

  function hasApprovedContribution() {
    return Boolean(getFirstApprovedRequest());
  }

  function buildLocalRequest(data) {
    var user = getUser();
    if (!user?.email) throw new Error('AUTH_REQUIRED');
    if (user.blocked) throw new Error('ACCOUNT_BLOCKED');
    if (!isEducationCompleted(user.email)) throw new Error('EDUCATION_REQUIRED');

    return {
      id: 'ECO-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-7),
      userEmail: user.email,
      userName: user.name || user.email,
      title: String(data.title || '').trim(),
      location: String(data.location || '').trim(),
      coordinates: String(data.coordinates || '').trim(),
      latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
      longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
      collectionDate: String(data.collectionDate || ''),
      comment: String(data.comment || '').trim(),
      files: Array.isArray(data.files) ? data.files : [],
      treePhoto: data.treePhoto || null,
      treeCount: Number(data.treeCount || 1),
      leafCount: Number(data.leafCount || 30),
      sourceType: data.sourceType || 'own',
      organizationId: data.organizationId || null,
      projectId: data.projectId || null,
      objectId: data.objectId || null,
      territoryType: String(data.territoryType || '').trim(),
      landUse: String(data.landUse || '').trim(),
      nearbySources: String(data.nearbySources || '').trim(),
      roadDistanceM: data.roadDistanceM === '' ? null : Number(data.roadDistanceM),
      trafficIntensity: String(data.trafficIntensity || '').trim(),
      surfaceCover: String(data.surfaceCover || '').trim(),
      weatherConditions: String(data.weatherConditions || '').trim(),
      treeSpecies: String(data.treeSpecies || 'Берёза повислая').trim(),
      trunkDiameterCm: data.trunkDiameterCm === '' ? null : Number(data.trunkDiameterCm),
      treeHeightEstimateM: data.treeHeightEstimateM === '' ? null : Number(data.treeHeightEstimateM),
      treeCondition: String(data.treeCondition || '').trim(),
      treeDamageNotes: String(data.treeDamageNotes || '').trim(),
      aiResult: data.aiResult || null,
      status: 'pending_human',
      humanStatus: 'pending',
      aiStatus: 'pending',
      moderationReason: '',
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // создать новую заявку
  async function createRequest(data) {
    var item = buildLocalRequest(data || {});

    if (!backendUnavailableHere()) {
      var response = await fetch(api('/api/requests/list'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ action: 'create' }, item))
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        var error = new Error(result.error || 'REQUEST_CREATE_FAILED');
        error.detail = result.message || '';
        error.status = response.status;
        throw error;
      }
      return mergeRequest(result.request || item);
    }

    mergeRequest(item);
    return item;
  }

  // обновить статус заявки (модерация)
  function updateRequest(id, patch) {
    var all = getAllRequests();
    var index = all.findIndex(function (item) { return item.id === id; });
    if (index < 0) return null;
    all[index] = Object.assign({}, all[index], patch, { updatedAt: new Date().toISOString() });
    write(localStorage, REQUESTS_KEY, all);
    return all[index];
  }

  async function saveRequestUpdate(id, patch) {
    var local = updateRequest(id, patch);
    if (backendUnavailableHere()) return local;

    var response = await fetch(api('/api/requests/list'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'moderate', id: id, patch: patch || {} })
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.error || 'REQUEST_UPDATE_FAILED');
      error.detail = data.message || '';
      error.status = response.status;
      throw error;
    }
    return mergeRequest(data.request || local);
  }

  // сохранить обратную связь
  function saveFeedback(data) {
    var list = read(localStorage, FEEDBACK_KEY, []);
    var item = Object.assign({}, data, { id: 'FB-' + Date.now(), createdAt: new Date().toISOString() });
    list.unshift(item);
    write(localStorage, FEEDBACK_KEY, list);
    return item;
  }

  function openVolunteerCertificate(details) {
    details = details || {};
    var user = details.user || getUser() || {};
    var pointTitle = details.pointTitle || details.title || 'подтверждённая точка мониторинга';
    var date = details.date || new Date().toLocaleDateString('ru-RU');
    var number = details.number || ('EBM-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6));
    var win = window.open('', '_blank');
    if (!win) return false;

    win.document.open();
    win.document.write(
      '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
      '<title>Сертификат волонтёра</title>' +
      '<style>' +
      '@page{size:A4 landscape;margin:12mm}' +
      '*{box-sizing:border-box}' +
      'body{margin:0;background:#eef4ed;color:#19351f;font-family:Georgia,\"Times New Roman\",serif}' +
      '.page{min-height:100vh;display:grid;place-items:center;padding:28px}' +
      '.cert{width:min(1060px,100%);min-height:680px;border:8px double #2f6b3f;background:#fff;padding:56px 64px;text-align:center;display:flex;flex-direction:column;justify-content:center}' +
      '.eyebrow{margin:0 0 18px;font:700 14px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#5f7c63}' +
      'h1{margin:0 auto 34px;max-width:820px;font-size:38px;line-height:1.2;color:#2f6b3f}' +
      '.lead{margin:0 0 18px;font-size:22px}' +
      '.name{margin:0 0 22px;font-size:34px;font-weight:700}' +
      '.text{margin:0 auto 12px;max-width:780px;font-size:19px;line-height:1.55}' +
      '.meta{margin-top:42px;display:flex;justify-content:space-between;gap:24px;font:15px Arial,sans-serif;color:#49624d;text-align:left}' +
      '.actions{position:fixed;right:18px;top:18px;display:flex;gap:8px}' +
      '.print,.back{padding:10px 16px;border:1px solid #2f6b3f;font:16px Arial,sans-serif;cursor:pointer}' +
      '.print{background:#2f6b3f;color:#fff}.back{background:#fff;color:#2f6b3f}' +
      '@media print{body{background:#fff}.page{padding:0}.cert{width:100%;min-height:calc(100vh - 24mm)}.actions{display:none}}' +
      '</style></head><body>' +
      '<div class="actions"><button class="back" onclick="window.close()">Назад</button><button class="print" onclick="window.print()">Сохранить в PDF</button></div>' +
      '<main class="page"><section class="cert">' +
      '<p class="eyebrow">ЭкоБиоМониторинг</p>' +
      '<h1>Сертификат волонтёра-исследователя экологического мониторинга</h1>' +
      '<p class="lead">Настоящий сертификат подтверждает, что</p>' +
      '<p class="name">' + escapeHtml(user.name || user.email || 'Участник проекта') + '</p>' +
      '<p class="text">прошёл(ла) обучение волонтёра и внёс(ла) подтверждённый вклад в гражданский экологический мониторинг малых городов.</p>' +
      '<p class="text">Подтверждённая точка: <strong>' + escapeHtml(pointTitle) + '</strong></p>' +
      '<div class="meta"><span>Дата выдачи: ' + escapeHtml(date) + '</span><span>Номер: ' + escapeHtml(number) + '</span></div>' +
      '</section></main></body></html>'
    );
    win.document.close();
    win.focus();
    return true;
  }

  function openModeratorCertificate(details) {
    details = details || {};
    var user = details.user || getUser() || {};
    var date = details.date || new Date().toLocaleDateString('ru-RU');
    var number = details.number || ('EBM-MOD-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6));
    var win = window.open('', '_blank');
    if (!win) return false;

    win.document.open();
    win.document.write(
      '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
      '<title>Сертификат модератора</title>' +
      '<style>' +
      '@page{size:A4 landscape;margin:12mm}' +
      '*{box-sizing:border-box}' +
      'body{margin:0;background:#eef4ed;color:#183120;font-family:Georgia,\"Times New Roman\",serif}' +
      '.page{min-height:100vh;display:grid;place-items:center;padding:28px}' +
      '.cert{width:min(1060px,100%);min-height:680px;border:8px double #2f6b3f;background:#fff;padding:56px 64px;text-align:center;display:flex;flex-direction:column;justify-content:center}' +
      '.eyebrow{margin:0 0 18px;font:700 14px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#5f7c63}' +
      'h1{margin:0 auto 34px;max-width:820px;font-size:40px;line-height:1.2;color:#2f6b3f}' +
      '.lead{margin:0 0 18px;font-size:22px}' +
      '.name{margin:0 0 22px;font-size:34px;font-weight:700}' +
      '.text{margin:0 auto 12px;max-width:790px;font-size:19px;line-height:1.55}' +
      '.meta{margin-top:42px;display:flex;justify-content:space-between;gap:24px;font:15px Arial,sans-serif;color:#49624d;text-align:left}' +
      '.actions{position:fixed;right:18px;top:18px;display:flex;gap:8px}' +
      '.print,.back{padding:10px 16px;border:1px solid #2f6b3f;font:16px Arial,sans-serif;cursor:pointer}' +
      '.print{background:#2f6b3f;color:#fff}.back{background:#fff;color:#2f6b3f}' +
      '@media print{body{background:#fff}.page{padding:0}.cert{width:100%;min-height:calc(100vh - 24mm)}.actions{display:none}}' +
      '</style></head><body>' +
      '<div class="actions"><button class="back" onclick="window.close()">Назад</button><button class="print" onclick="window.print()">Сохранить в PDF</button></div>' +
      '<main class="page"><section class="cert">' +
      '<p class="eyebrow">ЭкоБиоМониторинг</p>' +
      '<h1>Сертификат модератора проекта</h1>' +
      '<p class="lead">Настоящий сертификат подтверждает, что</p>' +
      '<p class="name">' + escapeHtml(user.name || user.email || 'Модератор проекта') + '</p>' +
      '<p class="text">прошёл(ла) обучение модератора и успешно сдал(а) тест по проверке заявок гражданского экологического мониторинга.</p>' +
      '<p class="text">Статус: модератор проекта «ЭкоБиоМониторинг».</p>' +
      '<div class="meta"><span>Дата выдачи: ' + escapeHtml(date) + '</span><span>Номер: ' + escapeHtml(number) + '</span></div>' +
      '</section></main></body></html>'
    );
    win.document.close();
    win.focus();
    return true;
  }

  // Данные организаций и объектов: в опубликованной версии хранятся в Supabase,
  // локальное хранилище используется только для автономного предпросмотра.
  function localParticipationData() {
    return read(localStorage, PARTICIPATION_KEY, {
      organizations: [], memberships: [], projects: [], objects: [], assignments: []
    });
  }

  function saveLocalParticipationData(data) {
    write(localStorage, PARTICIPATION_KEY, data);
  }

  function localId(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);
  }

  function localParticipationAction(action, payload) {
    var user = getUser();
    if (!user?.id) throw new Error('AUTH_REQUIRED');
    var data = localParticipationData();
    var now = new Date().toISOString();

    if (action === 'save_profile') {
      user.city = String(payload.city || '').trim();
      setCachedUser(user);
      return { profile: user };
    }
    if (action === 'create_organization') {
      var organization = {
        id: localId('org'), name: String(payload.name || '').trim(), type: payload.type || 'school',
        city: String(payload.city || '').trim(), description: String(payload.description || '').trim(),
        joinCode: Math.random().toString(36).slice(2, 10).toUpperCase(), createdBy: user.id, status: 'active'
      };
      data.organizations.push(organization);
      data.memberships.push({ id: localId('member'), organizationId: organization.id, userId: user.id,
        memberRole: 'curator', status: 'active', joinedAt: now });
      saveLocalParticipationData(data);
      return { organization: organization };
    }
    if (action === 'join_organization') {
      var found = data.organizations.find(function (item) {
        return item.joinCode === String(payload.code || '').trim().toUpperCase() && item.status === 'active';
      });
      if (!found) throw new Error('ORGANIZATION_NOT_FOUND');
      var oldMembership = data.memberships.find(function (item) {
        return item.organizationId === found.id && item.userId === user.id;
      });
      if (oldMembership) oldMembership.status = 'active';
      else data.memberships.push({ id: localId('member'), organizationId: found.id, userId: user.id,
        memberRole: user.role === 'curator' ? 'curator' : 'participant', status: 'active', joinedAt: now });
      saveLocalParticipationData(data);
      return { organization: found };
    }
    if (action === 'leave_organization') {
      data.memberships.forEach(function (item) {
        if (item.organizationId === payload.organizationId && item.userId === user.id) item.status = 'left';
      });
      saveLocalParticipationData(data);
      return { left: true };
    }
    if (action === 'create_project') {
      var project = {
        id: localId('project'), organizationId: payload.organizationId, curatorId: user.id,
        title: String(payload.title || '').trim(), description: String(payload.description || '').trim(),
        city: String(payload.city || '').trim(), visibility: payload.visibility === 'public' ? 'public' : 'organization',
        status: 'open', startsAt: payload.startsAt || null, endsAt: payload.endsAt || null
      };
      data.projects.push(project);
      saveLocalParticipationData(data);
      return { project: project };
    }
    if (action === 'create_object') {
      var object = {
        id: localId('object'), organizationId: payload.organizationId, projectId: payload.projectId,
        curatorId: user.id, title: String(payload.title || '').trim(), description: String(payload.description || '').trim(),
        city: String(payload.city || '').trim(), addressHint: String(payload.addressHint || '').trim(),
        centerLat: payload.centerLat === '' ? null : Number(payload.centerLat),
        centerLng: payload.centerLng === '' ? null : Number(payload.centerLng),
        radiusM: payload.radiusM === '' ? null : Number(payload.radiusM),
        requiredPoints: Number(payload.requiredPoints || 1), visibility: payload.visibility === 'public' ? 'public' : 'organization',
        status: 'open', dueDate: payload.dueDate || null
      };
      data.objects.push(object);
      saveLocalParticipationData(data);
      return { object: object };
    }
    if (action === 'assign_object') {
      var assignment = { id: localId('assignment'), objectId: payload.objectId, userId: payload.userId,
        assignedBy: user.id, status: 'assigned' };
      data.assignments.push(assignment);
      saveLocalParticipationData(data);
      return { assignment: assignment };
    }
    throw new Error('UNKNOWN_REQUEST_ACTION');
  }

  async function participationAction(action, payload) {
    payload = Object.assign({}, payload || {}, { action: action });
    if (backendUnavailableHere()) return localParticipationAction(action, payload);
    var response = await fetch(api('/api/requests/list'), {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.error || 'PARTICIPATION_ACTION_FAILED');
      error.detail = data.message || '';
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function localParticipationContext() {
    var user = getUser() || {};
    var data = localParticipationData();
    var memberships = data.memberships.filter(function (item) {
      return item.userId === user.id && item.status === 'active';
    });
    var orgIds = memberships.map(function (item) { return item.organizationId; });
    var assignedIds = data.assignments.filter(function (item) {
      return item.userId === user.id && ['assigned', 'accepted'].includes(item.status);
    }).map(function (item) { return item.objectId; });
    var objects = data.objects.filter(function (item) {
      return item.status === 'open' && (item.visibility === 'public' || orgIds.includes(item.organizationId) || assignedIds.includes(item.id));
    }).map(function (item) { return Object.assign({}, item, { assigned: assignedIds.includes(item.id) }); });
    return {
      profile: user,
      memberships: memberships.map(function (item) {
        return Object.assign({}, item, { organization: data.organizations.find(function (org) { return org.id === item.organizationId; }) || null });
      }),
      projects: data.projects.filter(function (item) { return objects.some(function (object) { return object.projectId === item.id; }); }),
      objects: objects
    };
  }

  async function getParticipationContext() {
    if (backendUnavailableHere()) return localParticipationContext();
    var response = await fetch(api('/api/requests/list?scope=participation'), { credentials: 'include', cache: 'no-store' });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'PARTICIPATION_LOAD_FAILED');
    return data;
  }

  async function getCuratorDashboard() {
    if (backendUnavailableHere()) {
      var user = getUser() || {};
      var data = localParticipationData();
      var allowedOrgIds = data.organizations.filter(function (org) {
        return user.role === 'admin' || org.createdBy === user.id || data.memberships.some(function (member) {
          return member.userId === user.id && member.organizationId === org.id && member.memberRole === 'curator' && member.status === 'active';
        });
      }).map(function (org) { return org.id; });
      return {
        organizations: data.organizations.filter(function (org) { return allowedOrgIds.includes(org.id); }),
        projects: data.projects.filter(function (project) { return allowedOrgIds.includes(project.organizationId); }),
        objects: data.objects.filter(function (object) { return allowedOrgIds.includes(object.organizationId); }),
        members: data.memberships.filter(function (member) { return allowedOrgIds.includes(member.organizationId) && member.status === 'active'; }),
        requests: getAllRequests().filter(function (request) { return allowedOrgIds.includes(request.organizationId); })
      };
    }
    var response = await fetch(api('/api/requests/list?scope=curator'), { credentials: 'include', cache: 'no-store' });
    var result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || 'CURATOR_DASHBOARD_FAILED');
    return result;
  }

  async function uploadObservationPhotos(treeFile, leafFiles) {
    var leaves = Array.from(leafFiles || []);
    var descriptors = [{ clientId: 'tree', kind: 'tree', file: treeFile }].concat(leaves.map(function (file, index) {
      return { clientId: 'leaf-' + index, kind: 'leaf', file: file };
    }));
    if (backendUnavailableHere()) {
      var local = descriptors.map(function (item) {
        return { clientId: item.clientId, kind: item.kind, path: 'local-preview/' + item.file.name,
          url: URL.createObjectURL(item.file), name: item.file.name, size: item.file.size, type: item.file.type };
      });
      return {
        treePhoto: local[0],
        files: local.slice(1).map(function (item, index) {
          item.bgLight = leaves[index]._bgLight !== undefined ? leaves[index]._bgLight : null;
          return item;
        })
      };
    }

    var preparedResponse = await participationAction('prepare_uploads', {
      files: descriptors.map(function (item) {
        return { clientId: item.clientId, kind: item.kind, size: item.file.size, type: item.file.type };
      })
    });
    var prepared = Array.isArray(preparedResponse.uploads) ? preparedResponse.uploads : [];
    if (prepared.length !== descriptors.length) throw new Error('UPLOAD_PREPARATION_FAILED');

    var cursor = 0;
    async function worker() {
      while (cursor < prepared.length) {
        var index = cursor++;
        var target = prepared[index];
        var source = descriptors.find(function (item) { return item.clientId === target.clientId; });
        if (!source) throw new Error('UPLOAD_PREPARATION_FAILED');
        var formData = new FormData();
        formData.append('cacheControl', '3600');
        formData.append('', source.file);
        var upload = await fetch(target.signedUrl, { method: 'PUT', headers: { 'x-upsert': 'false' }, body: formData });
        if (!upload.ok) throw new Error('PHOTO_UPLOAD_FAILED');
      }
    }
    await Promise.all([worker(), worker(), worker()]);

    function metadata(item) {
      var source = descriptors.find(function (descriptor) { return descriptor.clientId === item.clientId; });
      return { name: source.file.name, size: source.file.size, type: source.file.type,
        path: item.path, url: item.publicUrl, bgLight: source.file._bgLight !== undefined ? source.file._bgLight : null };
    }
    return {
      treePhoto: metadata(prepared.find(function (item) { return item.clientId === 'tree'; })),
      files: prepared.filter(function (item) { return item.kind === 'leaf'; }).map(metadata)
    };
  }

  async function setUserRole(email, role, options) {
    options = options || {};
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var payload = {
      email: String(email || '').trim(),
      role: String(role || '').trim()
    };
    if (Object.prototype.hasOwnProperty.call(options, 'blocked')) {
      payload.blocked = options.blocked === true;
    }
    var response = await fetch(api('/api/admin/users/role'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.error || 'ROLE_UPDATE_FAILED');
      error.detail = data.message || '';
      error.status = response.status;
      throw error;
    }
    return data.user || null;
  }

  // требовать авторизацию, иначе редирект на account.html
  async function requireAuthAsync(options) {
    options = options || {};
    var user = getUser();
    if (!backendUnavailableHere()) {
      user = await refreshUser() || user;
    }
    if (!user) user = await refreshUser();
    if (user?.email) return user;
    if (options.redirect === false) return null;

    var current = (location.pathname.split('/').pop() || 'index.html') + (location.search || '');
    location.replace('account.html?next=' + encodeURIComponent(current));
    return null;
  }

  // экспорт в глобальный объект
  window.EcoAuth = {
    getUser: getUser,
    refreshUser: refreshUser,
    isAuthenticated: isAuthenticated,
    registerWithPassword: registerWithPassword,
    signInWithPassword: signInWithPassword,
    signOut: signOut,
    startPreview: setPreview,
    canSwitchRoleForTesting: canSwitchRoleForTesting,
    switchRoleForTesting: switchRoleForTesting,
    previewAvailable: previewAvailable,
    isEducationCompleted: isEducationCompleted,
    getEducationRecord: getEducationRecord,
    completeEducation: completeEducation,
    refreshEducationStatus: refreshEducationStatus,
    getModeratorTrainingRecord: getModeratorTrainingRecord,
    isModeratorTrainingCompleted: isModeratorTrainingCompleted,
    completeModeratorTraining: completeModeratorTraining,
    getModeratorExamRecord: getModeratorExamRecord,
    isModeratorExamCompleted: isModeratorExamCompleted,
    completeModeratorExam: completeModeratorExam,
    refreshRequests: refreshRequests,
    getAllRequests: getAllRequests,
    getMyRequests: getMyRequests,
    getFirstApprovedRequest: getFirstApprovedRequest,
    hasApprovedContribution: hasApprovedContribution,
    isRequestPublished: isRequestPublished,
    createRequest: createRequest,
    updateRequest: updateRequest,
    saveRequestUpdate: saveRequestUpdate,
    openVolunteerCertificate: openVolunteerCertificate,
    openModeratorCertificate: openModeratorCertificate,
    getParticipationContext: getParticipationContext,
    getCuratorDashboard: getCuratorDashboard,
    saveProfileCity: function (city) { return participationAction('save_profile', { city: city }); },
    joinOrganization: function (code) { return participationAction('join_organization', { code: code }); },
    leaveOrganization: function (organizationId) { return participationAction('leave_organization', { organizationId: organizationId }); },
    createOrganization: function (data) { return participationAction('create_organization', data); },
    createMonitoringProject: function (data) { return participationAction('create_project', data); },
    createMonitoringObject: function (data) { return participationAction('create_object', data); },
    assignMonitoringObject: function (data) { return participationAction('assign_object', data); },
    uploadObservationPhotos: uploadObservationPhotos,
    setUserRole: setUserRole,
    saveFeedback: saveFeedback,
    requireAuthAsync: requireAuthAsync,
    trainingVersion: TRAINING_VERSION,
    confirmationTestEnabled: CONFIRMATION_TEST_ENABLED,
    isPreview: function () { return Boolean(read(sessionStorage, PREVIEW_USER, null)); }
  };




})();
