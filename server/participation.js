'use strict';

const crypto = require('crypto');
const { profiles } = require('./users');

function asText(value, max) {
  return String(value || '').trim().slice(0, max || 500);
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function inList(query, field, values) {
  const ids = unique(values);
  return ids.length ? query.in(field, ids) : null;
}

function publicProfile(row) {
  return row ? {
    id: row.id,
    email: row.email || '',
    name: row.name || '',
    role: row.role || 'participant',
    city: row.city || ''
  } : null;
}

function publicOrganization(row) {
  return row ? {
    id: row.id,
    name: row.name,
    type: row.organization_type,
    city: row.city,
    joinCode: row.join_code,
    description: row.description || '',
    createdBy: row.created_by,
    status: row.status
  } : null;
}

function publicProject(row) {
  return row ? {
    id: row.id,
    organizationId: row.organization_id,
    curatorId: row.curator_id,
    title: row.title,
    description: row.description || '',
    city: row.city,
    visibility: row.visibility,
    status: row.status,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null
  } : null;
}

function publicObject(row) {
  return row ? {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    curatorId: row.curator_id,
    title: row.title,
    description: row.description || '',
    city: row.city,
    addressHint: row.address_hint || '',
    centerLat: row.center_lat === null ? null : Number(row.center_lat),
    centerLng: row.center_lng === null ? null : Number(row.center_lng),
    radiusM: row.radius_m === null ? null : Number(row.radius_m),
    requiredPoints: Number(row.required_points || 1),
    visibility: row.visibility,
    status: row.status,
    dueDate: row.due_date || null
  } : null;
}

async function activeMemberships(admin, userId) {
  const result = await admin.from('organization_members')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (result.error) throw result.error;
  return result.data || [];
}

async function organizationAccess(admin, user, organizationId) {
  if (user.role === 'admin') return true;
  const owned = await admin.from('organizations')
    .select('id')
    .eq('id', organizationId)
    .eq('created_by', user.id)
    .maybeSingle();
  if (owned.error) throw owned.error;
  if (owned.data) return true;
  const member = await admin.from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('member_role', 'curator')
    .eq('status', 'active')
    .maybeSingle();
  if (member.error) throw member.error;
  return Boolean(member.data);
}

async function participantContext(admin, user) {
  const memberships = await activeMemberships(admin, user.id);
  const orgIds = memberships.map(function (row) { return row.organization_id; });
  let organizations = [];
  if (orgIds.length) {
    const result = await inList(admin.from('organizations').select('*'), 'id', orgIds);
    if (result.error) throw result.error;
    organizations = result.data || [];
  }

  const objectResult = await admin.from('monitoring_objects')
    .select('*')
    .eq('status', 'open')
    .order('due_date', { ascending: true, nullsFirst: false });
  if (objectResult.error) throw objectResult.error;

  const assignmentResult = await admin.from('object_assignments')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['assigned', 'accepted']);
  if (assignmentResult.error) throw assignmentResult.error;
  const assignedIds = new Set((assignmentResult.data || []).map(function (row) { return row.object_id; }));

  const visibleObjects = (objectResult.data || []).filter(function (row) {
    return row.visibility === 'public' || orgIds.includes(row.organization_id) || assignedIds.has(row.id);
  });
  const projectIds = unique(visibleObjects.map(function (row) { return row.project_id; }));
  let projects = [];
  if (projectIds.length) {
    const result = await inList(admin.from('monitoring_projects').select('*'), 'id', projectIds);
    if (result.error) throw result.error;
    projects = result.data || [];
  }

  return {
    profile: publicProfile(user),
    memberships: memberships.map(function (membership) {
      const organization = organizations.find(function (item) { return item.id === membership.organization_id; });
      return {
        id: membership.id,
        organizationId: membership.organization_id,
        memberRole: membership.member_role,
        status: membership.status,
        organization: publicOrganization(organization)
      };
    }),
    projects: projects.map(publicProject),
    objects: visibleObjects.map(function (row) {
      return Object.assign(publicObject(row), { assigned: assignedIds.has(row.id) });
    })
  };
}

