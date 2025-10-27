# バックアップ・復旧戦略 (Phase 6.2)

## 概要

顧客管理システムのバックアップ・復旧戦略を定義します。本ドキュメントでは、データ保護、災害復旧、およびビジネス継続性を確保するための包括的なバックアップ計画を記載します。

**最終更新**: 2025-10-27
**バージョン**: v1.0
**ステータス**: Phase 6.2 実装中

---

## 目標値（RTO/RPO）

### 復旧目標

| 指標 | 目標値 | 説明 |
|------|--------|------|
| **RPO** (Recovery Point Objective) | ≤ 15分 | データ損失の許容範囲 |
| **RTO** (Recovery Time Objective) | ≤ 4時間 | システム復旧までの許容時間 |

**優先度**: 顧客データ > 発注・測定データ > 設定・監査ログ

---

## バックアップ戦略

### 1. Supabase 自動バックアップ（Primary）

#### PITR (Point-in-Time Recovery)

**機能**:
- PostgreSQL の WAL (Write-Ahead Logging) を使用した継続的バックアップ
- 任意の時点へのリカバリが可能
- RPO: 理論的には数秒（WAL書き込み間隔）

**Supabaseプラン別機能**:

| プラン | PITR保持期間 | 日次バックアップ | カスタムバックアップ |
|--------|-------------|----------------|-------------------|
| Free | なし | 7日間 | なし |
| Pro | 7日間 | 30日間 | 可能 |
| Team | 14日間 | 90日間 | 可能 |
| Enterprise | カスタム | カスタム | 可能 |

**現在のプラン**: Pro（想定）
- PITR: 7日間
- 日次バックアップ: 30日間保持

**設定方法**:
1. Supabase Dashboard → Settings → Database
2. Backups セクションで PITR を有効化
3. 保持期間を確認（Pro: 7日間）

**復元方法**:
1. Supabase Dashboard → Settings → Database → Backups
2. "Restore to point in time" を選択
3. 復元したい日時を指定（ISO 8601形式）
4. 新しいプロジェクトとして復元（既存DBは上書きされない）
5. 接続文字列を更新してアプリを切り替え

**制限事項**:
- PITRは新しいプロジェクトとして復元される（インプレース復元不可）
- Storage (ファイル) は別途バックアップが必要
- Secrets/環境変数は含まれない

#### 日次スナップショット

**機能**:
- 毎日自動的にデータベース全体のスナップショットを作成
- Pro プランで30日間保持
- ワンクリックで復元可能

**復元方法**:
1. Supabase Dashboard → Settings → Database → Backups
2. "Daily Backups" セクションから復元したいバックアップを選択
3. "Restore" をクリック
4. 新しいプロジェクトとして復元

### 2. コールドバックアップ（Secondary / 長期保管）

#### 月次 NAS バックアップ

**目的**:
- 長期保管（5年間）
- オフサイトバックアップ
- ランサムウェア攻撃からの保護

**対象データ**:
- PostgreSQL ダンプファイル (pg_dump)
- Supabase Storage ファイル（該当する場合）
- 環境変数・設定ファイル
- データベーススキーマ定義

**実施頻度**: 月1回（毎月1日）

**バックアップ手順**:

```bash
#!/bin/bash
# monthly_backup.sh - 月次バックアップスクリプト

# 環境変数
export SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
BACKUP_DIR="/mnt/nas/customer_management/backups"
DATE=$(date +%Y%m%d)
BACKUP_FILE="customer_mgmt_backup_${DATE}.sql.gz"

# バックアップディレクトリ作成
mkdir -p "${BACKUP_DIR}/${DATE}"

# PostgreSQLダンプ（圧縮）
pg_dump "${SUPABASE_DB_URL}" | gzip > "${BACKUP_DIR}/${DATE}/${BACKUP_FILE}"

# チェックサム作成
sha256sum "${BACKUP_DIR}/${DATE}/${BACKUP_FILE}" > "${BACKUP_DIR}/${DATE}/${BACKUP_FILE}.sha256"

# バックアップサイズ確認
du -h "${BACKUP_DIR}/${DATE}/${BACKUP_FILE}"

# 古いバックアップの削除（5年以上前）
find "${BACKUP_DIR}" -type d -mtime +1825 -exec rm -rf {} \;

echo "Backup completed: ${BACKUP_FILE}"
```

**暗号化**:
```bash
# GPGで暗号化
gpg --encrypt --recipient admin@example.com "${BACKUP_FILE}"
```

**検証**:
```bash
# チェックサム検証
sha256sum -c "${BACKUP_FILE}.sha256"

# ダンプファイル整合性確認
gunzip -t "${BACKUP_FILE}"
```

**保管場所**:
- プライマリ: オンプレミスNAS
- セカンダリ: AWS S3 Glacier / Azure Blob Archive（推奨）
- ローテーション: 月次バックアップを60ヶ月（5年間）保持

