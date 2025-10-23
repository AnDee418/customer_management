-- ==========================================
-- 初期管理者ユーザー作成スクリプト
-- ==========================================
-- 
-- 使用方法:
-- 1. Supabase Dashboardで手動でユーザーを作成
-- 2. 作成したユーザーのIDを確認
-- 3. 下記のSQLでプロファイルを作成
--
-- ==========================================

-- ステップ1: 最新のユーザーを確認
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- ステップ2: ユーザーIDをコピーして、以下のSQLを実行
-- 【重要】user_idを実際のIDに置き換えてください

-- プロファイル作成（管理者）
INSERT INTO public.profiles (user_id, role, display_name, department)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- ← ここを実際のuser_idに置き換え
  'admin',
  'システム管理者',
  'システム部'
)
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name,
  department = EXCLUDED.department;

-- ステップ3: 確認
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.role,
  p.display_name,
  p.department,
  p.created_at as profile_created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
ORDER BY u.created_at DESC
LIMIT 5;

-- ==========================================
-- 【参考】その他のロール
-- ==========================================

-- 管理者（admin）: 全データへのアクセス、ユーザー管理
-- INSERT INTO public.profiles (user_id, role, display_name, department)
-- VALUES ('user-id-here', 'admin', '管理者名', '部署名');

-- マネージャー（manager）: チーム内のデータへのアクセス
-- INSERT INTO public.profiles (user_id, role, display_name, department)
-- VALUES ('user-id-here', 'manager', 'マネージャー名', '部署名');

-- 代理店（agency）: 代理店向け権限
-- INSERT INTO public.profiles (user_id, role, display_name, department)
-- VALUES ('user-id-here', 'agency', '代理店担当者名', '部署名');

-- 一般ユーザー（user）: 自分のデータのみアクセス
-- INSERT INTO public.profiles (user_id, role, display_name, department)
-- VALUES ('user-id-here', 'user', 'ユーザー名', '部署名');

-- 閲覧者（viewer）: 読み取り専用
-- INSERT INTO public.profiles (user_id, role, display_name, department)
-- VALUES ('user-id-here', 'viewer', '閲覧者名', '部署名');

-- ==========================================
-- トラブルシューティング
-- ==========================================

-- メール確認が済んでいない場合
-- UPDATE auth.users 
-- SET email_confirmed_at = NOW() 
-- WHERE email = 'user@example.com';

-- ユーザーを無効化する場合
-- UPDATE auth.users 
-- SET banned_until = 'infinity' 
-- WHERE email = 'user@example.com';

-- ユーザーを再度有効化する場合
-- UPDATE auth.users 
-- SET banned_until = NULL 
-- WHERE email = 'user@example.com';

-- ==========================================

