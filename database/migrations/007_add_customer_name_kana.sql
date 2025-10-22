-- 顧客フリガナフィールドの追加
-- 作成日: 2025-10-21

-- customersテーブルにname_kanaカラム追加
alter table public.customers
  add column if not exists name_kana text;

comment on column public.customers.name_kana is '顧客名フリガナ（カタカナ）※任意';

-- フリガナでの検索を最適化するためのインデックス
create index if not exists idx_customers_name_kana_trgm
  on public.customers using gin (lower(name_kana) gin_trgm_ops)
  where deleted_at is null;

-- search_vector更新関数を修正（フリガナも検索対象に含める）
create or replace function public.customers_tsv_refresh(target_id uuid)
returns void language sql as $$
  update public.customers c
  set search_vector =
    setweight(to_tsvector('simple', coalesce(c.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(c.name_kana,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(c.code,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce((select string_agg(ct.name,' ') from public.contacts ct where ct.customer_id = c.id),'')), 'C')
  where c.id = target_id;
$$;

comment on function public.customers_tsv_refresh is '顧客検索ベクターを更新（名前、フリガナ、コード、担当者名を含む）';

-- 既存トリガーを更新（name_kanaも監視対象に追加）
drop trigger if exists trg_customers_tsv_update on public.customers;
create trigger trg_customers_tsv_update
before insert or update of name, name_kana, code on public.customers
for each row execute function public.customers_tsv_update();

comment on trigger trg_customers_tsv_update on public.customers is '顧客名/フリガナ/コード変更時にsearch_vectorを自動更新';

