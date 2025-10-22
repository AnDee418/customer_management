-- addressカラムを削除
-- 理由: 詳細住所フィールド（postal_code, prefecture, city, address_line1, address_line2）に完全移行したため
-- 作成日: 2025-10-22

-- search_vector更新関数を修正（addressへの参照を削除）
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
    setweight(to_tsvector('simple', coalesce(c.address_line2,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce((select string_agg(ct.name,' ') from public.contacts ct where ct.customer_id = c.id),'')), 'C')
  where c.id = target_id;
$$;

comment on function public.customers_tsv_refresh is '顧客検索ベクターを更新（名前、フリガナ、コード、郵便番号、詳細住所、担当者名を含む）';

-- トリガーを更新（addressを監視対象から削除）
drop trigger if exists trg_customers_tsv_update on public.customers;
create trigger trg_customers_tsv_update
before insert or update of name, name_kana, code, postal_code, prefecture, city, address_line1, address_line2 on public.customers
for each row execute function public.customers_tsv_update();

comment on trigger trg_customers_tsv_update on public.customers is '顧客名/フリガナ/コード/詳細住所変更時にsearch_vectorを自動更新';

-- addressカラムを削除
alter table public.customers
  drop column if exists address;