async function curatorDashboard(admin, user) {
  if (!['curator', 'admin'].includes(user.role)) throw new Error('CURATOR_REQUIRED');
  let organizations = [];
  if (user.role === 'admin') {
    const result = await admin.from('organizations').select('*').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    organizations = result.data || [];
  } else {
    const memberships = await activeMemberships(admin, user.id);
    const memberOrgIds = memberships
      .filter(function (row) { return row.member_role === 'curator'; })
      .map(function (row) { return row.organization_id; });
    const ownedResult = await admin.from('organizations').select('*').eq('created_by', user.id);
    if (ownedResult.error) throw ownedResult.error;
    const ids = unique(memberOrgIds.concat((ownedResult.data || []).map(function (row) { return row.id; })));
    if (ids.length) {
      const result = await inList(admin.from('organizations').select('*'), 'id', ids);
      if (result.error) throw result.error;
      organizations = result.data || [];
    }
  }

  const orgIds = organizations.map(function (row) { return row.id; });
  if (!orgIds.length) return { organizations: [], projects: [], objects: [], members: [], requests: [] };

  const projectQuery = await inList(admin.from('monitoring_projects').select('*').order('created_at', { ascending: false }), 'organization_id', orgIds);
  if (projectQuery.error) throw projectQuery.error;
  const objectQuery = await inList(admin.from('monitoring_objects').select('*').order('created_at', { ascending: false }), 'organization_id', orgIds);
  if (objectQuery.error) throw objectQuery.error;
  const memberQuery = await inList(admin.from('organization_members').select('*').eq('status', 'active'), 'organization_id', orgIds);
  if (memberQuery.error) throw memberQuery.error;

  const memberRows = memberQuery.data || [];
  const userIds = unique(memberRows.map(function (row) { return row.user_id; }));
  let memberProfiles = [];
  if (userIds.length) {
    const result = await inList(profiles(admin).select('id,email,name,role,city'), 'id', userIds);
    if (result.error) throw result.error;
    memberProfiles = result.data || [];
  }

  const requestQuery = await inList(admin.from('monitoring_requests').select('*').order('created_at', { ascending: false }), 'organization_id', orgIds);
  if (requestQuery.error) throw requestQuery.error;

  return {
    organizations: organizations.map(publicOrganization),
    projects: (projectQuery.data || []).map(publicProject),
    objects: (objectQuery.data || []).map(publicObject),
    members: memberRows.map(function (membership) {
      return {
        id: membership.id,
        organizationId: membership.organization_id,
        userId: membership.user_id,
        memberRole: membership.member_role,
        status: membership.status,
        profile: publicProfile(memberProfiles.find(function (profile) { return profile.id === membership.user_id; }))
      };
    }),
    requests: requestQuery.data || []
  };
}

function generateJoinCode() {
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}

async function createOrganization(admin, user, input) {
  if (!['curator', 'admin'].includes(user.role)) throw new Error('CURATOR_REQUIRED');
  const payload = {
    name: asText(input.name, 160),
    organization_type: asText(input.type, 40) || 'school',
    city: asText(input.city, 100),
    description: asText(input.description, 1000),
    join_code: generateJoinCode(),
    created_by: user.id,
    status: 'active'
  };
  if (!payload.name || !payload.city) throw new Error('REQUIRED_FIELDS_MISSING');
  const result = await admin.from('organizations').insert(payload).select('*').single();
  if (result.error) throw result.error;
  const memberResult = await admin.from('organization_members').upsert({
    organization_id: result.data.id,
    user_id: user.id,
    member_role: 'curator',
    status: 'active',
    updated_at: new Date().toISOString()
  }, { onConflict: 'organization_id,user_id' });
  if (memberResult.error) throw memberResult.error;
  return publicOrganization(result.data);
}

async function joinOrganization(admin, user, code) {
  const normalized = asText(code, 32).toUpperCase();
  const organizationResult = await admin.from('organizations')
    .select('*')
    .eq('join_code', normalized)
    .eq('status', 'active')
    .maybeSingle();
  if (organizationResult.error) throw organizationResult.error;
  if (!organizationResult.data) throw new Error('ORGANIZATION_NOT_FOUND');
  const result = await admin.from('organization_members').upsert({
    organization_id: organizationResult.data.id,
    user_id: user.id,
    member_role: user.role === 'curator' ? 'curator' : 'participant',
    status: 'active',
    updated_at: new Date().toISOString()
  }, { onConflict: 'organization_id,user_id' }).select('*').single();
  if (result.error) throw result.error;
  return { membership: result.data, organization: publicOrganization(organizationResult.data) };
}

