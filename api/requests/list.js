'use strict';

const crypto = require('crypto');
const { readSession } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');
const { profiles } = require('../../server/users');
const { requests, toClientRequest, toDbInsert, toDbUpdate } = require('../../server/requests');
const { cleanLandmarkSets, isCompleteSet, calculateRequestFa } = require('../../server/fa-analysis');
const {
  participantContext,
  curatorDashboard,
  createOrganization,
  joinOrganization,
  leaveOrganization,
  createProject,
  createObject,
  assignObject
} = require('../../server/participation');

const STATUSES = new Set(['pending_human', 'needs_revision', 'human_approved', 'published', 'rejected']);
const HUMAN_STATUSES = new Set(['pending', 'needs_revision', 'approved', 'rejected']);
const AI_STATUSES = new Set(['pending', 'processing', 'checked', 'failed', 'skipped']);
const SOURCE_TYPES = new Set(['own', 'open_object', 'assigned_object']);
const PHOTO_BUCKET = 'monitoring-photos';
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function queryParam(req, name) {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get(name) || '';
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') {
      try { return resolve(req.body ? JSON.parse(req.body) : {}); } catch (error) { return reject(error); }
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(req.body)) {
      try { return resolve(req.body.length ? JSON.parse(req.body.toString('utf8')) : {}); } catch (error) { return reject(error); }
    }
    let raw = '';
    req.on('data', function (chunk) {
      raw += chunk;
      if (raw.length > 256000) return reject(new Error('BODY_TOO_LARGE'));
    });
    req.on('end', function () {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function safeText(value, max) { return String(value || '').trim().slice(0, max || 1000); }

function validCoordinates(value) {
  const parts = String(value || '').split(',').map(function (part) { return part.trim(); });
  if (parts.length !== 2) return false;
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function splitCoordinates(value) {
  const parts = String(value || '').split(',').map(function (part) { return Number(part.trim()); });
  return { latitude: parts[0], longitude: parts[1] };
}

function cleanFileList(files) {
  if (!Array.isArray(files)) return [];
  return files.slice(0, 120).map(function (file) {
    return {
      name: safeText(file.name, 180), size: Number(file.size || 0), type: safeText(file.type, 80),
      bgLight: file.bgLight === true ? true : file.bgLight === false ? false : null,
      sha256: /^[a-f0-9]{64}$/i.test(String(file.sha256 || '')) ? String(file.sha256).toLowerCase() : '',
      imageWidth: Math.max(0, Number(file.imageWidth || 0)), imageHeight: Math.max(0, Number(file.imageHeight || 0)),
      precheck: file.precheck && typeof file.precheck === 'object' ? file.precheck : null,
      path: safeText(file.path, 500), url: safeText(file.url, 1200)
    };
  });
}

function cleanPhoto(file) {
  if (!file || typeof file !== 'object') return null;
  return {
    name: safeText(file.name, 180), size: Number(file.size || 0), type: safeText(file.type, 80),
    sha256: /^[a-f0-9]{64}$/i.test(String(file.sha256 || '')) ? String(file.sha256).toLowerCase() : '',
    path: safeText(file.path, 500), url: safeText(file.url, 1200)
  };
}

function toPublicRequest(row) {
  const item = toClientRequest(row);
  return { id: item.id, title: item.title, location: item.location, coordinates: item.coordinates,
    latitude: item.latitude, longitude: item.longitude, collectionDate: item.collectionDate,
    treePhoto: item.treePhoto, files: (item.files || []).slice(0, 4), territoryType: item.territoryType,
    roadDistanceM: item.roadDistanceM, treeCondition: item.treeCondition, aiResult: item.aiResult,
    status: item.status, publishedAt: item.publishedAt };
}

async function hasPassedCourse(admin, userId, course) {
  const result = await admin.from('education_progress').select('passed').eq('user_id', userId).eq('course', course).maybeSingle();
  if (result.error) throw result.error;
  return Boolean(result.data && result.data.passed);
}
function radians(value) { return Number(value) * Math.PI / 180; }
function distanceMeters(aLat, aLng, bLat, bLng) {
  const dLat = radians(bLat - aLat); const dLng = radians(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function validPatch(patch) {
  if (!patch || typeof patch !== 'object') return false;
  if (patch.status && !STATUSES.has(patch.status)) return false;
  if (patch.humanStatus && !HUMAN_STATUSES.has(patch.humanStatus)) return false;
  if (patch.aiStatus && !AI_STATUSES.has(patch.aiStatus)) return false;
  return true;
}

async function currentProfile(admin, session, fields) {
  const { data, error } = await profiles(admin).select(fields || 'id,email,name,role,city,blocked').eq('id', session.sub).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function requireCurrentUser(req, admin, fields) {
  const session = readSession(req);
  if (!session) throw new Error('AUTH_REQUIRED');
  const user = await currentProfile(admin, session, fields);
  if (!user) throw new Error('AUTH_REQUIRED');
  if (user.blocked) throw new Error('ACCOUNT_BLOCKED');
  return user;
}

async function handleList(req, res, admin) {
  const scope = queryParam(req, 'scope');
  if (scope === 'published') {
    const { data, error } = await requests(admin).select('*').eq('status', 'published').order('published_at', { ascending: false });
    if (error) throw error;
    res.statusCode = 200;
    return res.end(JSON.stringify({ requests: (data || []).map(toPublicRequest) }));
  }

  const currentUser = await requireCurrentUser(req, admin, 'id,email,name,role,city,blocked');
  if (scope === 'participation') {
    res.statusCode = 200;
    return res.end(JSON.stringify(await participantContext(admin, currentUser)));
  }
  if (scope === 'curator') {
    if (currentUser.role !== 'admin' && !await hasPassedCourse(admin, currentUser.id, 'curator')) throw new Error('EDUCATION_REQUIRED');
    const dashboard = await curatorDashboard(admin, currentUser);
    dashboard.requests = (dashboard.requests || []).map(toClientRequest);
    res.statusCode = 200;
    return res.end(JSON.stringify(dashboard));
  }

  let query = requests(admin).select('*').order('created_at', { ascending: false });
  if (scope === 'all' && currentUser.role === 'moderator' && !await hasPassedCourse(admin, currentUser.id, 'moderator')) throw new Error('EDUCATION_REQUIRED');
  if (scope !== 'all' || !['moderator', 'admin'].includes(currentUser.role)) query = query.eq('user_id', currentUser.id);
  const { data, error } = await query;
  if (error) throw error;
  res.statusCode = 200;
  return res.end(JSON.stringify({ requests: (data || []).map(toClientRequest) }));
}

async function handleCreate(req, res, admin, body) {
  const currentUser = await requireCurrentUser(req, admin, 'id,email,name,role,city,blocked');
  if (currentUser.role !== 'participant') throw new Error('PARTICIPANT_REQUIRED');
  if (!await hasPassedCourse(admin, currentUser.id, 'participant')) throw new Error('EDUCATION_REQUIRED');

  if (!Array.isArray(body.trees) || body.trees.length < 2 || body.trees.length > 4) throw new Error('TREE_COUNT_REQUIRED');
  const trees = body.trees.map(function (tree) {
    return { treePhoto: cleanPhoto(tree.treePhoto), files: cleanFileList(tree.files),
      treeCondition: safeText(tree.treeCondition, 100), trunkDiameterCm: Number(tree.trunkDiameterCm),
      treeHeightEstimateM: Number(tree.treeHeightEstimateM), treeDamageNotes: safeText(tree.treeDamageNotes, 500) };
  });
  const files = trees.flatMap(function (tree) { return tree.files; });
  const treePhoto = trees[0] && trees[0].treePhoto;
  const landmarks = cleanLandmarkSets(body.landmarks, 120);
  const coordinates = safeText(body.coordinates, 80);
  const parsedCoordinates = splitCoordinates(coordinates);
  const sourceType = SOURCE_TYPES.has(body.sourceType) ? body.sourceType : 'own';
  let organizationId = body.organizationId || null;
  let projectId = body.projectId || null;
  let objectId = body.objectId || null;
  let selectedObject = null;

  if (sourceType !== 'own') {
    const context = await participantContext(admin, currentUser);
    selectedObject = (context.objects || []).find(function (item) { return item.id === objectId; });
    if (!selectedObject) throw new Error('OBJECT_NOT_AVAILABLE');
    organizationId = selectedObject.organizationId;
    projectId = selectedObject.projectId;
    objectId = selectedObject.id;
  } else {
    organizationId = null; projectId = null; objectId = null;
  }

  if (selectedObject && Number.isFinite(Number(selectedObject.centerLat)) && Number.isFinite(Number(selectedObject.centerLng)) && Number(selectedObject.radiusM) > 0) {
    const distance = distanceMeters(parsedCoordinates.latitude, parsedCoordinates.longitude, Number(selectedObject.centerLat), Number(selectedObject.centerLng));
    if (distance > Number(selectedObject.radiusM)) throw new Error('OUTSIDE_ASSIGNED_TERRITORY');
  }

  const leafHashes = files.map(function (file) { return file.sha256; });
  const photos = trees.flatMap(function (tree) { return [{ kind: 'tree', file: tree.treePhoto }].concat(tree.files.map(function (file) { return { kind: 'leaf', file: file }; })); });
  const allHashes = photos.map(function (photo) { return photo.file && photo.file.sha256; }).filter(Boolean);
  if (allHashes.length !== photos.length || new Set(allHashes).size !== allHashes.length) throw new Error('DUPLICATE_PHOTO');
  const duplicateQuery = await admin.from('observation_file_hashes').select('sha256,request_id').in('sha256', allHashes);
  if (duplicateQuery.error) throw duplicateQuery.error;
  if ((duplicateQuery.data || []).length) throw new Error('DUPLICATE_PHOTO');

  const integrityFlags = [];
  const deviceLatitude = Number(body.deviceLatitude); const deviceLongitude = Number(body.deviceLongitude);
  if (!Number.isFinite(deviceLatitude) || !Number.isFinite(deviceLongitude)) integrityFlags.push('gps_not_shared');
  else if (distanceMeters(parsedCoordinates.latitude, parsedCoordinates.longitude, deviceLatitude, deviceLongitude) > 250) integrityFlags.push('device_far_from_point');

  const payload = {
    id: 'ECO-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-7),
    title: safeText(body.title, 180), location: safeText(body.location, 500), coordinates: coordinates,
    latitude: parsedCoordinates.latitude, longitude: parsedCoordinates.longitude,
    collectionDate: safeText(body.collectionDate, 20), comment: safeText(body.comment, 2000),
    files: files, trees: trees, treePhoto: treePhoto, treeCount: trees.length, leafCount: files.length,
    sourceType: sourceType, organizationId: organizationId, projectId: projectId, objectId: objectId,
    territoryType: safeText(body.territoryType, 100), landUse: safeText(body.landUse, 300),
    nearbySources: safeText(body.nearbySources, 1000), roadDistanceM: body.roadDistanceM,
    trafficIntensity: safeText(body.trafficIntensity, 40), surfaceCover: safeText(body.surfaceCover, 100),
    weatherConditions: safeText(body.weatherConditions, 300),
    treeSpecies: safeText(body.treeSpecies, 100) || 'Берёза повислая',
    trunkDiameterCm: body.trunkDiameterCm, treeHeightEstimateM: body.treeHeightEstimateM,
    treeCondition: safeText(body.treeCondition, 100), treeDamageNotes: safeText(body.treeDamageNotes, 1000),
    backgroundFlags: Array.isArray(body.backgroundFlags) ? body.backgroundFlags.slice(0, 120) : [],
    participantChecklist: Array.isArray(body.participantChecklist) ? body.participantChecklist.slice(0, 12).map(Boolean) : [],
    landmarks: landmarks, leafHashes: leafHashes,
    photoPrecheck: body.photoPrecheck && typeof body.photoPrecheck === 'object' ? body.photoPrecheck : {},
    integrityCode: safeText(body.integrityCode, 20).toUpperCase(), capturedAt: body.capturedAt || new Date().toISOString(),
    gpsAccuracyM: body.gpsAccuracyM, deviceLatitude: deviceLatitude, deviceLongitude: deviceLongitude,
    integrityFlags: integrityFlags,
    aiResult: body.aiResult || null
  };

  if (!payload.title || !payload.location || !payload.coordinates || !payload.collectionDate) throw new Error('REQUIRED_FIELDS_MISSING');
  if (!validCoordinates(payload.coordinates)) throw new Error('INVALID_COORDINATES');
  if (trees.length < 2 || trees.length > 4) throw new Error('TREE_COUNT_REQUIRED');
  if (trees.some(function (tree) { return !tree.treePhoto || tree.files.length < 10 || tree.files.length > 30; })) throw new Error('PHOTO_COUNT_REQUIRED');
  if (photos.some(function (photo) { return !photo.file.path.startsWith(currentUser.id + '/') || !photo.file.sha256; })) throw new Error('INVALID_PHOTO_REFERENCE');
  if (files.some(function (file) { return file.bgLight !== true || file.imageWidth < 500 || file.imageHeight < 500; })) throw new Error('PHOTO_PRECHECK_REQUIRED');
  if (!/^[A-Z0-9]{6}$/.test(payload.integrityCode)) throw new Error('INTEGRITY_CODE_REQUIRED');
  if (payload.participantChecklist.length < 6 || payload.participantChecklist.some(function (value) { return !value; })) throw new Error('CHECKLIST_REQUIRED');
  if (landmarks.length !== files.length || landmarks.some(function (set) { return !isCompleteSet(set); })) throw new Error('LANDMARKS_REQUIRED');
  if (landmarks.some(function (set, index) {
    const expectedIndex = trees.findIndex(function (tree) { return tree.files.some(function (file) { return file.sha256 === files[index].sha256; }); });
    return set.fileHash !== files[index].sha256 || set.treeIndex !== expectedIndex;
  })) throw new Error('LANDMARKS_REQUIRED');
  if (!payload.photoPrecheck || payload.photoPrecheck.passed !== true) throw new Error('PHOTO_PRECHECK_REQUIRED');

  const { data, error } = await requests(admin).insert(toDbInsert(payload, currentUser)).select('*').single();
  if (error) throw error;
  const hashRows = photos.map(function (photo) { return { sha256: photo.file.sha256, request_id: data.id, user_id: currentUser.id, file_kind: photo.kind }; });
  const hashInsert = await admin.from('observation_file_hashes').insert(hashRows);
  if (hashInsert.error) throw hashInsert.error;
  res.statusCode = 201;
  return res.end(JSON.stringify({ request: toClientRequest(data) }));
}

async function handleModerate(req, res, admin, body) {
  const currentUser = await requireCurrentUser(req, admin, 'id,role,blocked');
  if (!['moderator', 'admin'].includes(currentUser.role)) throw new Error('MODERATOR_REQUIRED');
  if (currentUser.role === 'moderator' && !await hasPassedCourse(admin, currentUser.id, 'moderator')) throw new Error('EDUCATION_REQUIRED');
  const id = safeText(body.id, 80);
  const patch = body.patch && typeof body.patch === 'object' ? body.patch : {};
  if (!id) throw new Error('REQUEST_ID_REQUIRED');
  if (!validPatch(patch)) throw new Error('INVALID_MODERATION_PATCH');
  if (patch.status && !['pending_human', 'needs_revision', 'human_approved', 'rejected'].includes(patch.status)) throw new Error('INVALID_MODERATION_PATCH');
  if (patch.aiStatus || patch.aiResult || patch.publishedAt) throw new Error('INVALID_MODERATION_PATCH');
  const safePatch = { status: patch.status, humanStatus: patch.humanStatus,
    moderationReason: safeText(patch.moderationReason, 1000),
    moderationChecklist: Array.isArray(patch.moderationChecklist) ? patch.moderationChecklist.slice(0, 20).map(Boolean) : undefined,
    moderatedAt: patch.moderatedAt || new Date().toISOString(),
    returnedAt: patch.status === 'needs_revision' ? new Date().toISOString() : undefined };
  const { data, error } = await requests(admin).update(toDbUpdate(safePatch)).eq('id', id).select('*').single();
  if (error) throw error;
  const event = await admin.from('moderation_events').insert({ request_id: id, actor_id: currentUser.id,
    action: patch.status || 'checklist_updated', details: { reason: safePatch.moderationReason || '', checklist: safePatch.moderationChecklist || [] } });
  if (event.error) throw event.error;
  res.statusCode = 200;
  return res.end(JSON.stringify({ request: toClientRequest(data) }));
}

async function requireModerator(req, admin) {
  const user = await requireCurrentUser(req, admin, 'id,role,blocked');
  if (!['moderator', 'admin'].includes(user.role)) throw new Error('MODERATOR_REQUIRED');
  if (user.role === 'moderator' && !await hasPassedCourse(admin, user.id, 'moderator')) throw new Error('EDUCATION_REQUIRED');
  return user;
}

async function handleSaveLandmarks(req, res, admin, body) {
  const user = await requireModerator(req, admin); const id = safeText(body.id, 80);
  const landmarks = cleanLandmarkSets(body.landmarks, 120);
  if (!id) throw new Error('REQUEST_ID_REQUIRED');
  if (!landmarks.length || landmarks.some(function (set) { return !isCompleteSet(set); })) throw new Error('LANDMARKS_REQUIRED');
  const original = await requests(admin).select('files,trees').eq('id', id).maybeSingle();
  if (original.error) throw original.error;
  if (!original.data) throw new Error('REQUEST_NOT_FOUND');
  const originalFiles = original.data.files || [];
  if (landmarks.length !== originalFiles.length || landmarks.some(function (set, index) {
    const treeIndex = (original.data.trees || []).findIndex(function (tree) { return (tree.files || []).some(function (file) { return file.sha256 === originalFiles[index].sha256; }); });
    return set.fileHash !== originalFiles[index].sha256 || set.treeIndex !== treeIndex;
  })) throw new Error('LANDMARKS_REQUIRED');
  const update = await requests(admin).update({ landmarks: landmarks, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (update.error) throw update.error;
  const event = await admin.from('moderation_events').insert({ request_id: id, actor_id: user.id, action: 'landmarks_corrected', details: { leafCount: landmarks.length } });
  if (event.error) throw event.error;
  res.statusCode = 200; return res.end(JSON.stringify({ request: toClientRequest(update.data) }));
}

async function handleStartAnalysis(req, res, admin, body) {
  const user = await requireModerator(req, admin); const id = safeText(body.id, 80);
  const found = await requests(admin).select('*').eq('id', id).maybeSingle();
  if (found.error) throw found.error; if (!found.data) throw new Error('REQUEST_NOT_FOUND');
  if (found.data.human_status !== 'approved') throw new Error('HUMAN_APPROVAL_REQUIRED');
  const landmarks = cleanLandmarkSets(found.data.landmarks, 120);
  if (!landmarks.length || landmarks.some(function (set) { return !isCompleteSet(set); })) throw new Error('LANDMARKS_REQUIRED');
  if (landmarks.length !== Number(found.data.leaf_count)) throw new Error('LANDMARKS_REQUIRED');
  const now = new Date().toISOString();
  const update = await requests(admin).update({ ai_status: 'processing', analysis_started_at: now, updated_at: now }).eq('id', id).select('*').single();
  if (update.error) throw update.error;
  const event = await admin.from('moderation_events').insert({ request_id: id, actor_id: user.id, action: 'analysis_started', details: {} });
  if (event.error) throw event.error;
  res.statusCode = 202; return res.end(JSON.stringify({ request: toClientRequest(update.data), readyAfterMs: 8000 }));
}

async function handleFinishAnalysis(req, res, admin, body) {
  const user = await requireModerator(req, admin); const id = safeText(body.id, 80);
  const found = await requests(admin).select('*').eq('id', id).maybeSingle();
  if (found.error) throw found.error; if (!found.data) throw new Error('REQUEST_NOT_FOUND');
  if (found.data.ai_status !== 'processing' || !found.data.analysis_started_at) throw new Error('ANALYSIS_NOT_STARTED');
  if (Date.now() - new Date(found.data.analysis_started_at).getTime() < 8000) throw new Error('ANALYSIS_STILL_RUNNING');
  const result = calculateRequestFa(found.data.landmarks); const now = new Date().toISOString();
  const update = await requests(admin).update({ ai_status: 'checked', ai_result: result, ai_checked_at: now, updated_at: now }).eq('id', id).select('*').single();
  if (update.error) throw update.error;
  const event = await admin.from('moderation_events').insert({ request_id: id, actor_id: user.id, action: 'analysis_completed', details: { meanFa: result.meanFa, validLeafCount: result.validLeafCount, engine: result.engine } });
  if (event.error) throw event.error;
  res.statusCode = 200; return res.end(JSON.stringify({ request: toClientRequest(update.data) }));
}

async function handlePublish(req, res, admin, body) {
  const user = await requireModerator(req, admin); const id = safeText(body.id, 80);
  const found = await requests(admin).select('id,human_status,ai_status').eq('id', id).maybeSingle();
  if (found.error) throw found.error; if (!found.data) throw new Error('REQUEST_NOT_FOUND');
  if (found.data.human_status !== 'approved' || found.data.ai_status !== 'checked') throw new Error('FINAL_REVIEW_REQUIRED');
  const now = new Date().toISOString();
  const update = await requests(admin).update({ status: 'published', published_at: now, approved_at: now, updated_at: now }).eq('id', id).select('*').single();
  if (update.error) throw update.error;
  const event = await admin.from('moderation_events').insert({ request_id: id, actor_id: user.id, action: 'published', details: {} });
  if (event.error) throw event.error;
  res.statusCode = 200; return res.end(JSON.stringify({ request: toClientRequest(update.data) }));
}

function photoExtension(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/heic') return 'heic';
  if (type === 'image/heif') return 'heif';
  return 'jpg';
}

async function handlePrepareUploads(req, res, admin, body) {
  const currentUser = await requireCurrentUser(req, admin, 'id,role,blocked');
  const files = Array.isArray(body.files) ? body.files.slice(0, 25) : [];
  if (!files.length || body.files.length > 25) throw new Error('INVALID_UPLOAD_BATCH');
  files.forEach(function (file) {
    if (!PHOTO_TYPES.has(String(file.type || ''))) throw new Error('INVALID_PHOTO_TYPE');
    if (Number(file.size || 0) <= 0 || Number(file.size || 0) > 12582912) throw new Error('PHOTO_TOO_LARGE');
  });

  const batchId = crypto.randomUUID();
  const prepared = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const kind = file.kind === 'tree' ? 'tree' : 'leaf';
    const path = currentUser.id + '/' + batchId + '/' + kind + '-' + String(index + 1).padStart(2, '0') + '.' + photoExtension(file.type);
    const signed = await admin.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (signed.error) throw signed.error;
    const publicResult = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    prepared.push({ clientId: safeText(file.clientId, 80), kind: kind, path: path,
      signedUrl: signed.data.signedUrl, token: signed.data.token || '', publicUrl: publicResult.data.publicUrl });
  }
  res.statusCode = 200;
  return res.end(JSON.stringify({ uploads: prepared }));
}

async function handleParticipationAction(req, res, admin, body) {
  const currentUser = await requireCurrentUser(req, admin, 'id,email,name,role,city,blocked');
  let result;
  if (body.action === 'save_profile') {
    const city = safeText(body.city, 100);
    const update = await profiles(admin).update({ city: city || null, updated_at: new Date().toISOString() })
      .eq('id', currentUser.id).select('id,email,name,role,city').single();
    if (update.error) throw update.error;
    result = { profile: update.data };
  } else if (body.action === 'join_organization') {
    result = await joinOrganization(admin, currentUser, body.code);
  } else if (body.action === 'leave_organization') {
    result = { left: await leaveOrganization(admin, currentUser, safeText(body.organizationId, 60)) };
  } else if (body.action === 'create_organization') {
    result = { organization: await createOrganization(admin, currentUser, body) };
  } else if (body.action === 'create_project') {
    result = { project: await createProject(admin, currentUser, body) };
  } else if (body.action === 'create_object') {
    result = { object: await createObject(admin, currentUser, body) };
  } else if (body.action === 'assign_object') {
    result = { assignment: await assignObject(admin, currentUser, body) };
  } else {
    throw new Error('UNKNOWN_REQUEST_ACTION');
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(result));
}

function statusForError(error) {
  const code = String(error && error.message || '');
  if (code === 'AUTH_REQUIRED') return 401;
  if (['ACCOUNT_BLOCKED', 'EDUCATION_REQUIRED', 'MODERATOR_REQUIRED', 'CURATOR_REQUIRED', 'PARTICIPANT_REQUIRED'].includes(code)) return 403;
  if (['ORGANIZATION_NOT_FOUND', 'MEMBER_NOT_FOUND', 'OBJECT_NOT_AVAILABLE', 'PROJECT_NOT_AVAILABLE', 'REQUEST_NOT_FOUND'].includes(code)) return 404;
  if (code === 'ANALYSIS_STILL_RUNNING') return 409;
  if (/^(REQUIRED_|INVALID_|PHOTO_|TREE_|REQUEST_|UNKNOWN_|DUPLICATE_|LANDMARKS_|CHECKLIST_|INTEGRITY_|OUTSIDE_|HUMAN_|ANALYSIS_|FINAL_)/.test(code)) return 400;
  return 500;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!['GET', 'POST'].includes(req.method)) {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
  }
  try {
    const admin = getAdminClient();
    if (req.method === 'GET') return handleList(req, res, admin);
    const body = await readBody(req);
    if (body.action === 'create') return handleCreate(req, res, admin, body);
    if (body.action === 'moderate') return handleModerate(req, res, admin, body);
    if (body.action === 'save_landmarks') return handleSaveLandmarks(req, res, admin, body);
    if (body.action === 'start_analysis') return handleStartAnalysis(req, res, admin, body);
    if (body.action === 'finish_analysis') return handleFinishAnalysis(req, res, admin, body);
    if (body.action === 'publish') return handlePublish(req, res, admin, body);
    if (body.action === 'prepare_uploads') return handlePrepareUploads(req, res, admin, body);
    return handleParticipationAction(req, res, admin, body);
  } catch (error) {
    const code = String(error && error.message || 'REQUESTS_API_FAILED');
    res.statusCode = statusForError(error);
    return res.end(JSON.stringify({ error: res.statusCode === 500 ? 'REQUESTS_API_FAILED' : code,
      message: process.env.NODE_ENV === 'production' ? undefined : code }));
  }
};
