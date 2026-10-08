-- Исправление ограничений статусов для баз, где старая 006 уже применена.
-- Не удаляет заявки; расширяет допустимые статусы.

do $$
declare constraint_name text;
begin
  for constraint_name in
    select con.conname from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'monitoring_requests'
      and con.contype = 'c' and (
        pg_get_constraintdef(con.oid) ~* '\m(status|human_status|ai_status)\M'
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

