-- 性別フィールドの追加
-- 作成日: 2025-10-22

-- customersテーブルにgenderカラムを追加
alter table public.customers
  add column if not exists gender text;

comment on column public.customers.gender is '性別（男性、女性、その他、未回答）';

-- search_vectorに性別は含めない（検索対象外）
