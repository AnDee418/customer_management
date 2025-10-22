-- 顧客タイプと顧客コード自動生成機能の追加
-- 作成日: 2025-10-21

-- ====================================
-- customer_typeカラム追加
-- ====================================

-- ENUMタイプの作成
create type customer_type_enum as enum (
  '顧客',
  'スタッフ',
  'サポート',
  '社員',
  '代理店',
  'その他'
);

-- customersテーブルにカラム追加
alter table public.customers
  add column if not exists type customer_type_enum not null default '顧客';

comment on column public.customers.type is '顧客タイプ（顧客/スタッフ/サポート/社員/代理店/その他）';

-- インデックス追加
create index if not exists idx_customers_type on public.customers(type) where deleted_at is null;

-- ====================================
-- 顧客コード自動生成機能
-- ====================================

-- 顧客コード生成関数（CUST-YYYYMMDD-NNNN形式）
create or replace function generate_customer_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today_str text;
  seq_num int;
  new_code text;
begin
  -- 今日の日付（YYYYMMDD形式）
  today_str := to_char(current_date, 'YYYYMMDD');

  -- 今日作成された顧客の数をカウント（削除済みも含む）
  select count(*) + 1 into seq_num
  from customers
  where code like 'CUST-' || today_str || '-%';

  -- コード生成（CUST-YYYYMMDD-NNNN）
  new_code := 'CUST-' || today_str || '-' || lpad(seq_num::text, 4, '0');

  return new_code;
end;
$$;

comment on function generate_customer_code is '顧客コードを自動生成（CUST-YYYYMMDD-NNNN形式）';

-- 顧客コード自動設定トリガー関数
create or replace function set_customer_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- codeが空またはNULLの場合のみ自動生成
  if new.code is null or new.code = '' then
    new.code := generate_customer_code();
  end if;

  return new;
end;
$$;

comment on function set_customer_code is '顧客作成時にコードを自動設定するトリガー関数';

-- トリガー作成（INSERT時のみ）
drop trigger if exists trg_set_customer_code on public.customers;
create trigger trg_set_customer_code
  before insert on public.customers
  for each row
  execute function set_customer_code();

comment on trigger trg_set_customer_code on public.customers is '顧客作成時に顧客コードを自動生成';

