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
    var role = new URLSearchParams(location.search).get('preview');
    if (['participant', 'moderator', 'admin'].includes(role)) setPreview(role);
  }
  previewFromUrl();

  // доступен ли предпросмотр (локально или с параметром ?preview=1)
  function previewAvailable() {
    var params = new URLSearchParams(location.search);
    if (params.get('preview') === '1') return true;
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

  // начало входа через Яндекс ID
  function startYandexLogin() {
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    location.assign(api('/api/auth/yandex/start'));
  }

  // начало входа по email (отправка OTP-кода)
  async function startEmailLogin(payload) {
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api('/api/auth/email/start'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: String(payload?.email || '').trim(),
        name: String(payload?.name || '').trim()
      })
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'EMAIL_START_FAILED');
    return data;
  }

  // подтверждение OTP-кода и вход
  async function verifyEmailLogin(payload) {
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api('/api/auth/email/verify'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: String(payload?.email || '').trim(),
        token: String(payload?.token || '').trim(),
        name: String(payload?.name || '').trim()
      })
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'EMAIL_VERIFY_FAILED');
    setCachedUser(data.user || null);
    return data.user || null;
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

  // проверка, пройдено ли обучение для данного email
  function isEducationCompleted(email) {
    var user = getUser();
    if (user?.preview) return true;
    var key = String(email || user?.email || '').trim().toLowerCase();
    var record = key ? educationMap()[key] : null;
    return Boolean(record && record.completed && record.version === TRAINING_VERSION);
  }

  // отметить обучение как пройденное
  function completeEducation() {
    var user = getUser();
    if (!user?.email) return false;
    var map = educationMap();
    map[user.email.toLowerCase()] = {
      completed: true,
      version: TRAINING_VERSION,
      completedAt: new Date().toISOString()
    };
    write(localStorage, EDUCATION_KEY, map);
    return true;
  }

  // получить все заявки (для модератора)
  function getAllRequests() { return read(localStorage, REQUESTS_KEY, []); }

  // получить заявки текущего пользователя
  function getMyRequests() {
    var user = getUser();
    if (!user?.email) return [];
    return getAllRequests().filter(function (item) { return item.userEmail === user.email; });
  }

  // создать новую заявку
  function createRequest(data) {
    var user = getUser();
    if (!user?.email) throw new Error('AUTH_REQUIRED');
    if (!isEducationCompleted(user.email)) throw new Error('EDUCATION_REQUIRED');

    var all = getAllRequests();
    var item = {
      id: 'ECO-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-7),
      userEmail: user.email,
      userName: user.name || user.email,
      title: String(data.title || '').trim(),
      location: String(data.location || '').trim(),
      coordinates: String(data.coordinates || '').trim(),
      collectionDate: String(data.collectionDate || ''),
      comment: String(data.comment || '').trim(),
      files: Array.isArray(data.files) ? data.files : [],
      aiResult: data.aiResult || null,
      status: 'pending',
      moderationReason: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    all.unshift(item);
    write(localStorage, REQUESTS_KEY, all);
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

  // сохранить обратную связь
  function saveFeedback(data) {
    var list = read(localStorage, FEEDBACK_KEY, []);
    var item = Object.assign({}, data, { id: 'FB-' + Date.now(), createdAt: new Date().toISOString() });
    list.unshift(item);
    write(localStorage, FEEDBACK_KEY, list);
    return item;
  }

  // требовать авторизацию, иначе редирект на account.html
  async function requireAuthAsync(options) {
    options = options || {};
    var user = getUser() || await refreshUser();
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
    startYandexLogin: startYandexLogin,
    startEmailLogin: startEmailLogin,
    verifyEmailLogin: verifyEmailLogin,
    signOut: signOut,
    startPreview: setPreview,
    previewAvailable: previewAvailable,
    isEducationCompleted: isEducationCompleted,
    completeEducation: completeEducation,
    getAllRequests: getAllRequests,
    getMyRequests: getMyRequests,
    createRequest: createRequest,
    updateRequest: updateRequest,
    saveFeedback: saveFeedback,
    requireAuthAsync: requireAuthAsync,
    trainingVersion: TRAINING_VERSION,
    isPreview: function () { return Boolean(read(sessionStorage, PREVIEW_USER, null)); }
  };




})();

