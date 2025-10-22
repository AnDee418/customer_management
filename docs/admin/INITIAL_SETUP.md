# 初期セットアップ手順

## 1. 初期管理者アカウントの作成

### Supabase Dashboardでの作成

1. **Supabase Dashboard**を開く
   ```
   https://supabase.com/dashboard/project/kqttbfqysjraaoxqpqcs
   ```

2. 左サイドバーから **Authentication** → **Users** を選択

3. **「Add user」** ボタンをクリック

4. ユーザー情報を入力:
   - **Email**: あなたのメールアドレス
   - **Password**: 強力なパスワード（推奨: 12文字以上、大小英数字記号混在）
   - **Auto Confirm User**: ✅ チェック（メール認証スキップ）

5. **「Create user」** をクリック

6. 作成されたユーザーの **User UID** をコピー

### プロファイルの設定

作成したユーザーのUIDを使って、以下のSQLを実行：

```sql
-- ユーザーIDを確認
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 1;

-- 管理者プロファイルを作成
INSERT INTO public.profiles (user_id, role, display_name, department)
VALUES (
  'ここにコピーしたUser UIDを貼り付け',
  'admin',
  'システム管理者',
  'システム部'
);

-- 確認
SELECT 
  u.id,
  u.email,
  p.role,
  p.display_name,
  p.department
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'あなたのメールアドレス';
```

## 2. ログインテスト

1. ブラウザで http://localhost:3000/login にアクセス

2. 作成したメールアドレスとパスワードでログイン

3. ダッシュボードが表示されればOK

## 3. 管理者機能の確認

ログイン後、以下を確認：
- サイドバーに「管理者」メニューが表示されているか
- 他のユーザーのデータにアクセスできるか（管理者権限）

## トラブルシューティング

### ログインできない場合

1. **メールアドレスとパスワードを再確認**

2. **ユーザーが確認済みか確認**:
   ```sql
   SELECT id, email, email_confirmed_at 
   FROM auth.users 
   WHERE email = 'あなたのメールアドレス';
   ```
   
   `email_confirmed_at`がNULLの場合:
   ```sql
   UPDATE auth.users 
   SET email_confirmed_at = NOW() 
   WHERE email = 'あなたのメールアドレス';
   ```

3. **プロファイルが作成されているか確認**:
   ```sql
   SELECT * FROM public.profiles 
   WHERE user_id = (
     SELECT id FROM auth.users 
     WHERE email = 'あなたのメールアドレス'
   );
   ```

### RLSエラーが出る場合

管理者ポリシーが正しく設定されているか確認：

```sql
-- 管理者ポリシーの確認
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'customers' 
AND policyname LIKE '%admin%';
```

## セキュリティ注意事項

⚠️ **重要**:
- パスワードは絶対に共有しない
- 定期的にパスワードを変更する（推奨: 3ヶ月ごと）
- 管理者アカウントは必要最小限の人数のみ
- 退職者のアカウントは即座に無効化

---

最終更新: 2025-10-21  
バージョン: v0.11