#### スキーマバックアップ

**目的**: データベーススキーマの変更履歴を保持

**方法**:
```bash
# スキーマのみエクスポート
pg_dump "${SUPABASE_DB_URL}" --schema-only > schema_${DATE}.sql

# マイグレーションファイルのバックアップ
tar -czf migrations_${DATE}.tar.gz database/migrations/
```

**Git管理**: マイグレーションファイルは既にGitで管理されているため、追加のバックアップは参照用

### 3. 設定・Secrets のバックアップ

#### 環境変数

**Vercel**:
```bash
# Vercel環境変数のエクスポート
vercel env pull .env.production.backup
```

**Render**:
- Dashboard → Service Settings → Environment
- 手動でコピー＆暗号化保存
- または環境変数をSecrets Managerに保存（推奨）

**ローカル保管**:
```bash
# 暗号化して保存
gpg --encrypt --recipient admin@example.com .env.production.backup
```

#### Supabase設定

**バックアップ対象**:
- プロジェクト設定（API keys は除く）
- RLSポリシー（マイグレーションに含まれる）
- Storage バケット設定
- Edge Functions

**方法**:
- マイグレーションファイルでスキーマ管理
- Supabase CLI で設定をエクスポート（該当する場合）

---

## 復元手順書

### シナリオ1: データ破損（直近の変更を巻き戻し）

**対象**: 誤操作、アプリケーションバグによるデータ破損

**手順**:

1. **影響範囲の特定**
   ```sql
   -- 監査ログで破損の範囲を確認
   SELECT * FROM audit_logs
   WHERE created_at > '2025-10-27 10:00:00'
   ORDER BY created_at DESC
   LIMIT 100;
   ```

2. **PITR復元（7日以内の場合）**
   - Supabase Dashboard → Settings → Database → Backups
   - "Restore to point in time" を選択
   - 破損前の日時を指定（例: `2025-10-27T09:55:00Z`）
   - 新プロジェクトとして復元

3. **接続文字列の更新**
   ```bash
   # 新しいプロジェクトのURL・キーを取得
   NEW_SUPABASE_URL="https://xxx.supabase.co"
   NEW_SUPABASE_ANON_KEY="eyJ..."
   NEW_SUPABASE_SERVICE_ROLE_KEY="eyJ..."

   # Vercelで環境変数を更新
   vercel env rm NEXT_PUBLIC_SUPABASE_URL production
   vercel env add NEXT_PUBLIC_SUPABASE_URL production
   # 値を入力: NEW_SUPABASE_URL

   # 同様にキーも更新
   ```

4. **アプリケーション再デプロイ**
   ```bash
   # Vercel
   vercel --prod

   # Render
   # Dashboard → Manual Deploy
   ```

5. **動作確認**
   - ログインテスト
   - 顧客データ閲覧
   - CRUD操作テスト
   - リアルタイム更新確認

6. **監査ログ記録**
   ```sql
   INSERT INTO audit_logs (actor_user_id, entity, action, diff)
   VALUES (
     '[ADMIN_USER_ID]',
     'system',
     'restore',
     '{"restore_point": "2025-10-27T09:55:00Z", "reason": "Data corruption recovery"}'
   );
   ```

### シナリオ2: データベース全損（災害復旧）

**対象**: Supabaseプロジェクト全損、リージョン障害

**手順**:

1. **新しいSupabaseプロジェクトの作成**
   - Supabase Dashboard → New Project
   - リージョン選択（別リージョン推奨）

2. **スキーマの復元**
   ```bash
   # マイグレーションを順番に適用
   for file in database/migrations/*.sql; do
     psql "${NEW_SUPABASE_DB_URL}" -f "$file"
   done
   ```

3. **月次バックアップからデータ復元**
   ```bash
   # 最新のバックアップを取得
   LATEST_BACKUP=$(ls -t /mnt/nas/customer_management/backups/*/customer_mgmt_backup_*.sql.gz | head -1)

   # チェックサム検証
   cd $(dirname "${LATEST_BACKUP}")
   sha256sum -c $(basename "${LATEST_BACKUP}").sha256

   # 復号化（暗号化されている場合）
   gpg --decrypt customer_mgmt_backup_*.sql.gz.gpg > customer_mgmt_backup.sql.gz

   # データ復元
   gunzip -c "${LATEST_BACKUP}" | psql "${NEW_SUPABASE_DB_URL}"
   ```

4. **RLSポリシーの確認**
   ```sql
   -- RLSポリシーが適用されているか確認
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
   FROM pg_policies
   WHERE schemaname = 'public';
   ```

5. **トリガー・関数の確認**
   ```sql
   -- トリガーが有効か確認
   SELECT tgname, tgenabled, tgrelid::regclass
   FROM pg_trigger
   WHERE tgisinternal = false;
   ```

