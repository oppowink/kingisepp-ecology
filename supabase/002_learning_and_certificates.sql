-- ЭкоБиоМониторинг: обучение, сертификаты и роли
-- Выполнить после supabase/001_users.sql

alter table public.users
  add column if not exists education_completed boolean not null default false,
  add column if not exists education_score int not null default 0,
  add column if not exists education_completed_at timestamptz;

create table if not exists public.education_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  course text not null default 'volunteer',
  score int not null default 0,
  total int not null default 0,
  passed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, course)
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  certificate_type text not null
    check (certificate_type in ('volunteer_researcher', 'moderator')),
  point_title text,
  certificate_number text not null unique,
  issued_at timestamptz not null default now()
);

alter table public.education_progress enable row level security;
alter table public.certificates enable row level security;

comment on table public.education_progress is 'Результаты обязательного обучения волонтёров';
comment on table public.certificates is 'Выданные сертификаты участников проекта';
