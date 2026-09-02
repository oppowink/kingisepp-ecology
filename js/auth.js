// auth.js — состояние авторизации, роли, обучение и заявки (локальный прототип, затем сервер)
(function () {
  'use strict';

  // ключи для sessionStorage и localStorage
  var SESSION_CACHE = 'eco-session-user-v1';
  var PREVIEW_USER = 'eco-preview-user-v1';
  var LEGACY_USER = 'eco-user-v1';
  var EDUCATION_KEY = 'eco-education-v2';
  var REQUESTS_KEY = 'eco-requests-v1';
  var FEEDBACK_KEY = 'eco-feedback-v1';
  var TRAINING_VERSION = '2026-08';

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
    if (!['participant', 'moderator', 'admin'].includes(role)) return null;
    var user = {
      id: 'preview-' + role,
      email: role === 'participant' ? 'participant-preview@example.invalid' : 'moderator-preview@example.invalid',
      name: role === 'participant' ? 'Участник предпросмотра' : 'Модератор предпросмотра',
      role: role,
      preview: true
    };
    write(sessionStorage, PREVIEW_USER, user);
    return user;
  }

  // проверка параметров URL для включения предпросмотра
  function previewFromUrl() {
    if (!previewAvailable()) return;
    var role = new URLSearchParams(location.search).get('preview');
    if (['participant', 'moderator', 'admin'].includes(role)) setPreview(role);
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
        if (response.status === 401) setCachedUser(null);
        return getUser();
      }
      var data = await response.json();
      setCachedUser(data.user || null);
      return data.user || null;
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
    if (!isEducationCompleted(user.email)) throw new Error('EDUCATION_REQUIRED');

    return {
      id: 'ECO-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-7),
      userEmail: user.email,
      userName: user.name || user.email,
      title: String(data.title || '').trim(),
      location: String(data.location || '').trim(),
      coordinates: String(data.coordinates || '').trim(),
      collectionDate: String(data.collectionDate || ''),
      comment: String(data.comment || '').trim(),
      files: Array.isArray(data.files) ? data.files : [],
      treeCount: Number(data.treeCount || 1),
      leafCount: Number(data.leafCount || 30),
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

  async function setUserRole(email, role) {
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api('/api/admin/users/role'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: String(email || '').trim(), role: String(role || '').trim() })
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
    previewAvailable: previewAvailable,
    isEducationCompleted: isEducationCompleted,
    getEducationRecord: getEducationRecord,
    completeEducation: completeEducation,
    refreshEducationStatus: refreshEducationStatus,
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
    setUserRole: setUserRole,
    saveFeedback: saveFeedback,
    requireAuthAsync: requireAuthAsync,
    trainingVersion: TRAINING_VERSION,
    isPreview: function () { return Boolean(read(sessionStorage, PREVIEW_USER, null)); }
  };




})();
