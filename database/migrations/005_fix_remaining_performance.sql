-- 残りのパフォーマンス警告を修正
-- 作成日: 2025-10-17

-- ====================================
-- teams ポリシーを最適化して統合
-- ====================================
drop policy if exists teams_read on public.teams;
drop policy if exists teams_admin_manage on public.teams;

-- 読み取り: 認証ユーザー全員
create policy teams_read on public.teams
  for select
  using ((select auth.uid()) is not null);

-- 作成・更新・削除: 管理者のみ（for all から分離）
create policy teams_admin_insert on public.teams
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

create policy teams_admin_update on public.teams
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

create policy teams_admin_delete on public.teams
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- ====================================
-- integration_jobs ポリシーを操作別に分離
-- ====================================
drop policy if exists integration_jobs_admin_only on public.integration_jobs;

create policy integration_jobs_admin_select on public.integration_jobs
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

create policy integration_jobs_admin_insert on public.integration_jobs
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

create policy integration_jobs_admin_update on public.integration_jobs
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

create policy integration_jobs_admin_delete on public.integration_jobs
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

