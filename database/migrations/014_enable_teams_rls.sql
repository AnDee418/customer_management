-- 所属チームテーブルに管理者向けRLSを適用

begin;

alter table public.teams enable row level security;

create policy if not exists teams_admin_select on public.teams
  for select using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy if not exists teams_admin_insert on public.teams
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy if not exists teams_admin_update on public.teams
  for update using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy if not exists teams_admin_delete on public.teams
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

commit;
