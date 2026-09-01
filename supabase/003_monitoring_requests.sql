-- ЭкоБиоМониторинг: заявки, дерево, листья и двухэтапная модерация
-- Выполнить после supabase/001_profiles.sql и supabase/002_learning_and_certificates.sql

create table if not exists public.monitoring_requests (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_email text not null,
  user_name text,
  title text not null,
  location text not null,
  coordinates text not null,
  collection_date date not null,
  comment text,
  files jsonb not null default '[]'::jsonb,
  tree_count int not null default 1 check (tree_count > 0),
  leaf_count int not null default 30 check (leaf_count > 0),
  background_flags jsonb not null default '[]'::jsonb,
  ai_result jsonb,
  status text not null default 'pending_human'
    check (status in ('pending_human', 'human_approved', 'published', 'rejected')),
  human_status text not null default 'pending'
    check (human_status in ('pending', 'approved', 'rejected')),
  ai_status text not null default 'pending'
    check (ai_status in ('pending', 'checked', 'skipped')),
  moderation_reason text,
  moderation_checklist jsonb not null default '[]'::jsonb,
  moderated_at timestamptz,
  ai_checked_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monitoring_requests_user_idx
  on public.monitoring_requests (user_id, created_at desc);

create index if not exists monitoring_requests_status_idx
  on public.monitoring_requests (status, created_at desc);

alter table public.monitoring_requests enable row level security;

comment on table public.monitoring_requests is 'Заявки точек мониторинга: 1 точка, 1 дерево, 30 листьев, модерация человеком и нейросетью';
