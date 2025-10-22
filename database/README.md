# データベース管理

社内顧客管理システムのデータベーススキーマとマイグレーションを管理するディレクトリです。

## ディレクトリ構成

```
database/
├── migrations/          # マイグレーションSQLスクリプト
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   ├── 003_triggers.sql
│   ├── 004_fix_security_and_performance.sql
│   └── 005_fix_remaining_performance.sql
├── seeds/              # シードデータ
│   └── 001_test_data.sql
└── README.md           # このファイル
```

## マイグレーション履歴

### 001_initial_schema.sql ✓
- 8つの主要テーブルを作成
  - `teams`: チーム/部門マスタ
  - `customers`: 顧客マスタ（所有者ベース、ソフトデリート対応）
  - `contacts`: 顧客担当者
  - `orders`: 発注データ（外部ID紐付け）
  - `measurements`: 測定データ（外部ID紐付け）
  - `integration_jobs`: 外部連携ジョブ履歴
  - `audit_logs`: 操作監査ログ
  - `profiles`: ユーザープロファイル
- 拡張機能: `uuid-ossp`, `pg_trgm`（全文検索用）
- インデックス: パフォーマンス最適化のため各種インデックスを配置

### 002_rls_policies.sql ✓
- 全テーブルにRow Level Security (RLS)を有効化
- ポリシー方針:
  - **所有者ベース**: `customers`は`owner_user_id`の一致で制御
  - **管理者例外**: `role='admin'`のユーザーは全件アクセス可能
  - **カスケード制御**: `contacts`, `orders`, `measurements`は顧客所有者経由で制御
  - **監査ログ**: 管理者のみ閲覧可能

### 003_triggers.sql ✓
- **search_vector自動更新**: 顧客名・コード・担当者名から全文検索用ベクトルを自動生成
- **updated_at自動更新**: `customers`, `contacts`, `integration_jobs`の更新日時を自動設定
- リアルタイム最優先のため、トリガは即時同期

### 004_fix_security_and_performance.sql ✓
セキュリティアドバイザーの警告を修正:
- `teams`, `integration_jobs`にRLS有効化
- 関数の`search_path`を固定（`security definer`）
- RLSポリシーで`auth.uid()`を`(select auth.uid())`に最適化（パフォーマンス改善）
- 複数permissiveポリシーを統合（`profiles`テーブル）

### 005_fix_remaining_performance.sql ✓
パフォーマンス警告を修正:
- `teams`, `integration_jobs`のポリシーを操作別に分離（`for all`から`select/insert/update/delete`へ）
- 複数permissiveポリシーの削減

## シードデータ

### 001_test_data.sql ✓
- テストチーム3件を投入済み:
  - 営業1課
  - 営業2課
  - 技術部
- プロファイルと顧客データはauth.users作成後に投入（コメントアウト済み）

## セキュリティ確認結果（2025-10-17）

### 重大な問題: なし ✅

### 警告（許容範囲）:
- `pg_trgm`拡張がpublicスキーマに配置（既存環境のため移動不可、機能に影響なし）

### パフォーマンス:
- 未使用インデックス: データ未投入のため検出、実運用時には使用予定

## 次のステップ

1. **ユーザー作成**: Supabase Authでテストユーザーと管理者を作成
2. **プロファイル投入**: `001_test_data.sql`のコメントを解除してプロファイルを投入
3. **顧客データ投入**: テスト用顧客データを投入
4. **RLS動作確認**: 所有者制御と管理者例外が正しく機能するか確認

## マイグレーション実行方法

### Supabase MCP経由（推奨）
```javascript
// mcp_supabase_apply_migration ツールを使用
await mcp_supabase_apply_migration({
  name: "migration_name",
  query: "SQLクエリ"
});
```

### Supabase CLI
```powershell
# ローカル開発環境
supabase db push

# リモート環境
supabase db push --db-url $SUPABASE_DB_URL
```

## 注意事項

- マイグレーションは順序を守って実行すること
- 本番環境への適用前に必ずstg環境で動作確認
- RLSポリシーはauth.usersテーブルと連携するため、ユーザー作成が必須
- セキュリティアドバイザーの定期確認を推奨（月1回）

## 参考資料

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [要件定義](../docs/requirements/)
- [実装チェックリスト](../docs/IMPLEMENTATION_CHECKLIST.md)

