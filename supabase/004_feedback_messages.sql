-- ЭкоБиоМониторинг: сообщения обратной связи
-- Таблица используется напрямую с фронтенда через Supabase anon/publishable key.

create extension if not exists "pgcrypto";

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  name text check (name is null or char_length(trim(name)) <= 120),
  email text check (
    email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  topic text not null default 'idea'
    check (topic in ('idea', 'problem', 'question')),
  message text not null
    check (char_length(trim(message)) between 3 and 3000),
  page_url text check (page_url is null or char_length(page_url) <= 500),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  status text not null default 'new'
    check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.feedback_messages enable row level security;

drop policy if exists feedback_insert_public on public.feedback_messages;
create policy feedback_insert_public
  on public.feedback_messages
  for insert
  to anon, authenticated
  with check (
    topic in ('idea', 'problem', 'question')
    and char_length(trim(message)) between 3 and 3000
  );

drop policy if exists feedback_admin_read on public.feedback_messages;
create policy feedback_admin_read
  on public.feedback_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.supabase_auth_id = auth.uid()
        and p.role in ('admin', 'moderator')
    )
  );
