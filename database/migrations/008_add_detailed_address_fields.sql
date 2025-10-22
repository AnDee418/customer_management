-- 住所詳細化フィールドの追加
-- 作成日: 2025-10-21

-- customersテーブルに詳細住所カラム追加
alter table public.customers
  add column if not exists postal_code text,
  add column if not exists prefecture text,
  add column if not exists city text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text;

-- コメント追加
comment on column public.customers.postal_code is '郵便番号（例: 123-4567）';
comment on column public.customers.prefecture is '都道府県（例: 東京都）';
comment on column public.customers.city is '市区町村（例: 渋谷区○○）';
comment on column public.customers.address_line1 is '番地・丁目（例: 1-2-3）';
comment on column public.customers.address_line2 is '建物名・部屋番号（例: ○○マンション 101号室）※任意';

-- 既存のaddressカラムのコメント更新（後方互換性のため残す）
comment on column public.customers.address is '住所（レガシー）※新規は詳細フィールドを使用';

-- 郵便番号の検索用インデックス
create index if not exists idx_customers_postal_code
  on public.customers(postal_code)
  where deleted_at is null;

-- 都道府県の検索用インデックス
create index if not exists idx_customers_prefecture
  on public.customers(prefecture)
  where deleted_at is null;

-- search_vector更新関数を修正（詳細住所も検索対象に含める）
create or replace function public.customers_tsv_refresh(target_id uuid)
returns void language sql as $$
  update public.customers c
  set search_vector =
    setweight(to_tsvector('simple', coalesce(c.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(c.name_kana,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(c.code,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(c.postal_code,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(c.prefecture,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(c.city,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(c.address_line1,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(c.address,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce((select string_agg(ct.name,' ') from public.contacts ct where ct.customer_id = c.id),'')), 'C')
  where c.id = target_id;
$$;

comment on function public.customers_tsv_refresh is '顧客検索ベクターを更新（名前、フリガナ、コード、郵便番号、住所、担当者名を含む）';

-- トリガーを更新（詳細住所フィールドも監視対象に追加）
drop trigger if exists trg_customers_tsv_update on public.customers;
create trigger trg_customers_tsv_update
before insert or update of name, name_kana, code, postal_code, prefecture, city, address_line1, address on public.customers
for each row execute function public.customers_tsv_update();

comment on trigger trg_customers_tsv_update on public.customers is '顧客名/フリガナ/コード/住所変更時にsearch_vectorを自動更新';

