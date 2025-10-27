# バックアップスクリプト

顧客管理システムの月次バックアップおよび検証スクリプト。

## 📋 概要

このディレクトリには、Supabase PostgreSQLデータベースの月次バックアップとその検証を自動化するスクリプトが含まれています。

### スクリプト一覧

| スクリプト | 用途 | 実行頻度 |
|----------|------|---------|
| `monthly_backup.sh` | 月次バックアップ実行 | 毎月1日 3:00 AM |
| `backup_verification.sh` | バックアップ検証 | 毎月2日（バックアップ翌日） |

### バックアップ戦略

- **保持期間**: 60ヶ月（5年間）
- **保存形式**: SQL dump → gzip圧縮 → GPG暗号化（オプション）
- **検証**: SHA256チェックサム + 整合性チェック + サイズ検証
- **通知**: Webhook通知（成功/失敗）

詳細は [`docs/BACKUP_RECOVERY.md`](../../docs/BACKUP_RECOVERY.md) を参照してください。

---

## 🛠️ セットアップ

### 前提条件

以下のコマンドがインストールされている必要があります:

```bash
# 必須
pg_dump    # PostgreSQLクライアントツール
gzip       # 圧縮ツール
sha256sum  # チェックサム生成（macOSの場合は shasum）

# オプション（暗号化を使用する場合）
gpg        # GPG暗号化ツール

# オプション（テスト復元を使用する場合）
psql       # PostgreSQLクライアント
```

#### インストール例

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql-client gzip coreutils gnupg
```

**macOS:**
```bash
brew install postgresql gzip gnupg
```

### 1. 環境変数の設定

```bash
cd scripts/backup

# テンプレートから環境変数ファイルを作成
cp .env.backup.template .env.backup

# エディタで編集
nano .env.backup
```

**最低限必要な設定:**

```bash
# Supabase接続URL（必須）
SUPABASE_DB_URL="postgresql://postgres.xxxxx:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"

# バックアップ保存先（必須）
BACKUP_BASE_DIR="/mnt/nas/customer_management/backups"
```

**オプション設定:**

```bash
# 暗号化を有効化
BACKUP_ENCRYPTION="true"
GPG_RECIPIENT="backup@example.com"

# テスト復元用DB
TEST_DB_URL="postgresql://postgres:test@localhost:5432/test_restore"

# Webhook通知
WEBHOOK_SUCCESS_URL="https://hooks.slack.com/services/xxx/yyy/zzz"
WEBHOOK_FAILURE_URL="https://hooks.slack.com/services/xxx/yyy/zzz"
```

### 2. パーミッション設定

```bash
# 環境変数ファイルを保護
chmod 600 .env.backup

# スクリプトに実行権限を付与
chmod +x monthly_backup.sh
chmod +x backup_verification.sh
```

### 3. GPG鍵ペアの作成（暗号化を使用する場合）

```bash
# GPG鍵ペア生成
gpg --full-generate-key

# 設定例:
# - Kind: (1) RSA and RSA
# - Key size: 4096
# - Expiration: 0 (does not expire)
# - Real name: Customer Management Backup
# - Email: backup@example.com

# 公開鍵のエクスポート（バックアップ保管推奨）
gpg --export -a "backup@example.com" > backup_public.key

# 秘密鍵のエクスポート（安全な場所に保管）
gpg --export-secret-key -a "backup@example.com" > backup_private.key

# 秘密鍵ファイルのパーミッション設定
chmod 400 backup_private.key
```

### 4. NASマウントの設定

```bash
# NASマウントポイントの作成
sudo mkdir -p /mnt/nas/customer_management/backups

# 永続的なマウント設定（/etc/fstabに追加）
# 例（NFSの場合）:
# nas.example.com:/volume1/backups /mnt/nas/customer_management/backups nfs defaults 0 0

# マウント
sudo mount /mnt/nas/customer_management/backups

# 書き込み権限の確認
touch /mnt/nas/customer_management/backups/test.txt && rm /mnt/nas/customer_management/backups/test.txt
```

---

## 📖 使用方法

### 手動実行

#### バックアップの実行

```bash
cd scripts/backup

# 環境変数を読み込んで実行
source .env.backup
./monthly_backup.sh
```

**実行ログ例:**
```
[2025-01-27 15:30:00] [INFO] Starting monthly backup...
[2025-01-27 15:30:05] [INFO] Performing database backup...
[2025-01-27 15:32:15] [SUCCESS] Database backup completed (size: 125.3 MB)
[2025-01-27 15:32:20] [INFO] Compressing backup...
[2025-01-27 15:33:10] [SUCCESS] Compression completed (size: 42.1 MB)
[2025-01-27 15:33:15] [INFO] Generating checksum...
[2025-01-27 15:33:16] [SUCCESS] Checksum generated
[2025-01-27 15:33:17] [SUCCESS] Monthly backup completed successfully
```

#### バックアップの検証

```bash
cd scripts/backup

# 最新バックアップを検証
source .env.backup
./backup_verification.sh

