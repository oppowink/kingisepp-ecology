'use strict';

function requestTable() {
  return process.env.SUPABASE_REQUEST_TABLE || 'monitoring_requests';
}

function requests(admin) {
  return admin.from(requestTable());
}

function toClientRequest(row) {
  return {
    id: row.id,
    userId: row.user_id || '',
    userEmail: row.user_email || '',
    userName: row.user_name || '',
    title: row.title || '',
    location: row.location || '',
    coordinates: row.coordinates || '',
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    collectionDate: row.collection_date || '',
    comment: row.comment || '',
    files: Array.isArray(row.files) ? row.files : [],
    treePhoto: row.tree_photo || null,
    treeCount: Number(row.tree_count || 1),
    leafCount: Number(row.leaf_count || 30),
    sourceType: row.source_type || 'own',
    organizationId: row.organization_id || null,
    projectId: row.project_id || null,
    objectId: row.object_id || null,
    territoryType: row.territory_type || '',
    landUse: row.land_use || '',
    nearbySources: row.nearby_sources || '',
    roadDistanceM: row.road_distance_m === null || row.road_distance_m === undefined ? null : Number(row.road_distance_m),
    trafficIntensity: row.traffic_intensity || '',
    surfaceCover: row.surface_cover || '',
    weatherConditions: row.weather_conditions || '',
    treeSpecies: row.tree_species || 'Берёза повислая',
    trunkDiameterCm: row.trunk_diameter_cm === null || row.trunk_diameter_cm === undefined ? null : Number(row.trunk_diameter_cm),
    treeHeightEstimateM: row.tree_height_estimate_m === null || row.tree_height_estimate_m === undefined ? null : Number(row.tree_height_estimate_m),
    treeCondition: row.tree_condition || '',
    treeDamageNotes: row.tree_damage_notes || '',
    backgroundFlags: Array.isArray(row.background_flags) ? row.background_flags : [],
    aiResult: row.ai_result || null,
    status: row.status || 'pending_human',
    humanStatus: row.human_status || 'pending',
    aiStatus: row.ai_status || 'pending',
    moderationReason: row.moderation_reason || '',
    moderationChecklist: Array.isArray(row.moderation_checklist) ? row.moderation_checklist : [],
    moderatedAt: row.moderated_at || null,
    aiCheckedAt: row.ai_checked_at || null,
    approvedAt: row.approved_at || null,
    publishedAt: row.published_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function toDbInsert(input, user) {
  const now = new Date().toISOString();
  return {
    id: input.id,
    user_id: user.id,
    user_email: user.email,
    user_name: user.name || user.email,
    title: input.title,
    location: input.location,
    coordinates: input.coordinates,
    latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : null,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : null,
    collection_date: input.collectionDate || null,
    comment: input.comment || '',
    files: Array.isArray(input.files) ? input.files : [],
    tree_photo: input.treePhoto || null,
    tree_count: Number(input.treeCount || 1),
    leaf_count: Number(input.leafCount || 30),
    source_type: input.sourceType || 'own',
    organization_id: input.organizationId || null,
    project_id: input.projectId || null,
    object_id: input.objectId || null,
    territory_type: input.territoryType || '',
    land_use: input.landUse || '',
    nearby_sources: input.nearbySources || '',
    road_distance_m: Number.isFinite(Number(input.roadDistanceM)) ? Number(input.roadDistanceM) : null,
    traffic_intensity: input.trafficIntensity || '',
    surface_cover: input.surfaceCover || '',
    weather_conditions: input.weatherConditions || '',
    tree_species: input.treeSpecies || 'Берёза повислая',
    trunk_diameter_cm: Number.isFinite(Number(input.trunkDiameterCm)) ? Number(input.trunkDiameterCm) : null,
    tree_height_estimate_m: Number.isFinite(Number(input.treeHeightEstimateM)) ? Number(input.treeHeightEstimateM) : null,
    tree_condition: input.treeCondition || '',
    tree_damage_notes: input.treeDamageNotes || '',
    background_flags: Array.isArray(input.backgroundFlags) ? input.backgroundFlags : [],
    ai_result: input.aiResult || null,
    status: 'pending_human',
    human_status: 'pending',
    ai_status: 'pending',
    moderation_reason: '',
    moderation_checklist: [],
    created_at: now,
    updated_at: now
  };
}

function toDbUpdate(patch) {
  const out = { updated_at: new Date().toISOString() };
  if (patch.status) out.status = patch.status;
  if (patch.humanStatus) out.human_status = patch.humanStatus;
  if (patch.aiStatus) out.ai_status = patch.aiStatus;
  if (patch.moderationReason !== undefined) out.moderation_reason = patch.moderationReason || '';
  if (Array.isArray(patch.moderationChecklist)) out.moderation_checklist = patch.moderationChecklist;
  if (patch.aiResult !== undefined) out.ai_result = patch.aiResult;
  if (patch.moderatedAt) out.moderated_at = patch.moderatedAt;
  if (patch.aiCheckedAt) out.ai_checked_at = patch.aiCheckedAt;
  if (patch.approvedAt) out.approved_at = patch.approvedAt;
  if (patch.publishedAt) out.published_at = patch.publishedAt;
  return out;
}

module.exports = {
  requestTable,
  requests,
  toClientRequest,
  toDbInsert,
  toDbUpdate
};
