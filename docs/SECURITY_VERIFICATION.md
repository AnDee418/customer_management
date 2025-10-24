# セキュリティ検証ガイド

## 概要

このドキュメントでは、顧客管理システムのセキュリティ機能の検証手順を説明します。
本番環境で運用する前に、以下の3つの重要なセキュリティ機能を確認します。

## 検証項目

1. **RLSポリシー（Row Level Security）**: データの所有者ベースアクセス制御
2. **ロールベースアクセス制御（RBAC）**: 権限別の機能制限
3. **監査ログ**: すべての重要操作の記録

---

## 前提条件

- ✅ Supabaseプロジェクトが稼働中
- ✅ Next.js BFFがVercelにデプロイ済み
- ✅ 複数のテストユーザーアカウントが作成済み

### テストユーザーの準備

以下のテストユーザーを作成してください：

| ユーザー | メール | 権限 | 所属チーム |
|---------|--------|------|-----------|
| 管理者 | admin@test.com | admin | 東京 |
| マネージャー | manager@test.com | manager | 東京 |
| 一般ユーザーA | user-a@test.com | user | 東京 |
| 一般ユーザーB | user-b@test.com | user | 大阪 |
| 閲覧者 | viewer@test.com | viewer | 東京 |

---

## 1. RLSポリシー検証

### 目的
各ユーザーが自分のデータ（`owner_user_id`が自分のID）のみアクセスできることを確認します。

### テスト手順

#### テスト1.1: 顧客データの所有者チェック

**手順:**
1. ユーザーAでログイン
2. 顧客「テスト顧客A」を作成
3. ログアウト
4. ユーザーBでログイン
5. 顧客一覧を表示

**期待される結果:**
- ✅ ユーザーBには「テスト顧客A」が**表示されない**
- ✅ ユーザーBが作成した顧客のみ表示される

**確認方法（SQL）:**
```sql
-- ユーザーAとしてログイン後
SELECT id, name, owner_user_id
FROM customers
WHERE deleted_at IS NULL;

-- 結果: owner_user_id が ユーザーAのUID のレコードのみ返る
```

#### テスト1.2: 直接API呼び出しでの確認

**手順:**
1. ユーザーAのセッショントークンを取得
2. 別のユーザーBが所有する顧客IDを使ってAPIリクエスト

```bash
# ユーザーAのトークンで、ユーザーBの顧客にアクセス
curl https://customer-management-nine-phi.vercel.app/api/customers/{user-b-customer-id} \
  -H "Cookie: sb-access-token={user-a-token}"
```

**期待される結果:**
- ✅ 404 Not Found または 403 Forbidden
- ✅ ユーザーBの顧客データが**取得できない**

#### テスト1.3: 管理者の例外確認

**手順:**
1. 管理者アカウントでログイン
2. 顧客一覧を表示

**期待される結果:**
- ✅ **すべてのユーザーの顧客**が表示される
- ✅ 管理者はRLSポリシーの例外として動作

**確認SQL:**
```sql
-- 管理者としてログイン後
SELECT id, name, owner_user_id
FROM customers
WHERE deleted_at IS NULL;

-- 結果: すべての顧客が返る（owner_user_idに関係なく）
```

---

## 2. ロールベースアクセス制御（RBAC）検証

### 目的
各権限レベルで適切な機能制限が働いていることを確認します。

### 権限レベル

| 権限 | 読取 | 作成 | 更新 | 削除 | 管理機能 |
|------|------|------|------|------|----------|
| **admin** | ✅ 全て | ✅ | ✅ | ✅ | ✅ |
| **manager** | ✅ チーム | ✅ | ✅ チーム | ✅ チーム | ❌ |
| **user** | ✅ 自分 | ✅ | ✅ 自分 | ✅ 自分 | ❌ |
| **viewer** | ✅ 自分 | ❌ | ❌ | ❌ | ❌ |

### テスト手順

#### テスト2.1: viewer権限の制限確認

**手順:**
1. viewerアカウントでログイン
2. 顧客一覧ページにアクセス
3. 「新規登録」ボタンの表示を確認
4. 顧客詳細ページにアクセス
5. 「編集」「削除」ボタンの表示を確認

**期待される結果:**
- ✅ 顧客一覧: 「新規登録」ボタンが**表示されない**または無効化
- ✅ 顧客詳細: 「編集」「削除」ボタンが**表示されない**または無効化
- ✅ 編集ページに直接アクセスしても403エラー

**確認コマンド:**
```bash
# viewerで新規作成を試みる
curl -X POST https://customer-management-nine-phi.vercel.app/api/customers \
  -H "Cookie: sb-access-token={viewer-token}" \
  -H "Content-Type: application/json" \
  -d '{"name":"テスト","contact":"test@test.com","type":"顧客"}'

# 期待: 403 Forbidden
```

#### テスト2.2: manager権限のチームスコープ確認

**手順:**
1. マネージャーアカウント（東京チーム）でログイン
2. 顧客一覧で、他チーム（大阪）の顧客が見えないことを確認
3. 東京チームの顧客は編集・削除可能であることを確認

**期待される結果:**
- ✅ 東京チームの顧客のみ表示される
- ✅ 東京チームの顧客は編集・削除可能
- ✅ 大阪チームの顧客にはアクセス不可

#### テスト2.3: admin権限の全機能アクセス確認

**手順:**
1. 管理者アカウントでログイン
2. サイドバーに「管理者」メニューが表示されることを確認
3. 監査ログページ（/admin/logs）にアクセス可能であることを確認
4. すべてのユーザーの顧客を編集・削除できることを確認

**期待される結果:**
- ✅ サイドバーに「管理者」セクション表示
- ✅ 監査ログページにアクセス可能
- ✅ すべての顧客データにフルアクセス

