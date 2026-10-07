const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create function auth.role() returns text language sql as $$ select 'service_role'::text $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
insert into storage.buckets values('monitoring-photos','monitoring-photos',true,null,null);`);
for(const file of fs.readdirSync('supabase').filter(f=>/^\d+.*sql$/.test(f)&&f!=='001_users.sql').sort()){
let sql=fs.readFileSync('supabase/'+file,'utf8').replace(/create extension if not exists [^;]+;/gi,'');
try{await db.exec(sql);console.log('migration',file,'OK');}catch(e){console.error('MIGRATION',file,e.message);throw e;}
}
const key='a'.repeat(64);
for(let i=0;i<2;i++)assert.equal((await db.query(`select eco_reserve_action('login-ip',$1,2,600,1) allowed`,[key])).rows[0].allowed,true);
assert.equal((await db.query(`select eco_reserve_action('login-ip',$1,2,600,1) allowed`,[key])).rows[0].allowed,false);
const uid='11111111-1111-4111-8111-111111111111';await db.query('insert into profiles(id,email,name,role) values($1,$2,$3,$4)',[uid,'test@example.invalid','Тест','participant']);
const {toDbInsert}=require('../server/requests');
let row=toDbInsert({id:'test-atomic-1',title:'Тестовая точка',location:'Тест',coordinates:'59,28',collectionDate:'2026-09-01'}, {id:uid,email:'test@example.invalid',name:'Тест'});
const hashes=Array.from({length:22},(_,i)=>({sha256:i.toString(16).padStart(64,'0'),file_kind:i<2?'tree':'leaf'}));
await db.query('select eco_create_request($1::jsonb,$2::jsonb)',[JSON.stringify(row),JSON.stringify(hashes)]);
row.id='test-atomic-2';let conflict=false;
try{await db.query('select eco_create_request($1::jsonb,$2::jsonb)',[JSON.stringify(row),JSON.stringify(hashes)]);}catch(e){conflict=e.code==='23505';}
assert.equal(conflict,true);assert.equal((await db.query('select count(*)::int n from monitoring_requests')).rows[0].n,1);
assert.equal((await db.query('select count(*)::int n from observation_file_hashes')).rows[0].n,22);
assert.equal((await db.query("select public from storage.buckets where id='monitoring-photos'")).rows[0].public,false);
const access=await db.query("select has_function_privilege('anon','eco_create_request(jsonb,jsonb)','execute') allowed");assert.equal(access.rows[0].allowed,false);
console.log('SQL checks passed: limiter, atomic rollback, private bucket, restricted RPC');await db.close();
})().catch(e=>{console.error(e.message);process.exitCode=1;});
