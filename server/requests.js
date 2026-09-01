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
    collectionDate: row.collection_date || '',
    comment: row.comment || '',
    files: Array.isArray(row.files) ? row.files : [],
    treeCount: Number(row.tree_count || 1),
    leafCount: Number(row.leaf_count || 30),
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
    collection_date: input.collectionDate || null,
    comment: input.comment || '',
    files: Array.isArray(input.files) ? input.files : [],
    tree_count: Number(input.treeCount || 1),
    leaf_count: Number(input.leafCount || 30),
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
