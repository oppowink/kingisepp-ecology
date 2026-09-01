-- ЭкоБиоМониторинг: пользователи и роли
-- Выполнить в Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

do $$
begin
  if to_regclass('public.profiles') is null and to_regclass('public.users') is not null then
    alter table public.users rename to profiles;
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  role text not null default 'participant'
    check (role in ('participant', 'moderator', 'admin')),
  yandex_id text unique,
  supabase_auth_id uuid unique,
  last_auth_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_uidx
  on public.profiles (lower(email));

alter table public.profiles enable row level security;

-- Политики: клиент с publishable key таблицу profiles напрямую не трогает.
-- Все операции через Vercel API (service role / серверная логика).

comment on table public.profiles is 'Участники ЭкоБиоМониторинга; роль только с сервера';
