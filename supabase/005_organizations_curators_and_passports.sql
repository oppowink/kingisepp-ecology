-- ЭкоБиоМониторинг: организации, кураторы, проекты, объекты и паспорт территории
-- Выполнить после supabase/001-004 в Supabase SQL Editor.

create extension if not exists "pgcrypto";

-- Добавляем город и разрешаем отдельную роль куратора.
alter table public.profiles
  add column if not exists city text;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('participant', 'curator', 'moderator', 'admin'));

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  organization_type text not null default 'school'
    check (organization_type in ('school', 'college', 'university', 'volunteer_center', 'ngo', 'other')),
  city text not null,
  join_code text not null unique,
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'participant'
    check (member_role in ('participant', 'curator')),
  status text not null default 'active'
    check (status in ('pending', 'active', 'left', 'rejected')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.monitoring_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  curator_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 180),
  description text,
  city text not null,
  visibility text not null default 'organization'
    check (visibility in ('public', 'organization')),
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'archived')),
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monitoring_objects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.monitoring_projects(id) on delete cascade,
  curator_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 180),
  description text,
  city text not null,
  address_hint text,
  center_lat numeric(9,6),
  center_lng numeric(9,6),
  radius_m integer check (radius_m is null or radius_m between 10 and 50000),
  required_points integer not null default 1 check (required_points between 1 and 500),
  visibility text not null default 'organization'
    check (visibility in ('public', 'organization')),
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'archived')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.object_assignments (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.monitoring_objects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'assigned'
    check (status in ('assigned', 'accepted', 'completed', 'cancelled')),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (object_id, user_id)
);

-- Расширяем заявку: источник задания, паспорт территории и паспорт дерева.
alter table public.monitoring_requests
  add column if not exists source_type text not null default 'own',
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists project_id uuid references public.monitoring_projects(id) on delete set null,
  add column if not exists object_id uuid references public.monitoring_objects(id) on delete set null,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists territory_type text,
  add column if not exists land_use text,
  add column if not exists nearby_sources text,
  add column if not exists road_distance_m integer,
  add column if not exists traffic_intensity text,
  add column if not exists surface_cover text,
  add column if not exists weather_conditions text,
  add column if not exists tree_species text not null default 'Берёза повислая',
  add column if not exists trunk_diameter_cm numeric(6,2),
  add column if not exists tree_height_estimate_m numeric(6,2),
  add column if not exists tree_condition text,
  add column if not exists tree_damage_notes text,
  add column if not exists tree_photo jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'monitoring_requests_source_type_check'
      and conrelid = 'public.monitoring_requests'::regclass
  ) then
    alter table public.monitoring_requests
      add constraint monitoring_requests_source_type_check
      check (source_type in ('own', 'open_object', 'assigned_object'));
  end if;
end $$;

create index if not exists organization_members_user_idx
  on public.organization_members (user_id, status);
create index if not exists monitoring_projects_org_idx
  on public.monitoring_projects (organization_id, status);
create index if not exists monitoring_objects_project_idx
  on public.monitoring_objects (project_id, status);
create index if not exists object_assignments_user_idx
  on public.object_assignments (user_id, status);
create index if not exists monitoring_requests_object_idx
  on public.monitoring_requests (object_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.monitoring_projects enable row level security;
alter table public.monitoring_objects enable row level security;
alter table public.object_assignments enable row level security;

-- Все записи создаются через существующий Vercel API с service-role ключом.
-- Публичный клиент не получает прямой доступ к этим таблицам.

-- Фотографии загружаются по короткоживущим подписанным ссылкам,
-- которые выдаёт существующая функция /api/requests/list.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'monitoring-photos',
  'monitoring-photos',
  true,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.organizations is 'Организации, к которым участники присоединяются по коду';
comment on table public.monitoring_projects is 'Проекты организации, объединяющие объекты мониторинга';
comment on table public.monitoring_objects is 'Территории или объекты, внутри которых участники создают точки';
comment on table public.object_assignments is 'Персональные назначения объектов участникам';
