-- Supabase 프로젝트 → SQL Editor → New query에 이 파일 전체를 붙여넣고 Run을 누르세요.
-- 계정마다 자신의 할 일만 읽고 수정할 수 있도록 만듭니다.
-- 이미 실행했다면 다시 실행해도 됩니다. 기존 할 일은 지우지 않습니다.
begin;

create table if not exists public.daily_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  completed boolean not null default false,
  priority smallint not null default 2 check (priority between 1 and 3),
  task_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists daily_todos_user_date_idx
  on public.daily_todos (user_id, task_date, priority, created_at);

alter table public.daily_todos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_todos' and policyname = 'daily_todos_select_own') then
    create policy daily_todos_select_own on public.daily_todos for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_todos' and policyname = 'daily_todos_insert_own') then
    create policy daily_todos_insert_own on public.daily_todos for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_todos' and policyname = 'daily_todos_update_own') then
    create policy daily_todos_update_own on public.daily_todos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_todos' and policyname = 'daily_todos_delete_own') then
    create policy daily_todos_delete_own on public.daily_todos for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;

revoke all on public.daily_todos from anon;
grant select, insert, update, delete on public.daily_todos to authenticated;

notify pgrst, 'reload schema';
commit;