async function leaveOrganization(admin, user, organizationId) {
  const result = await admin.from('organization_members')
    .update({ status: 'left', updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();
  if (result.error) throw result.error;
  return Boolean(result.data);
}

async function createProject(admin, user, input) {
  const organizationId = asText(input.organizationId, 60);
  if (!await organizationAccess(admin, user, organizationId)) throw new Error('CURATOR_REQUIRED');
  const payload = {
    organization_id: organizationId,
    curator_id: user.id,
    title: asText(input.title, 180),
    description: asText(input.description, 1500),
    city: asText(input.city, 100),
    visibility: input.visibility === 'public' ? 'public' : 'organization',
    status: 'open',
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null
  };
  if (!payload.title || !payload.city) throw new Error('REQUIRED_FIELDS_MISSING');
  const result = await admin.from('monitoring_projects').insert(payload).select('*').single();
  if (result.error) throw result.error;
  return publicProject(result.data);
}

async function createObject(admin, user, input) {
  const organizationId = asText(input.organizationId, 60);
  if (!await organizationAccess(admin, user, organizationId)) throw new Error('CURATOR_REQUIRED');
  const projectId = asText(input.projectId, 60);
  const projectResult = await admin.from('monitoring_projects')
    .select('id, organization_id, status')
    .eq('id', projectId)
    .maybeSingle();
  if (projectResult.error) throw projectResult.error;
  if (!projectResult.data || projectResult.data.organization_id !== organizationId || projectResult.data.status !== 'open') {
    throw new Error('PROJECT_NOT_AVAILABLE');
  }
  const payload = {
    organization_id: organizationId,
    project_id: projectId,
    curator_id: user.id,
    title: asText(input.title, 180),
    description: asText(input.description, 1500),
    city: asText(input.city, 100),
    address_hint: asText(input.addressHint, 500),
    center_lat: Number.isFinite(Number(input.centerLat)) ? Number(input.centerLat) : null,
    center_lng: Number.isFinite(Number(input.centerLng)) ? Number(input.centerLng) : null,
    radius_m: Number.isFinite(Number(input.radiusM)) ? Number(input.radiusM) : null,
    required_points: Math.max(1, Number(input.requiredPoints || 1)),
    visibility: input.visibility === 'public' ? 'public' : 'organization',
    status: 'open',
    due_date: input.dueDate || null
  };
  if (!payload.project_id || !payload.title || !payload.city) throw new Error('REQUIRED_FIELDS_MISSING');
  const result = await admin.from('monitoring_objects').insert(payload).select('*').single();
  if (result.error) throw result.error;
  return publicObject(result.data);
}

async function assignObject(admin, user, input) {
  const objectResult = await admin.from('monitoring_objects').select('*').eq('id', input.objectId).maybeSingle();
  if (objectResult.error) throw objectResult.error;
  if (!objectResult.data || !await organizationAccess(admin, user, objectResult.data.organization_id)) {
    throw new Error('CURATOR_REQUIRED');
  }
  const memberResult = await admin.from('organization_members')
    .select('id')
    .eq('organization_id', objectResult.data.organization_id)
    .eq('user_id', input.userId)
    .eq('status', 'active')
    .maybeSingle();
  if (memberResult.error) throw memberResult.error;
  if (!memberResult.data) throw new Error('MEMBER_NOT_FOUND');
  const result = await admin.from('object_assignments').upsert({
    object_id: input.objectId,
    user_id: input.userId,
    assigned_by: user.id,
    status: 'assigned',
    updated_at: new Date().toISOString()
  }, { onConflict: 'object_id,user_id' }).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}

module.exports = {
  participantContext,
  curatorDashboard,
  createOrganization,
  joinOrganization,
  leaveOrganization,
  createProject,
  createObject,
  assignObject,
  publicProfile
};
