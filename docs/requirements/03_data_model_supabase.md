# 03. データモデル（Supabase）（ドラフト）

本章は論理データモデルの初稿です。実装時に命名や型は見直します。

## 主要テーブル（提案）
- teams: チーム/部門（所有者共有の単位）
- customers: 企業/部署の顧客情報（所有者/チーム紐付け、search_vector を持つ、ソフトデリート対応）
- contacts: 顧客担当者（顧客と1:N）
- orders: 発注の内製レコード（外部ID紐付けを保持）
- measurements: 測定データ（外部ID紐付けを保持）
- integration_jobs: 外部連携の実行/結果履歴（再試行管理）
- audit_logs: 操作監査ログ
- profiles: アプリ用ユーザープロファイル（auth.users と1:1、ロール/チーム）

## フィールド例（抜粋）
- teams(id, name, created_at)
- customers(id, team_id, owner_user_id, name, code, tags, search_vector, deleted_at, created_at, updated_at)
- contacts(id, customer_id, name, email, phone, created_at, updated_at)
- orders(id, customer_id, external_order_id, source_system, title, status, ordered_at, created_at)
- measurements(id, customer_id, order_id, external_measurement_id, source_system, summary, measured_at, created_at)
- integration_jobs(id, job_type, payload, status, attempts, last_error, created_at, updated_at)
- audit_logs(id, actor_user_id, entity, entity_id, action, diff, created_at)
- profiles(user_id, role, team_id, display_name, department, created_at)

## 関連
- teams 1—N customers、profiles（ユーザーの主所属）
- customers 1—N contacts、1—N orders、1—N measurements

## RLS/RBAC（方針）
- 認証必須
- 行レベル制御（例）:
  - 所有者のみ: user_id() = customers.owner_user_id
  - チーム共有（任意）: profiles.team_id = customers.team_id AND role ∈ {admin, manager}
  - 管理者: role = 'admin' は全件読み取り可能（書き込みは業務ルールで制限）
- 監査ログは管理者のみ閲覧可

## 初期SQL（たたき）
> 実装時に型/制約/インデックスは精査します。

```sql
-- extensions（検索最適化のため）
create extension if not exists pg_trgm;

-- teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- customers（search_vector で FTS、ビュー/キャッシュは使わない）
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id),
  owner_user_id uuid references auth.users(id),
  name text not null,
  code text unique,
  tags text[] default '{}',
  search_vector tsvector,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_customers_team on public.customers(team_id);
create index if not exists idx_customers_name_trgm on public.customers using gin (lower(name) gin_trgm_ops);
create index if not exists idx_customers_search_vector on public.customers using gin (search_vector);

-- search_vector メンテ関数（顧客 name/code と担当者名を加味）
create or replace function public.customers_tsv_refresh(target_id uuid)
returns void language sql as $$
  update public.customers c
  set search_vector =
    setweight(to_tsvector('simple', coalesce(c.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(c.code,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce((select string_agg(ct.name,' ') from public.contacts ct where ct.customer_id = c.id),'')), 'C')
  where c.id = target_id;
$$;

create or replace function public.customers_tsv_update()
returns trigger language plpgsql as $$
begin
  perform public.customers_tsv_refresh(new.id);
  return new;
end $$;

create trigger trg_customers_tsv_update
before insert or update of name, code on public.customers
for each row execute function public.customers_tsv_update();

create or replace function public.contacts_after_change()
returns trigger language plpgsql as $$
begin
  perform public.customers_tsv_refresh(coalesce(new.customer_id, old.customer_id));
  return null;
end $$;

create trigger trg_contacts_after_change
after insert or update or delete on public.contacts
for each row execute function public.contacts_after_change();

-- contacts
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- orders
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
create index if not exists idx_orders_cust on public.orders(customer_id);
create unique index if not exists uq_orders_ext on public.orders(external_order_id, source_system);

-- measurements
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
create index if not exists idx_meas_cust on public.measurements(customer_id);
create unique index if not exists uq_meas_ext on public.measurements(external_measurement_id, source_system);

-- integration_jobs
create table if not exists public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null, -- 'pull_orders', 'pull_measurements', 'push_order'
  payload jsonb not null,
  status text not null default 'queued', -- queued, running, succeeded, failed
  attempts int not null default 0,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- audit_logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  entity text not null,
  entity_id uuid,
  action text not null, -- create/update/delete/sync/retry
  diff jsonb,
  created_at timestamptz default now()
);

-- profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user', -- admin, manager, user, viewer
  team_id uuid references public.teams(id),
  display_name text,
  department text,
  created_at timestamptz default now()
);
```

## インデックス/性能
- customers.search_vector の GIN 索引と trgm で即時検索を実現（ビュー/キャッシュは不使用）
- customer_id ベースの参照にインデックス付与
- M2M 参照APIは強整合読み取りで SLO を満たす

## マイグレーション/復旧
- 変更はDDLスクリプト化、環境ごとに順次適用
- Postgres の PITR/スナップショットの活用、復旧手順の演習
- 後方互換が崩れる変更は feature flag/段階ロールアウトで緩和
