-- search_vectorトリガーの修正
-- BEFORE UPDATEトリガーではUPDATE文を実行せず、NEW.search_vectorを直接設定する
-- 作成日: 2025-10-22

-- customers INSERT/UPDATE時にsearch_vectorを直接設定（UPDATE文を使わない）
create or replace function public.customers_tsv_update()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.name_kana,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.code,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.postal_code,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.prefecture,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.city,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.address_line1,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.address_line2,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce((
      select string_agg(ct.name,' ')
      from public.contacts ct
      where ct.customer_id = new.id
    ),'')), 'C');
  return new;
end $$;

comment on function public.customers_tsv_update is 'customers INSERT/UPDATE時にsearch_vectorを直接設定（BEFORE UPDATEトリガー用）';

-- customers_tsv_refresh関数も更新（contactsトリガーから呼ばれる）
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
    setweight(to_tsvector('simple', coalesce((
      select string_agg(ct.name,' ')
      from public.contacts ct
      where ct.customer_id = c.id
    ),'')), 'C')
  where c.id = target_id;
$$;

comment on function public.customers_tsv_refresh is '顧客検索ベクターを更新（名前、フリガナ、コード、郵便番号、詳細住所、担当者名を含む、contactsトリガー用）';
