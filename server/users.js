'use strict';

function profileTable() {
  return process.env.SUPABASE_PROFILE_TABLE || 'profiles';
}

function profiles(admin) {
  return admin.from(profileTable());
}

async function upsertUser(admin, input) {
  const email = String(input.email || '').trim().toLowerCase();
  const name = String(input.name || '').trim();
  const authId = input.supabaseAuthId || null;
  const provider = input.provider || 'password';

  let query = profiles(admin).select('*');
  if (authId) query = query.eq('supabase_auth_id', authId);
  else query = query.ilike('email', email);

  let { data: existing, error: findError } = await query.maybeSingle();
  if (findError) throw findError;

  if (!existing && authId) {
    const byEmail = await profiles(admin)
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    if (byEmail.error) throw byEmail.error;
    existing = byEmail.data;
  }

  if (existing) {
    if (existing.blocked) return existing;
    const { data, error } = await profiles(admin)
      .update({
        name: name || existing.name,
        supabase_auth_id: authId || existing.supabase_auth_id,
        last_auth_provider: provider,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await profiles(admin)
    .insert({
      email: email,
      name: name || null,
      role: 'participant',
      blocked: false,
      supabase_auth_id: authId,
      last_auth_provider: provider
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

function toSessionUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    role: row.role || 'participant',
    blocked: Boolean(row.blocked),
    educationCompleted: Boolean(row.education_completed),
    educationScore: Number(row.education_score || 0),
    educationCompletedAt: row.education_completed_at || null
  };
}

module.exports = { upsertUser, toSessionUser, profileTable, profiles };
