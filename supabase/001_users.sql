-- ЭкоБиоМониторинг: пользователи и роли
-- Выполнить в Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

create table if not exists public.users (
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

create unique index if not exists users_email_lower_uidx
  on public.users (lower(email));

alter table public.users enable row level security;

-- Политики: клиент с publishable key таблицу users напрямую не трогает.
-- Все операции через Vercel API (service role / серверная логика).

comment on table public.users is 'Участники ЭкоБиоМониторинга; роль только с сервера';
