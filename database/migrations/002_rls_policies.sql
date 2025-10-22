-- RLSポリシー（所有者ベース＋管理者例外）
-- リアルタイム最優先、監査は管理者のみ

-- ====================================
-- customers RLS
-- ====================================
alter table public.customers enable row level security;

-- 読み取り: 所有者のみ（論理削除を除外）
create policy customers_owner_read on public.customers
  for select
  using (
    deleted_at is null
    and (
      auth.uid() = owner_user_id
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.role = 'admin'
      )
    )
  );

-- 作成: 認証ユーザー
create policy customers_create on public.customers
  for insert
  with check (auth.uid() is not null);

-- 更新: 所有者のみ
create policy customers_owner_update on public.customers
  for update
  using (
    auth.uid() = owner_user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- 論理削除: 所有者のみ
-- （deleted_at 設定）

-- ====================================
-- contacts RLS（顧客所有者経由）
-- ====================================
alter table public.contacts enable row level security;

create policy contacts_via_customer on public.contacts
  for all
  using (
    exists (
      select 1 from public.customers c
      where c.id = contacts.customer_id
        and c.deleted_at is null
        and (
          c.owner_user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.user_id = auth.uid() and p.role = 'admin'
          )
        )
    )
  );

-- ====================================
-- orders RLS（顧客所有者経由）
-- ====================================
alter table public.orders enable row level security;

create policy orders_via_customer on public.orders
  for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = orders.customer_id
        and c.deleted_at is null
        and (
          c.owner_user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.user_id = auth.uid() and p.role = 'admin'
          )
        )
    )
  );

-- ====================================
-- measurements RLS（顧客所有者経由）
-- ====================================
alter table public.measurements enable row level security;

create policy measurements_via_customer on public.measurements
  for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = measurements.customer_id
        and c.deleted_at is null
        and (
          c.owner_user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.user_id = auth.uid() and p.role = 'admin'
          )
        )
    )
  );

-- ====================================
-- audit_logs RLS（管理者のみ）
-- ====================================
alter table public.audit_logs enable row level security;

create policy audit_logs_admin_only on public.audit_logs
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- ====================================
-- profiles RLS
-- ====================================
alter table public.profiles enable row level security;

-- 自身のプロファイルは読み取り可能
create policy profiles_self_read on public.profiles
  for select
  using (auth.uid() = user_id);

-- 管理者は全件読み取り可能
create policy profiles_admin_read on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );


