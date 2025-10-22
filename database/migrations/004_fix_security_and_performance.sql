-- セキュリティとパフォーマンスの修正
-- 作成日: 2025-10-17

-- ====================================
-- 1. teams テーブルにRLS有効化
-- ====================================
alter table public.teams enable row level security;

-- チームは認証ユーザーが読み取り可能
create policy teams_read on public.teams
  for select
  using (auth.uid() is not null);

-- チーム作成・更新は管理者のみ
create policy teams_admin_manage on public.teams
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- ====================================
-- 2. integration_jobs テーブルにRLS有効化
-- ====================================
alter table public.integration_jobs enable row level security;

-- 管理者のみ閲覧・操作可能
create policy integration_jobs_admin_only on public.integration_jobs
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- ====================================
-- 3. RLSポリシーのパフォーマンス最適化
--    auth.uid() を (select auth.uid()) に変更
-- ====================================

-- customers ポリシーを削除して再作成
drop policy if exists customers_owner_read on public.customers;
drop policy if exists customers_create on public.customers;
drop policy if exists customers_owner_update on public.customers;

create policy customers_owner_read on public.customers
  for select
  using (
    deleted_at is null
    and (
      (select auth.uid()) = owner_user_id
      or exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid())
          and p.role = 'admin'
      )
    )
  );

create policy customers_create on public.customers
  for insert
  with check ((select auth.uid()) is not null);

create policy customers_owner_update on public.customers
  for update
  using (
    (select auth.uid()) = owner_user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- contacts ポリシーを最適化
drop policy if exists contacts_via_customer on public.contacts;

create policy contacts_via_customer on public.contacts
  for all
  using (
    exists (
      select 1 from public.customers c
      where c.id = contacts.customer_id
        and c.deleted_at is null
        and (
          c.owner_user_id = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.user_id = (select auth.uid()) and p.role = 'admin'
          )
        )
    )
  );

-- orders ポリシーを最適化
drop policy if exists orders_via_customer on public.orders;

create policy orders_via_customer on public.orders
  for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = orders.customer_id
        and c.deleted_at is null
        and (
          c.owner_user_id = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.user_id = (select auth.uid()) and p.role = 'admin'
          )
        )
    )
  );

-- measurements ポリシーを最適化
drop policy if exists measurements_via_customer on public.measurements;

create policy measurements_via_customer on public.measurements
  for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = measurements.customer_id
        and c.deleted_at is null
        and (
          c.owner_user_id = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.user_id = (select auth.uid()) and p.role = 'admin'
          )
        )
    )
  );

-- audit_logs ポリシーを最適化
drop policy if exists audit_logs_admin_only on public.audit_logs;

create policy audit_logs_admin_only on public.audit_logs
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- profiles ポリシーを最適化（複数permissiveポリシーを統合）
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_admin_read on public.profiles;

create policy profiles_read on public.profiles
  for select
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- ====================================
-- 4. 関数のsearch_path固定（セキュリティ強化）
-- ====================================

create or replace function public.customers_tsv_refresh(target_id uuid)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.customers c
  set search_vector =
    setweight(to_tsvector('simple', coalesce(c.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(c.code,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce((
      select string_agg(ct.name,' ')
      from public.contacts ct
      where ct.customer_id = c.id
    ),'')), 'C')
  where c.id = target_id;
$$;

create or replace function public.customers_tsv_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.customers_tsv_refresh(new.id);
  return new;
end $$;

create or replace function public.contacts_after_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.customers_tsv_refresh(coalesce(new.customer_id, old.customer_id));
  return null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ====================================
-- 5. pg_trgm拡張を extensions スキーマへ移動
-- ====================================
-- 注意: 既存の拡張は移動できないため、新規環境では最初から extensions スキーマに配置すること
-- 既存環境では警告は残るが、機能に影響はない

