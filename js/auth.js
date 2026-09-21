// auth.js: сессия в браузере, рабочие данные только через Supabase API.
(function () {
  'use strict';
  var SESSION_CACHE = 'eco-session-user-v2';
  var PREVIEW_USER = 'eco-preview-user-v2';
  var ROLE_TEST_ORIGINAL = 'eco-role-test-original-v2';
  var courseCache = {};
  var requestsCache = [];

  function api(path) { return String(window.ECO_API_BASE || '').replace(/\/$/, '') + path; }
  function readSession(key, fallback) { try { var value = sessionStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; } }
  function writeSession(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function backendUnavailableHere() { return !window.ECO_API_BASE && (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)); }
  function previewAvailable() { return location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname); }

  function setPreview(role) {
    if (!['participant', 'curator', 'moderator', 'admin'].includes(role)) return null;
    var titles = { participant: 'Участник предпросмотра', curator: 'Куратор предпросмотра', moderator: 'Модератор предпросмотра', admin: 'Администратор предпросмотра' };
    var user = { id: 'preview-' + role, email: role + '-preview@example.invalid', name: titles[role], role: role, preview: true };
    writeSession(PREVIEW_USER, user); return user;
  }
  function getUser() { return readSession(PREVIEW_USER, null) || readSession(SESSION_CACHE, null); }
  function setCachedUser(user) { if (user) writeSession(SESSION_CACHE, user); else sessionStorage.removeItem(SESSION_CACHE); }
  function isAuthenticated() { return Boolean(getUser() && getUser().email); }
  function roleTitle(role) { return role === 'admin' ? 'администратор' : role === 'moderator' ? 'модератор' : role === 'curator' ? 'куратор' : 'участник'; }
  function canSwitchRoleForTesting(user) { var current = user || getUser(); return Boolean(current && current.role === 'admin' && !current.testRole); }
  function switchRoleForTesting(role) {
    if (!['participant', 'curator', 'moderator', 'admin'].includes(role)) return null;
    var current = getUser(); var original = readSession(ROLE_TEST_ORIGINAL, null) || current;
    if (!original || original.role !== 'admin') return null;
    writeSession(ROLE_TEST_ORIGINAL, original);
    var switched = Object.assign({}, original, { role: role, testRole: role, originalRole: 'admin', name: (original.name || original.email || 'Администратор') + ' (режим: ' + roleTitle(role) + ')' });
    setCachedUser(switched); return switched;
  }
  function applyRoleTest(user) {
    var original = readSession(ROLE_TEST_ORIGINAL, null); var cached = readSession(SESSION_CACHE, null); var role = cached && cached.testRole;
    if (!user || !original || original.role !== 'admin' || !['participant', 'curator', 'moderator', 'admin'].includes(role)) return user;
    if (String(original.email).toLowerCase() !== String(user.email).toLowerCase()) return user;
    return Object.assign({}, user, { role: role, testRole: role, originalRole: 'admin', name: (original.name || original.email) + ' (режим: ' + roleTitle(role) + ')' });
  }
  async function refreshUser() {
    var preview = readSession(PREVIEW_USER, null); if (preview) return preview; if (backendUnavailableHere()) return getUser();
    try {
      var response = await fetch(api('/api/auth/me'), { credentials: 'include', cache: 'no-store' });
      if (!response.ok) { if (response.status === 401 || response.status === 403) setCachedUser(null); return getUser(); }
      var data = await response.json(); var user = applyRoleTest(data.user || null); setCachedUser(user); return user;
    } catch (_) { return getUser(); }
  }
  async function passwordRequest(path, payload) {
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api(path), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload || {}) });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) { var error = new Error(data.error || 'AUTH_FAILED'); error.status = response.status; throw error; }
    setCachedUser(data.user || null); return data.user || null;
  }
  function registerWithPassword(p) { return passwordRequest('/api/auth/password/register', { email: String(p && p.email || '').trim(), name: String(p && p.name || '').trim(), password: String(p && p.password || ''), passwordConfirm: String(p && p.passwordConfirm || '') }); }
  function signInWithPassword(p) { return passwordRequest('/api/auth/password/login', { email: String(p && p.email || '').trim(), password: String(p && p.password || '') }); }
  async function signOut() {
    if (!backendUnavailableHere()) { try { await fetch(api('/api/auth/logout'), { method: 'POST', credentials: 'include' }); } catch (_) {} }
    sessionStorage.removeItem(SESSION_CACHE); sessionStorage.removeItem(PREVIEW_USER); sessionStorage.removeItem(ROLE_TEST_ORIGINAL); courseCache = {}; requestsCache = [];
  }

  function courseForRole(role) { return role === 'curator' ? 'curator' : role === 'moderator' ? 'moderator' : 'participant'; }
  function previewCourse(course) { return { course: course, lessonsCompleted: true, completed: true, certificateUnlocked: true, score: 0, total: 0, attempts: 0, preview: true }; }
  async function refreshCourseStatus(course) {
    var user = getUser(); course = course || courseForRole(user && user.role); if (!user) throw new Error('AUTH_REQUIRED');
    if (user.preview) return (courseCache[course] = previewCourse(course));
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api('/api/education/status?course=' + encodeURIComponent(course)), { credentials: 'include', cache: 'no-store' });
    var data = await response.json().catch(function () { return {}; }); if (!response.ok) throw new Error(data.error || 'EDUCATION_STATUS_FAILED');
    courseCache[course] = data; return data;
  }
  function getCourseStatus(course) { var user = getUser(); course = course || courseForRole(user && user.role); return courseCache[course] || null; }
  function isCourseCompleted(course) { var user = getUser(); if (user && user.preview) return true; var status = getCourseStatus(course); return Boolean(status && status.completed); }
  async function coursePost(course, payload) {
    var user = getUser(); if (!user) throw new Error('AUTH_REQUIRED'); if (user.preview) return (courseCache[course] = previewCourse(course));
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api('/api/education/complete'), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ course: course }, payload || {})) });
    var data = await response.json().catch(function () { return {}; }); if (!response.ok) throw new Error(data.error || 'EDUCATION_COMPLETE_FAILED');
    courseCache[course] = Object.assign({}, courseCache[course] || {}, data); return courseCache[course];
  }
  function completeCourseLessons(course) { return coursePost(course, { stage: 'lessons' }); }
  function completeCourse(course, answers) { return coursePost(course, { stage: 'test', answers: answers || {} }); }
  function getEducationRecord() { return getCourseStatus('participant'); }
  function isEducationCompleted() { return isCourseCompleted('participant'); }
  async function refreshEducationStatus() { try { return Boolean((await refreshCourseStatus('participant')).completed); } catch (_) { return false; } }
  function completeEducation(result) { return completeCourse('participant', result && result.answers || {}); }
  function getModeratorTrainingRecord() { return getCourseStatus('moderator'); }
  function isModeratorTrainingCompleted() { var s = getCourseStatus('moderator'); return Boolean(s && s.lessonsCompleted); }
  function completeModeratorTraining() { return completeCourseLessons('moderator'); }
  function getModeratorExamRecord() { return getCourseStatus('moderator'); }
  function isModeratorExamCompleted() { return isCourseCompleted('moderator'); }
  function completeModeratorExam(result) { return completeCourse('moderator', result && result.answers || {}); }

  function mergeRequest(request) {
    if (!request || !request.id) return request; var index = requestsCache.findIndex(function (item) { return item.id === request.id; });
    if (index >= 0) requestsCache[index] = request; else requestsCache.unshift(request);
    requestsCache.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); }); return request;
  }
  async function requestAction(action, payload) {
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api('/api/requests/list'), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({}, payload || {}, { action: action })) });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) { var error = new Error(data.error || 'REQUESTS_API_FAILED'); error.status = response.status; throw error; }
    if (data.request) mergeRequest(data.request); return data;
  }
  async function refreshRequests(scope) {
    var user = getUser(); if (!user) throw new Error('AUTH_REQUIRED'); if (user.preview) return requestsCache; if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api('/api/requests/list?scope=' + (scope === 'all' ? 'all' : 'mine')), { credentials: 'include', cache: 'no-store' });
    var data = await response.json().catch(function () { return {}; }); if (!response.ok) throw new Error(data.error || 'REQUESTS_API_FAILED');
    requestsCache = Array.isArray(data.requests) ? data.requests : []; return requestsCache;
  }
  function getAllRequests() { return requestsCache.slice(); }
  function getMyRequests() { var user = getUser(); return user ? requestsCache.filter(function (item) { return item.userId === user.id || item.userEmail === user.email; }) : []; }
  function getRequestById(id) { return requestsCache.find(function (item) { return item.id === id; }) || null; }
  function isRequestPublished(item) { return Boolean(item && item.status === 'published'); }
  function getFirstApprovedRequest() { return getMyRequests().find(isRequestPublished) || null; }
  function hasApprovedContribution() { return Boolean(getFirstApprovedRequest()); }
  async function createRequest(data) { return (await requestAction('create', data)).request; }
  function updateRequest(id, patch) { var item = getRequestById(id); return item ? mergeRequest(Object.assign({}, item, patch || {})) : null; }
  async function saveRequestUpdate(id, patch) { return (await requestAction('moderate', { id: id, patch: patch })).request; }
  async function saveRequestLandmarks(id, landmarks) { return (await requestAction('save_landmarks', { id: id, landmarks: landmarks })).request; }
  async function startRequestAnalysis(id) { return requestAction('start_analysis', { id: id }); }
  async function finishRequestAnalysis(id) { return (await requestAction('finish_analysis', { id: id })).request; }
  async function publishRequest(id) { return (await requestAction('publish', { id: id })).request; }

  async function getParticipationContext() {
    if (getUser() && getUser().preview) return { profile: getUser(), memberships: [], projects: [], objects: [] };
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api('/api/requests/list?scope=participation'), { credentials: 'include', cache: 'no-store' }); var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'PARTICIPATION_LOAD_FAILED'); return data;
  }
  async function getCuratorDashboard() {
    if (getUser() && getUser().preview) return { organizations: [], projects: [], objects: [], members: [], assignments: [], requests: [] };
    if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED');
    var response = await fetch(api('/api/requests/list?scope=curator'), { credentials: 'include', cache: 'no-store' }); var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'CURATOR_DASHBOARD_FAILED'); return data;
  }

  async function uploadObservationPhotos(treeFile, leafFiles) {
    var leaves = Array.from(leafFiles || []); var descriptors = [{ clientId: 'tree', kind: 'tree', file: treeFile }].concat(leaves.map(function (file, index) { return { clientId: 'leaf-' + index, kind: 'leaf', file: file }; }));
    var preparedResponse = await requestAction('prepare_uploads', { files: descriptors.map(function (item) { return { clientId: item.clientId, kind: item.kind, size: item.file.size, type: item.file.type }; }) });
    var prepared = Array.isArray(preparedResponse.uploads) ? preparedResponse.uploads : []; if (prepared.length !== descriptors.length) throw new Error('UPLOAD_PREPARATION_FAILED');
    var cursor = 0;
    async function worker() { while (cursor < prepared.length) { var target = prepared[cursor++]; var source = descriptors.find(function (item) { return item.clientId === target.clientId; }); if (!source) throw new Error('UPLOAD_PREPARATION_FAILED'); var upload = await fetch(target.signedUrl, { method: 'PUT', headers: { 'content-type': source.file.type, 'x-upsert': 'false' }, body: source.file }); if (!upload.ok) throw new Error('PHOTO_UPLOAD_FAILED'); } }
    await Promise.all([worker(), worker(), worker()]);
    function metadata(item) { var source = descriptors.find(function (d) { return d.clientId === item.clientId; }); var meta = source.file._ecoMeta || {}; return { name: source.file.name, size: source.file.size, type: source.file.type, path: item.path, url: item.publicUrl, bgLight: meta.bgLight, sha256: meta.sha256 || '', imageWidth: meta.imageWidth || 0, imageHeight: meta.imageHeight || 0, precheck: meta.precheck || null }; }
    return { treePhoto: metadata(prepared.find(function (item) { return item.clientId === 'tree'; })), files: prepared.filter(function (item) { return item.kind === 'leaf'; }).map(metadata) };
  }

  async function setUserRole(email, role, options) {
    options = options || {}; if (backendUnavailableHere()) throw new Error('BACKEND_NOT_CONFIGURED'); var payload = { email: String(email || '').trim(), role: String(role || '').trim() }; if ('blocked' in options) payload.blocked = options.blocked === true;
    var response = await fetch(api('/api/admin/users/role'), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); var data = await response.json().catch(function () { return {}; }); if (!response.ok) throw new Error(data.error || 'ROLE_UPDATE_FAILED'); return data.user || null;
  }
  async function requireAuthAsync(options) {
    options = options || {}; var user = getUser(); if (!backendUnavailableHere()) user = await refreshUser() || user; if (user && user.email) return user; if (options.redirect === false) return null;
    var current = (location.pathname.split('/').pop() || 'index.html') + (location.search || ''); location.replace('account.html?next=' + encodeURIComponent(current)); return null;
  }
  if (previewAvailable()) { var previewRole = new URLSearchParams(location.search).get('preview'); if (previewRole) setPreview(previewRole); }

  window.EcoAuth = {
    getUser: getUser, refreshUser: refreshUser, isAuthenticated: isAuthenticated, registerWithPassword: registerWithPassword, signInWithPassword: signInWithPassword, signOut: signOut,
    startPreview: setPreview, previewAvailable: previewAvailable, canSwitchRoleForTesting: canSwitchRoleForTesting, switchRoleForTesting: switchRoleForTesting,
    courseForRole: courseForRole, refreshCourseStatus: refreshCourseStatus, getCourseStatus: getCourseStatus, isCourseCompleted: isCourseCompleted, completeCourseLessons: completeCourseLessons, completeCourse: completeCourse,
    isEducationCompleted: isEducationCompleted, getEducationRecord: getEducationRecord, completeEducation: completeEducation, refreshEducationStatus: refreshEducationStatus,
    getModeratorTrainingRecord: getModeratorTrainingRecord, isModeratorTrainingCompleted: isModeratorTrainingCompleted, completeModeratorTraining: completeModeratorTraining, getModeratorExamRecord: getModeratorExamRecord, isModeratorExamCompleted: isModeratorExamCompleted, completeModeratorExam: completeModeratorExam,
    refreshRequests: refreshRequests, getAllRequests: getAllRequests, getMyRequests: getMyRequests, getRequestById: getRequestById, getFirstApprovedRequest: getFirstApprovedRequest, hasApprovedContribution: hasApprovedContribution, isRequestPublished: isRequestPublished,
    createRequest: createRequest, updateRequest: updateRequest, saveRequestUpdate: saveRequestUpdate, saveRequestLandmarks: saveRequestLandmarks, startRequestAnalysis: startRequestAnalysis, finishRequestAnalysis: finishRequestAnalysis, publishRequest: publishRequest,
    getParticipationContext: getParticipationContext, getCuratorDashboard: getCuratorDashboard,
    saveProfileCity: function (city) { return requestAction('save_profile', { city: city }); }, joinOrganization: function (code) { return requestAction('join_organization', { code: code }); }, leaveOrganization: function (organizationId) { return requestAction('leave_organization', { organizationId: organizationId }); },
    createOrganization: function (data) { return requestAction('create_organization', data); }, createMonitoringProject: function (data) { return requestAction('create_project', data); }, createMonitoringObject: function (data) { return requestAction('create_object', data); }, assignMonitoringObject: function (data) { return requestAction('assign_object', data); },
    uploadObservationPhotos: uploadObservationPhotos, setUserRole: setUserRole,
    openCertificatePlaceholder: function () { return { available: false, message: 'Обучение пройдено. Сертификат разблокирован, но макет ещё не добавлен.' }; }, openVolunteerCertificate: function () { return false; }, openModeratorCertificate: function () { return false; }, saveFeedback: function () { return true; },
    requireAuthAsync: requireAuthAsync, isPreview: function () { return Boolean(readSession(PREVIEW_USER, null)); }
  };
})();