---

## 3. 監査ログ検証

### 目的
すべての重要な操作が監査ログに記録されることを確認します。

### テスト手順

#### テスト3.1: 顧客CRUDの監査ログ

**手順:**
1. ユーザーAでログイン
2. 新しい顧客を作成
3. 作成した顧客を編集（名前変更）
4. 作成した顧客を削除
5. 管理者アカウントでログイン
6. 監査ログページ（/admin/logs）にアクセス
7. ユーザーAの操作履歴を確認

**期待される結果:**
- ✅ 「customer_created」ログが記録されている
- ✅ 「customer_updated」ログが記録され、変更前後のdiffが確認できる
- ✅ 「customer_deleted」ログが記録されている
- ✅ すべてのログに`user_id`、`entity`、`action`、`timestamp`が含まれる

**確認SQL:**
```sql
-- 監査ログを確認
SELECT
  id,
  user_id,
  entity,
  action,
  entity_id,
  changes,
  created_at
FROM audit_logs
WHERE user_id = '{user-a-id}'
ORDER BY created_at DESC
LIMIT 10;
```

**期待される出力:**
```
entity: customer, action: deleted
entity: customer, action: updated, changes: {"name": ["旧名前", "新名前"]}
entity: customer, action: created
```

#### テスト3.2: 担当者CRUDの監査ログ

**手順:**
1. ユーザーAでログイン
2. 顧客詳細ページから担当者を追加
3. 担当者情報を編集
4. 担当者を削除
5. 管理者で監査ログを確認

**期待される結果:**
- ✅ 「contact_created」ログ
- ✅ 「contact_updated」ログ（diff付き）
- ✅ 「contact_deleted」ログ

#### テスト3.3: 一般ユーザーの監査ログアクセス制限

**手順:**
1. ユーザーAでログイン
2. `/admin/logs` にアクセスを試みる

**期待される結果:**
- ✅ 403 Forbidden または リダイレクト
- ✅ 監査ログページにアクセス**できない**

**確認:**
```bash
# 一般ユーザーで監査ログAPIにアクセス
curl https://customer-management-nine-phi.vercel.app/api/admin/logs \
  -H "Cookie: sb-access-token={user-token}"

# 期待: 403 Forbidden
```

#### テスト3.4: 機微情報のマスキング確認

**手順:**
1. 顧客を作成（連絡先にメールアドレスや電話番号を含む）
2. 管理者で監査ログを確認
3. ログ内の`changes`フィールドを確認

**期待される結果:**
- ✅ メールアドレス、電話番号などがマスキングされている
- ✅ 例: `test@example.com` → `t***@e***.com`

---

## 4. API認証・認可の検証

### テスト4.1: 未認証アクセスの拒否

**手順:**
```bash
# 認証トークンなしでAPIにアクセス
curl https://customer-management-nine-phi.vercel.app/api/customers

# 期待: 401 Unauthorized または リダイレクト
```

### テスト4.2: 期限切れトークンの拒否

**手順:**
1. ログイン後、セッショントークンを取得
2. Supabaseで該当セッションを手動で削除
3. 古いトークンでAPIにアクセス

**期待される結果:**
- ✅ 401 Unauthorized
- ✅ ログインページにリダイレクト

---

## 5. セキュリティヘッダーの確認

### テスト5.1: HTTPSの強制

**手順:**
```bash
# HTTPでアクセス
curl -I http://customer-management-nine-phi.vercel.app

# 期待: 301/302リダイレクト → HTTPS
```

### テスト5.2: Cache-Control ヘッダー

**手順:**
```bash
# APIレスポンスのヘッダー確認
curl -I https://customer-management-nine-phi.vercel.app/api/customers \
  -H "Cookie: sb-access-token={token}"

# 期待: Cache-Control: no-store
```

---

## 検証結果の記録

### チェックリスト

#### RLSポリシー
- [ ] ユーザーは自分のデータのみアクセス可能
- [ ] 他ユーザーのデータは取得不可
- [ ] 管理者はすべてのデータにアクセス可能

#### RBAC
- [ ] viewer: 読取のみ、作成・更新・削除不可
- [ ] user: 自分のデータのみCRUD可能
- [ ] manager: チーム内データにアクセス可能
- [ ] admin: すべての機能にアクセス可能

#### 監査ログ
- [ ] 顧客CRUD操作がすべて記録される
- [ ] 担当者CRUD操作がすべて記録される
- [ ] diffが正しく記録される
- [ ] 一般ユーザーは監査ログにアクセス不可
- [ ] 機微情報がマスキングされる

#### 認証・認可
- [ ] 未認証アクセスが拒否される
- [ ] 期限切れトークンが拒否される
- [ ] Cache-Control: no-store ヘッダーが設定される

---

## トラブルシューティング

### RLSポリシーが機能しない

**症状:** 他ユーザーのデータが見えてしまう

**確認項目:**
1. テーブルのRLSが有効か確認
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public' AND tablename = 'customers';
   ```

2. ポリシーが正しく設定されているか確認
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'customers';
   ```

### 監査ログが記録されない

**確認項目:**
1. `audit_logs` テーブルへの挿入権限があるか
2. APIルートで `recordAuditLog()` が呼ばれているか
3. エラーログを確認

---

## まとめ

すべてのテストが合格したら、以下を確認してください：

✅ データの所有者ベースアクセス制御が正常動作
✅ 権限別の機能制限が正常動作
✅ すべての重要操作が監査ログに記録
✅ 未認証・無権限アクセスが適切に拒否

これらが確認できれば、セキュリティ要件を満たしていると言えます。

---

**作成日**: 2025-10-24
**最終更新**: 2025-10-24