6. **Realtimeパブリケーションの再設定**
   ```sql
   -- customersテーブルをRealtimeに追加
   ALTER PUBLICATION supabase_realtime ADD TABLE customers;
   ```

7. **接続文字列・環境変数の更新** (シナリオ1と同様)

8. **データ整合性検証**
   ```sql
   -- レコード数確認
   SELECT 'customers' as table, COUNT(*) FROM customers
   UNION ALL
   SELECT 'contacts', COUNT(*) FROM contacts
   UNION ALL
   SELECT 'orders', COUNT(*) FROM orders
   UNION ALL
   SELECT 'measurements', COUNT(*) FROM measurements;

   -- 最新レコード確認
   SELECT * FROM customers ORDER BY created_at DESC LIMIT 10;
   ```

9. **アプリケーション再デプロイ・動作確認** (シナリオ1と同様)

### シナリオ3: 部分的なデータ復元

**対象**: 特定テーブル・特定顧客のデータのみ復元

**手順**:

1. **PITRで一時的なプロジェクトを作成**

2. **必要なデータのみエクスポート**
   ```sql
   -- 特定顧客のデータをエクスポート
   COPY (
     SELECT * FROM customers WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
   ) TO '/tmp/customer_restore.csv' CSV HEADER;
   ```

3. **本番環境にインポート**
   ```sql
   -- 既存データを削除（必要に応じて）
   DELETE FROM customers WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

   -- データを挿入
   COPY customers FROM '/tmp/customer_restore.csv' CSV HEADER;
   ```

4. **一時プロジェクトを削除**

---

## 復旧演習計画

### 目的
- 復旧手順の検証
- RTO/RPOの達成確認
- チームの習熟度向上

### 実施頻度
**年2回以上**（6月、12月を推奨）

### 演習シナリオ

#### 演習1: PITR復元テスト（所要時間: 1時間）

**目的**: 直近データの復元手順確認

**手順**:
1. 現在のDBスナップショットを記録
2. 1時間前の時点にPITR復元
3. データ整合性確認
4. 復元時間を記録（RTOと比較）
5. 一時プロジェクトを削除

**成功基準**:
- RTO ≤ 4時間を達成
- データ損失 ≤ 15分（RPO達成）
- 手順書通りに復元完了

#### 演習2: コールドバックアップからの全復旧（所要時間: 3-4時間）

**目的**: 災害復旧シナリオの実践

**手順**:
1. 新しいテスト用Supabaseプロジェクト作成
2. 最新の月次バックアップを使用してデータ復元
3. スキーマ、RLS、トリガーの確認
4. テストアプリを接続して動作確認
5. データ整合性検証
6. 所要時間を記録

**成功基準**:
- RTO ≤ 4時間を達成
- 全機能が正常動作
- データ欠損なし

#### 演習3: 部分復元テスト（所要時間: 30分）

**目的**: 特定データの復元手順確認

**手順**:
1. テスト用顧客データを選択
2. PITRで一時プロジェクト作成
3. 対象データのみエクスポート
4. テスト環境にインポート
5. 整合性確認

**成功基準**:
- 30分以内に完了
- データの正確性100%

### 演習チェックリスト

```markdown
## 復旧演習チェックリスト

**演習日**: YYYY-MM-DD
**演習者**: [名前]
**シナリオ**: [演習1/2/3]

### 準備
- [ ] バックアップの存在確認
- [ ] 復元手順書の印刷
- [ ] 必要な権限・アクセスの確認
- [ ] ステークホルダーへの通知

### 実施
- [ ] 開始時刻記録: __:__
- [ ] バックアップからの復元実行
- [ ] スキーマ・RLS・トリガー確認
- [ ] データ整合性検証
- [ ] アプリケーション接続テスト
- [ ] 終了時刻記録: __:__

### 結果
- [ ] RTO達成: [Yes/No] (所要時間: __時間__分)
- [ ] RPO達成: [Yes/No] (データ損失: __分)
- [ ] 手順書の正確性: [問題なし/要修正]
- [ ] 発見された問題: [なし/あり（記載）]

### 改善点
-
-

### 次回までのアクション
-
-
```

---

## バックアップ監視・検証

### 自動チェック

#### バックアップ成功確認

**Supabase**:
- Dashboard → Settings → Database → Backups で最新バックアップ日時を確認
- 週次で確認（毎週月曜日）

**月次バックアップ**:
```bash
# バックアップスクリプトに監視を追加
if [ $? -eq 0 ]; then
  echo "SUCCESS: Backup completed at $(date)" >> /var/log/backup.log
  # アラート送信（成功）
  curl -X POST "https://monitoring.example.com/backup/success"
else
  echo "FAILED: Backup failed at $(date)" >> /var/log/backup.log
  # アラート送信（失敗）
  curl -X POST "https://monitoring.example.com/backup/failed"
fi
```

