-- テスト用シードデータ
-- チーム、ユーザープロファイル、顧客のサンプルデータ

-- ====================================
-- チームデータ
-- ====================================
-- 注意: 実際のユーザーIDは auth.users に存在する必要があります
-- このスクリプトは Supabase Auth でユーザーを作成した後に実行してください

-- テストチーム
INSERT INTO public.teams (id, name, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, '営業1課', now()),
  ('00000000-0000-0000-0000-000000000002'::uuid, '営業2課', now()),
  ('00000000-0000-0000-0000-000000000003'::uuid, '技術部', now())
ON CONFLICT (id) DO NOTHING;

-- ====================================
-- プロファイルデータ（例）
-- ====================================
-- 注意: 以下のuser_idは実際にauth.usersに存在するIDに置き換える必要があります
-- このスクリプトはサンプルとして提供されています

-- 例: 管理者ユーザー
-- INSERT INTO public.profiles (user_id, role, team_id, display_name, department, created_at)
-- VALUES
--   ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid, 'admin', '00000000-0000-0000-0000-000000000001'::uuid, '管理者 太郎', '管理部', now())
-- ON CONFLICT (user_id) DO NOTHING;

-- 例: 一般ユーザー
-- INSERT INTO public.profiles (user_id, role, team_id, display_name, department, created_at)
-- VALUES
--   ('yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy'::uuid, 'user', '00000000-0000-0000-0000-000000000001'::uuid, '営業 花子', '営業1課', now())
-- ON CONFLICT (user_id) DO NOTHING;

-- ====================================
-- サンプル顧客データ
-- ====================================
-- 注意: owner_user_id は実際に存在するauth.users.idに置き換える必要があります

-- 例: サンプル顧客
-- INSERT INTO public.customers (id, team_id, owner_user_id, name, code, tags, created_at, updated_at)
-- VALUES
--   ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid, '株式会社サンプル', 'CUST001', ARRAY['重要顧客', 'VIP'], now(), now()),
--   ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid, '株式会社テスト', 'CUST002', ARRAY['通常'], now(), now())
-- ON CONFLICT (id) DO NOTHING;

-- ====================================
-- サンプル担当者データ
-- ====================================
-- INSERT INTO public.contacts (customer_id, name, email, phone, created_at, updated_at)
-- VALUES
--   ('10000000-0000-0000-0000-000000000001'::uuid, '山田 太郎', 'yamada@sample.co.jp', '03-1234-5678', now(), now()),
--   ('10000000-0000-0000-0000-000000000001'::uuid, '佐藤 花子', 'sato@sample.co.jp', '03-1234-5679', now(), now()),
--   ('10000000-0000-0000-0000-000000000002'::uuid, '鈴木 一郎', 'suzuki@test.co.jp', '03-9876-5432', now(), now())
-- ON CONFLICT (id) DO NOTHING;

-- ====================================
-- 使用方法
-- ====================================
-- 1. Supabase Dashboard で管理者ユーザーとテストユーザーを作成
-- 2. auth.users から user_id を取得
-- 3. 上記のコメントアウトされた INSERT 文の user_id を実際の値に置き換え
-- 4. コメントを解除して実行

-- または、以下のクエリで既存のユーザーIDを確認できます:
-- SELECT id, email, created_at FROM auth.users;