# 特定のバックアップを検証
./backup_verification.sh /mnt/nas/customer_management/backups/202501/customer_mgmt_backup_20250101_030000.sql.gz
```

**検証レポート例:**
```
Backup Verification Report
Generated: 2025-01-27 16:00:00
Backup File: customer_mgmt_backup_20250101_030000.sql.gz

Checksum Verification: PASSED
File Integrity: PASSED
File Size: 42.1 MB (within expected range)
Metadata Validation: PASSED
Storage Capacity: 65% (OK)

Overall Status: PASSED
```

### Cron設定（自動実行）

#### Cron設定例

```bash
# Crontabを編集
crontab -e
```

**設定内容:**

```cron
# 顧客管理システム - 月次バックアップ
# 毎月1日 3:00 AMに実行
0 3 1 * * cd /path/to/customer_management/scripts/backup && source .env.backup && ./monthly_backup.sh >> /var/log/backup.log 2>&1

# 顧客管理システム - バックアップ検証
# 毎月2日 4:00 AMに実行
0 4 2 * * cd /path/to/customer_management/scripts/backup && source .env.backup && ./backup_verification.sh >> /var/log/backup_verification.log 2>&1
```

#### Cron設定の確認

```bash
# 設定されているCronジョブを確認
crontab -l

# ログの確認
tail -f /var/log/backup.log
tail -f /var/log/backup_verification.log
```

---

## 🔍 トラブルシューティング

### よくある問題と解決方法

#### 1. `pg_dump: command not found`

**原因:** PostgreSQLクライアントツールがインストールされていない

**解決方法:**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql
```

#### 2. `Permission denied` エラー

**原因:** スクリプトに実行権限がない、またはNASマウントポイントへの書き込み権限がない

**解決方法:**
```bash
# スクリプトに実行権限を付与
chmod +x monthly_backup.sh backup_verification.sh

# NASマウントポイントの権限を確認
ls -ld /mnt/nas/customer_management/backups
sudo chown -R $(whoami) /mnt/nas/customer_management/backups
```

#### 3. `SUPABASE_DB_URL is not set`

**原因:** 環境変数が正しく読み込まれていない

**解決方法:**
```bash
# .env.backup ファイルが存在するか確認
ls -la .env.backup

# 環境変数を明示的に読み込む
source .env.backup

# または環境変数を直接設定して実行
SUPABASE_DB_URL="postgresql://..." ./monthly_backup.sh
```

#### 4. バックアップファイルが小さすぎる（< 1MB）

**原因:** データベース接続エラー、または空のダンプ

**解決方法:**
```bash
# データベース接続を手動でテスト
pg_dump "${SUPABASE_DB_URL}" --no-owner --no-acl | head -n 50

# 接続URLが正しいか確認
echo $SUPABASE_DB_URL

# Supabaseダッシュボードで接続文字列を再確認
```

#### 5. GPG暗号化エラー

**原因:** GPG鍵が見つからない、または受信者が正しくない

**解決方法:**
```bash
# GPG鍵の一覧を確認
gpg --list-keys

# GPG_RECIPIENTが鍵リストに存在するか確認
# .env.backup の GPG_RECIPIENT を正しい値に修正
```

#### 6. ディスク容量不足

**原因:** NASの容量が不足している

**解決方法:**
```bash
# ディスク使用量を確認
df -h /mnt/nas/customer_management/backups

# 古いバックアップを手動削除（60ヶ月より古いもの）
find /mnt/nas/customer_management/backups -maxdepth 1 -type d -name "20[0-9][0-9][0-1][0-9]" -mtime +1825 -exec rm -rf {} \;

# または特定の月を削除
rm -rf /mnt/nas/customer_management/backups/201901
```

---

## 📊 バックアップ検証チェックリスト

手動でバックアップを検証する際の確認項目:

- [ ] バックアップファイルが存在する
- [ ] ファイルサイズが妥当（前回比±30%以内）
- [ ] SHA256チェックサムが一致
- [ ] gzip/GPG整合性チェックが成功
- [ ] メタデータファイルが存在し、内容が正しい
- [ ] ディスク使用量が90%未満
- [ ] （オプション）テスト復元が成功

---

## 🔗 関連ドキュメント

- **[バックアップ・復旧戦略](../../docs/BACKUP_RECOVERY.md)**: 完全なバックアップ戦略、復元手順、復旧訓練計画
- **[非機能要件・セキュリティ・運用](../../docs/requirements/06_nonfunctional_security_ops.md)**: RPO/RTO目標、運用要件
- **[実装チェックリスト](../../docs/IMPLEMENTATION_CHECKLIST.md)**: Phase 6.2の実装状況

---

## 📞 サポート

問題が解決しない場合:

1. ログファイルを確認: `/var/log/backup.log`, `/var/log/backup_verification.log`
2. スクリプト内の詳細ログを確認（各スクリプトは詳細なエラーメッセージを出力）
3. 完全なバックアップ・復旧ドキュメント（`docs/BACKUP_RECOVERY.md`）を参照
4. 復旧訓練の実施（年2回、6月・12月）で手順を確認

---

**最終更新**: 2025-01-27
**バージョン**: 1.0
