-- ЭкоБиоМониторинг: обязательные курсы, разметка листьев и контроль целостности данных.
-- Выполнить после supabase/001-005 в Supabase SQL Editor.

create extension if not exists "pgcrypto";

alter table public.education_progress
  add column if not exists lessons_completed boolean not null default false,
  add column if not exists lessons_completed_at timestamptz,
  add column if not exists attempts integer not null default 0;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select con.conname from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'certificates'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%certificate_type%'
  loop execute format('alter table public.certificates drop constraint %I', constraint_name); end loop;
end $$;

alter table public.certificates add constraint certificates_type_check
  check (certificate_type in ('participant', 'curator', 'moderator', 'volunteer_researcher'));

alter table public.monitoring_requests
  add column if not exists participant_checklist jsonb not null default '[]'::jsonb,
  add column if not exists landmarks jsonb not null default '[]'::jsonb,
  add column if not exists leaf_hashes jsonb not null default '[]'::jsonb,
  add column if not exists photo_precheck jsonb not null default '{}'::jsonb,
  add column if not exists integrity_code text,
  add column if not exists captured_at timestamptz,
  add column if not exists gps_accuracy_m numeric(8,2),
  add column if not exists device_latitude numeric(9,6),
  add column if not exists device_longitude numeric(9,6),
  add column if not exists integrity_flags jsonb not null default '[]'::jsonb,
  add column if not exists analysis_started_at timestamptz,
  add column if not exists returned_at timestamptz;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select con.conname from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'monitoring_requests'
      and con.contype = 'c' and (
        pg_get_constraintdef(con.oid) ilike '%status in%'
        or pg_get_constraintdef(con.oid) ilike '%ai_status%'
      )
  loop execute format('alter table public.monitoring_requests drop constraint %I', constraint_name); end loop;
end $$;

alter table public.monitoring_requests
  add constraint monitoring_requests_status_check
    check (status in ('pending_human', 'needs_revision', 'human_approved', 'published', 'rejected')),
  add constraint monitoring_requests_human_status_check
    check (human_status in ('pending', 'needs_revision', 'approved', 'rejected')),
  add constraint monitoring_requests_ai_status_check
    check (ai_status in ('pending', 'processing', 'checked', 'failed', 'skipped'));

create table if not exists public.observation_file_hashes (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null unique check (char_length(sha256) = 64),
  request_id text not null references public.monitoring_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_kind text not null default 'leaf' check (file_kind in ('leaf', 'tree')),
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.monitoring_requests(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists observation_file_hashes_request_idx on public.observation_file_hashes (request_id);
create index if not exists moderation_events_request_idx on public.moderation_events (request_id, created_at desc);
create index if not exists education_progress_course_idx on public.education_progress (course, passed);

alter table public.observation_file_hashes enable row level security;
alter table public.moderation_events enable row level security;

comment on table public.observation_file_hashes is 'SHA-256 отпечатки фотографий для поиска повторной загрузки';
comment on table public.moderation_events is 'Журнал решений и исправлений модератора';
comment on column public.monitoring_requests.landmarks is 'Нормированные координаты 12 точек каждого листа';
comment on column public.monitoring_requests.ai_result is 'Результат автоматического расчёта ФА по проверенным точкам';
