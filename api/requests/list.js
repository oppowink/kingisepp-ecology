'use strict';

const crypto = require('crypto');
const { readSession } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');
const { profiles } = require('../../server/users');
const { requests, toClientRequest, toDbInsert, toDbUpdate } = require('../../server/requests');
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

const STATUSES = new Set(['pending_human', 'human_approved', 'published', 'rejected']);
const HUMAN_STATUSES = new Set(['pending', 'approved', 'rejected']);
const AI_STATUSES = new Set(['pending', 'checked', 'skipped']);
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
  return files.slice(0, 30).map(function (file) {
    return {
      name: safeText(file.name, 180), size: Number(file.size || 0), type: safeText(file.type, 80),
      bgLight: file.bgLight === true ? true : file.bgLight === false ? false : null,
      path: safeText(file.path, 500), url: safeText(file.url, 1200)
    };
  });
}

function cleanPhoto(file) {
  if (!file || typeof file !== 'object') return null;
  return {
    name: safeText(file.name, 180), size: Number(file.size || 0), type: safeText(file.type, 80),
    path: safeText(file.path, 500), url: safeText(file.url, 1200)
  };
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
    return res.end(JSON.stringify({ requests: (data || []).map(toClientRequest) }));
  }

  const currentUser = await requireCurrentUser(req, admin, 'id,email,name,role,city,blocked');
  if (scope === 'participation') {
    res.statusCode = 200;
    return res.end(JSON.stringify(await participantContext(admin, currentUser)));
  }
  if (scope === 'curator') {
    const dashboard = await curatorDashboard(admin, currentUser);
    dashboard.requests = (dashboard.requests || []).map(toClientRequest);
    res.statusCode = 200;
    return res.end(JSON.stringify(dashboard));
  }

  let query = requests(admin).select('*').order('created_at', { ascending: false });
  if (scope !== 'all' || !['moderator', 'admin'].includes(currentUser.role)) query = query.eq('user_id', currentUser.id);
  const { data, error } = await query;
  if (error) throw error;
  res.statusCode = 200;
  return res.end(JSON.stringify({ requests: (data || []).map(toClientRequest) }));
}

async function handleCreate(req, res, admin, body) {
  const currentUser = await requireCurrentUser(req, admin, 'id,email,name,role,city,blocked,education_completed');
  if (!currentUser.education_completed && !['moderator', 'admin'].includes(currentUser.role)) throw new Error('EDUCATION_REQUIRED');

  const files = cleanFileList(body.files);
  const treePhoto = cleanPhoto(body.treePhoto);
  const coordinates = safeText(body.coordinates, 80);
  const parsedCoordinates = splitCoordinates(coordinates);
  const sourceType = SOURCE_TYPES.has(body.sourceType) ? body.sourceType : 'own';
  let organizationId = body.organizationId || null;
  let projectId = body.projectId || null;
  let objectId = body.objectId || null;

  if (sourceType !== 'own') {
    const context = await participantContext(admin, currentUser);
    const selectedObject = (context.objects || []).find(function (item) { return item.id === objectId; });
    if (!selectedObject) throw new Error('OBJECT_NOT_AVAILABLE');
    organizationId = selectedObject.organizationId;
    projectId = selectedObject.projectId;
    objectId = selectedObject.id;
  } else {
    organizationId = null; projectId = null; objectId = null;
  }

  const payload = {
    id: 'ECO-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-7),
    title: safeText(body.title, 180), location: safeText(body.location, 500), coordinates: coordinates,
    latitude: parsedCoordinates.latitude, longitude: parsedCoordinates.longitude,
    collectionDate: safeText(body.collectionDate, 20), comment: safeText(body.comment, 2000),
    files: files, treePhoto: treePhoto, treeCount: 1, leafCount: files.length,
    sourceType: sourceType, organizationId: organizationId, projectId: projectId, objectId: objectId,
    territoryType: safeText(body.territoryType, 100), landUse: safeText(body.landUse, 300),
    nearbySources: safeText(body.nearbySources, 1000), roadDistanceM: body.roadDistanceM,
    trafficIntensity: safeText(body.trafficIntensity, 40), surfaceCover: safeText(body.surfaceCover, 100),
    weatherConditions: safeText(body.weatherConditions, 300),
    treeSpecies: safeText(body.treeSpecies, 100) || 'Берёза повислая',
    trunkDiameterCm: body.trunkDiameterCm, treeHeightEstimateM: body.treeHeightEstimateM,
    treeCondition: safeText(body.treeCondition, 100), treeDamageNotes: safeText(body.treeDamageNotes, 1000),
    backgroundFlags: Array.isArray(body.backgroundFlags) ? body.backgroundFlags.slice(0, 30) : [],
    aiResult: body.aiResult || null
  };

  if (!payload.title || !payload.location || !payload.coordinates || !payload.collectionDate) throw new Error('REQUIRED_FIELDS_MISSING');
  if (!validCoordinates(payload.coordinates)) throw new Error('INVALID_COORDINATES');
  if (files.length !== 30) throw new Error('PHOTO_COUNT_REQUIRED');
  if (!treePhoto) throw new Error('TREE_PHOTO_REQUIRED');

  const { data, error } = await requests(admin).insert(toDbInsert(payload, currentUser)).select('*').single();
  if (error) throw error;
  res.statusCode = 201;
  return res.end(JSON.stringify({ request: toClientRequest(data) }));
}

async function handleModerate(req, res, admin, body) {
  const currentUser = await requireCurrentUser(req, admin, 'id,role,blocked');
  if (!['moderator', 'admin'].includes(currentUser.role)) throw new Error('MODERATOR_REQUIRED');
  const id = safeText(body.id, 80);
  const patch = body.patch && typeof body.patch === 'object' ? body.patch : {};
  if (!id) throw new Error('REQUEST_ID_REQUIRED');
  if (!validPatch(patch)) throw new Error('INVALID_MODERATION_PATCH');
  const { data, error } = await requests(admin).update(toDbUpdate(patch)).eq('id', id).select('*').single();
  if (error) throw error;
  res.statusCode = 200;
  return res.end(JSON.stringify({ request: toClientRequest(data) }));
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
  const files = Array.isArray(body.files) ? body.files.slice(0, 31) : [];
  if (!files.length || files.length > 31) throw new Error('INVALID_UPLOAD_BATCH');
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
  if (['ACCOUNT_BLOCKED', 'EDUCATION_REQUIRED', 'MODERATOR_REQUIRED', 'CURATOR_REQUIRED'].includes(code)) return 403;
  if (['ORGANIZATION_NOT_FOUND', 'MEMBER_NOT_FOUND', 'OBJECT_NOT_AVAILABLE', 'PROJECT_NOT_AVAILABLE'].includes(code)) return 404;
  if (/^(REQUIRED_|INVALID_|PHOTO_|TREE_|REQUEST_|UNKNOWN_)/.test(code)) return 400;
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
    if (body.action === 'prepare_uploads') return handlePrepareUploads(req, res, admin, body);
    return handleParticipationAction(req, res, admin, body);
  } catch (error) {
    const code = String(error && error.message || 'REQUESTS_API_FAILED');
    res.statusCode = statusForError(error);
    return res.end(JSON.stringify({ error: res.statusCode === 500 ? 'REQUESTS_API_FAILED' : code,
      message: process.env.NODE_ENV === 'production' ? undefined : code }));
  }
};