#### バックアップ整合性検証

**月次実施**:
```bash
#!/bin/bash
# backup_verification.sh - バックアップ検証スクリプト

LATEST_BACKUP=$(ls -t /mnt/nas/customer_management/backups/*/customer_mgmt_backup_*.sql.gz | head -1)

# チェックサム検証
sha256sum -c "${LATEST_BACKUP}.sha256"

# ファイル整合性確認
gunzip -t "${LATEST_BACKUP}"

# テスト復元（小規模）
TEST_DB="postgresql://test_restore:password@localhost:5432/test_restore"
gunzip -c "${LATEST_BACKUP}" | head -n 1000 | psql "${TEST_DB}"

if [ $? -eq 0 ]; then
  echo "Backup verification PASSED"
else
  echo "Backup verification FAILED"
  exit 1
fi
```

### アラート設定

**監視項目**:
- [ ] バックアップジョブの失敗
- [ ] バックアップファイルサイズの異常（±30%以上の変化）
- [ ] バックアップ実行時間の遅延（2時間以上）
- [ ] ストレージ容量不足（残り10%以下）

**通知方法**:
- Email
- Slack通知
- ログファイル

---

## 容量計画

### データ増加予測

**要件**:
- 顧客: 100,000件
- 発注: 1,000,000件/年
- 測定: 5,000,000件/年
- 保有期間: 5年

**推定データサイズ**:

| テーブル | 1レコードサイズ | 総レコード数（5年） | 総サイズ |
|---------|---------------|-------------------|---------|
| customers | 5 KB | 100,000 | 500 MB |
| contacts | 2 KB | 300,000 | 600 MB |
| orders | 10 KB | 5,000,000 | 50 GB |
| measurements | 15 KB | 25,000,000 | 375 GB |
| audit_logs | 3 KB | 10,000,000 | 30 GB |
| **合計** | - | - | **約456 GB** |

**インデックス・オーバーヘッド**: 約30% = 137 GB
**総容量**: 約593 GB

**バックアップストレージ要件**:
- 日次バックアップ（30日間、圧縮率70%）: 約12 GB
- 月次バックアップ（60ヶ月、圧縮率70%）: 約249 GB
- **合計**: 約261 GB

### ストレージ拡張計画

**現状**: Supabase Pro（8 GB DB含む）

**拡張タイミング**:
- 6ヶ月後: データサイズ見直し
- 1年後: 上位プランへの移行検討
- 3年後: アーカイブ戦略の実施（古いデータをコールドストレージへ）

---

## セキュリティ

### バックアップの暗号化

**転送中**:
- TLS/SSL必須（Supabase、NAS）

**保管時**:
- NASバックアップ: GPG暗号化
- 鍵管理: 専用のKMS/Secrets Manager使用

### アクセス制御

**権限**:
- バックアップ実行: システム管理者のみ
- バックアップファイルアクセス: 管理者+セキュリティチームのみ
- 復元操作: 管理者のみ（2人承認推奨）

**監査**:
- バックアップ/復元操作はすべて監査ログに記録
- アクセスログの定期レビュー（月次）

---

## チェックリスト

### 日次
- [ ] Supabase自動バックアップの成功確認

### 週次
- [ ] Supabase PITRの有効性確認
- [ ] バックアップログのレビュー

### 月次
- [ ] NASコールドバックアップの実行
- [ ] バックアップ整合性検証
- [ ] ストレージ容量確認
- [ ] バックアップアクセスログのレビュー

### 年2回
- [ ] 復旧演習の実施
- [ ] 復旧手順書の更新
- [ ] RTO/RPO目標の見直し

---

## 関連ドキュメント

- [実装チェックリスト](./IMPLEMENTATION_CHECKLIST.md)
- [監視・観測性セットアップ](./MONITORING_SETUP.md)
- [非機能要件・セキュリティ・運用](../docs/requirements/06_nonfunctional_security_ops.md)

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|-----------|---------|--------|
| 2025-10-27 | v1.0 | 初版作成 | Claude Code |

---

## 補足: Supabase MCP による自動化（今後の検討）

Supabase MCPを使用したバックアップ自動化の可能性を今後検討します。

**想定機能**:
- プログラマティックなバックアップ作成
- バックアップステータスの監視
- 復元操作の自動化

**実装例（疑似コード）**:
```typescript
// Supabase MCPでバックアップを作成（将来の機能として）
mcp__supabase__create_backup({
  project_id: "xxx",
  backup_type: "full"
})

// バックアップリスト取得
mcp__supabase__list_backups({
  project_id: "xxx"
})
```

現時点ではSupabase Dashboard経由での手動操作を推奨します。
