// Checks the migrations actually present in this archive. Requires npm ci first.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  create function auth.role() returns text language sql as $$ select 'service_role'::text $$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);`);
  for(const file of fs.readdirSync('supabase').filter(f=>/^\d+.*sql$/.test(f)&&f!=='001_users.sql').sort()){
   const sql=fs.readFileSync('supabase/'+file,'utf8').replace(/create extension if not exists [^;]+;/gi,'');
   await db.exec(sql);console.log('migration',file,'OK');
  }
  const constraints=(await db.query("select pg_get_constraintdef(oid) definition from pg_constraint where conrelid='monitoring_requests'::regclass and contype='c'")).rows;
  assert.ok(constraints.some(r=>r.definition.includes('needs_revision')&&r.definition.includes('status')));
  assert.ok(constraints.some(r=>r.definition.includes('processing')&&r.definition.includes('ai_status')));
  const hashIndex=(await db.query("select count(*)::int n from pg_constraint where conrelid='observation_file_hashes'::regclass and contype='u'")).rows[0];
  assert.ok(hashIndex.n>=1);
  console.log('Schema checks passed: migrations, revised statuses, unique photo hashes. No live Supabase or Storage is contacted.');
 } finally { await db.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
