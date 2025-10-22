-- 社内顧客管理システム 初期スキーマ
-- リアルタイム最優先、所有者ベースRLS、OAuth2 CC認証
-- 作成日: 2025-10-17

-- 拡張機能
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ====================================
-- teams（チーム/部門）
-- ====================================
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

comment on table public.teams is 'チーム/部門マスタ（所有者共有の単位）';

-- ====================================
-- customers（顧客情報）
-- ====================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id),
  owner_user_id uuid references auth.users(id),
  name text not null,
  code text,
  tags text[] default '{}',
  search_vector tsvector,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.customers is '顧客マスタ（企業/部署）- 所有者/チーム紐付け、ソフトデリート対応';

-- 一意制約（論理削除を除外）
create unique index if not exists uq_customers_code_active 
  on public.customers(code) where deleted_at is null;

-- インデックス
create index if not exists idx_customers_team on public.customers(team_id);
create index if not exists idx_customers_owner on public.customers(owner_user_id);
create index if not exists idx_customers_name_trgm 
  on public.customers using gin (lower(name) gin_trgm_ops);
create index if not exists idx_customers_search_vector 
  on public.customers using gin (search_vector);
create index if not exists idx_customers_deleted 
  on public.customers(deleted_at) where deleted_at is null;

-- ====================================
-- contacts（顧客担当者）
-- ====================================
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.contacts is '顧客担当者（顧客と1:N）';

create index if not exists idx_contacts_customer on public.contacts(customer_id);

-- ====================================
-- orders（発注データ）
-- ====================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  external_order_id text not null,
  source_system text not null,
  title text,
  status text,
  ordered_at timestamptz,
  created_at timestamptz default now()
);

comment on table public.orders is '発注データ（外部ID紐付け）';

create index if not exists idx_orders_customer on public.orders(customer_id);
create unique index if not exists uq_orders_ext 
  on public.orders(external_order_id, source_system);

-- ====================================
-- measurements（測定データ）
-- ====================================
create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  external_measurement_id text not null,
  source_system text not null,
  summary jsonb,
  measured_at timestamptz,
  created_at timestamptz default now()
);

comment on table public.measurements is '測定データ（外部ID紐付け）';

create index if not exists idx_measurements_customer on public.measurements(customer_id);
create index if not exists idx_measurements_order on public.measurements(order_id);
create unique index if not exists uq_measurements_ext 
  on public.measurements(external_measurement_id, source_system);

-- ====================================
-- integration_jobs（外部連携ジョブ）
-- ====================================
create table if not exists public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null,
  status text not null default 'queued',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.integration_jobs is '外部連携の実行/結果履歴（再試行管理）';
comment on column public.integration_jobs.job_type is 'pull_orders, pull_measurements, push_order等';
comment on column public.integration_jobs.status is 'queued, running, succeeded, failed';

create index if not exists idx_integration_jobs_status on public.integration_jobs(status);
create index if not exists idx_integration_jobs_created on public.integration_jobs(created_at desc);

-- ====================================
-- audit_logs（監査ログ）
-- ====================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  entity text not null,
  entity_id uuid,
  action text not null,
  diff jsonb,
  created_at timestamptz default now()
);

comment on table public.audit_logs is '操作監査ログ（管理者のみ閲覧可）';
comment on column public.audit_logs.action is 'create, update, delete, restore, sync, retry, login, permission_change';

create index if not exists idx_audit_logs_entity on public.audit_logs(entity, entity_id);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_user_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

-- ====================================
-- profiles（ユーザープロファイル）
-- ====================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  team_id uuid references public.teams(id),
  display_name text,
  department text,
  created_at timestamptz default now()
);

comment on table public.profiles is 'アプリ用ユーザープロファイル（auth.users と1:1）';
comment on column public.profiles.role is 'admin, manager, user, viewer';

create index if not exists idx_profiles_team on public.profiles(team_id);
create index if not exists idx_profiles_role on public.profiles(role);


