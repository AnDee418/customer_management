#!/bin/bash
#
# 月次バックアップスクリプト
# 実施頻度: 毎月1日 3:00 AM
# 保持期間: 60ヶ月（5年間）
#
# 使用方法:
#   ./monthly_backup.sh
#
# 環境変数:
#   SUPABASE_DB_URL     - Supabase PostgreSQL接続URL
#   BACKUP_BASE_DIR     - バックアップ保存先ディレクトリ
#   BACKUP_ENCRYPTION   - 暗号化を有効化 (true/false)
#   GPG_RECIPIENT       - GPG暗号化の受信者
#   WEBHOOK_SUCCESS_URL - 成功時通知用WebhookURL（オプション）
#   WEBHOOK_FAILURE_URL - 失敗時通知用WebhookURL（オプション）
#

set -euo pipefail

# ===============================
# 設定読み込み
# ===============================

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 環境変数ファイルを読み込み（存在する場合）
if [ -f "${SCRIPT_DIR}/.env.backup" ]; then
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env.backup"
fi

# デフォルト値設定
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/mnt/nas/customer_management/backups}"
BACKUP_ENCRYPTION="${BACKUP_ENCRYPTION:-false}"
DATE=$(date +%Y%m%d_%H%M%S)
YEAR_MONTH=$(date +%Y%m)
LOG_FILE="${BACKUP_BASE_DIR}/logs/backup_${DATE}.log"

# ===============================
# ログ関数
# ===============================

log() {
  local level="$1"
  shift
  local message="$*"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
  log "INFO" "$@"
}

log_error() {
  log "ERROR" "$@"
}

log_success() {
  log "SUCCESS" "$@"
}

# ===============================
# 通知関数
# ===============================

send_notification() {
  local status="$1"
  local message="$2"
  local webhook_url=""

  if [ "${status}" = "success" ] && [ -n "${WEBHOOK_SUCCESS_URL:-}" ]; then
    webhook_url="${WEBHOOK_SUCCESS_URL}"
  elif [ "${status}" = "failure" ] && [ -n "${WEBHOOK_FAILURE_URL:-}" ]; then
    webhook_url="${WEBHOOK_FAILURE_URL}"
  fi

  if [ -n "${webhook_url}" ]; then
    curl -X POST "${webhook_url}" \
      -H "Content-Type: application/json" \
      -d "{\"status\":\"${status}\",\"message\":\"${message}\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
      >/dev/null 2>&1 || true
  fi
}

# ===============================
# クリーンアップ関数
# ===============================

cleanup_temp_files() {
  if [ -n "${TEMP_DUMP_FILE:-}" ] && [ -f "${TEMP_DUMP_FILE}" ]; then
    log_info "Cleaning up temporary files..."
    rm -f "${TEMP_DUMP_FILE}"
  fi
}

# エラー時のクリーンアップ
trap cleanup_temp_files EXIT

# ===============================
# バリデーション
# ===============================

validate_config() {
  log_info "Validating configuration..."

  if [ -z "${SUPABASE_DB_URL:-}" ]; then
    log_error "SUPABASE_DB_URL is not set"
    exit 1
  fi

  if [ "${BACKUP_ENCRYPTION}" = "true" ] && [ -z "${GPG_RECIPIENT:-}" ]; then
    log_error "BACKUP_ENCRYPTION is enabled but GPG_RECIPIENT is not set"
    exit 1
  fi

  # pg_dumpコマンドの存在確認
  if ! command -v pg_dump >/dev/null 2>&1; then
    log_error "pg_dump command not found. Please install PostgreSQL client tools."
    exit 1
  fi

  # 暗号化が有効な場合、gpgコマンドの存在確認
  if [ "${BACKUP_ENCRYPTION}" = "true" ] && ! command -v gpg >/dev/null 2>&1; then
    log_error "gpg command not found but BACKUP_ENCRYPTION is enabled"
    exit 1
  fi

  log_success "Configuration validation passed"
}

# ===============================
# ディレクトリ準備
# ===============================

prepare_directories() {
  log_info "Preparing backup directories..."

  # ログディレクトリ作成
  mkdir -p "${BACKUP_BASE_DIR}/logs"

  # 月別バックアップディレクトリ作成
  BACKUP_DIR="${BACKUP_BASE_DIR}/${YEAR_MONTH}"
  mkdir -p "${BACKUP_DIR}"

  log_success "Directories prepared: ${BACKUP_DIR}"
}

# ===============================
# バックアップ実行
# ===============================

perform_backup() {
  log_info "Starting PostgreSQL dump..."

  BACKUP_FILENAME="customer_mgmt_backup_${DATE}.sql"
  TEMP_DUMP_FILE="${BACKUP_DIR}/${BACKUP_FILENAME}"

  # データベースダンプ実行
  if pg_dump "${SUPABASE_DB_URL}" --no-owner --no-acl > "${TEMP_DUMP_FILE}"; then
    log_success "PostgreSQL dump completed: ${BACKUP_FILENAME}"
  else
    log_error "PostgreSQL dump failed"
    exit 1
  fi

  # ファイルサイズ確認
  local file_size
  file_size=$(du -h "${TEMP_DUMP_FILE}" | cut -f1)
  log_info "Backup file size: ${file_size}"

  # 最小サイズチェック（1MBより小さい場合は警告）
  local file_size_bytes
  file_size_bytes=$(stat -f%z "${TEMP_DUMP_FILE}" 2>/dev/null || stat -c%s "${TEMP_DUMP_FILE}" 2>/dev/null)
  if [ "${file_size_bytes}" -lt 1048576 ]; then
    log_error "Backup file is suspiciously small (< 1MB). Aborting."
    exit 1
  fi
}

# ===============================
# 圧縮
# ===============================

compress_backup() {
  log_info "Compressing backup..."

  gzip "${TEMP_DUMP_FILE}"
  TEMP_DUMP_FILE="${TEMP_DUMP_FILE}.gz"

  local compressed_size
  compressed_size=$(du -h "${TEMP_DUMP_FILE}" | cut -f1)
  log_success "Backup compressed: ${compressed_size}"
}

# ===============================
# 暗号化
# ===============================

encrypt_backup() {
  if [ "${BACKUP_ENCRYPTION}" = "true" ]; then
    log_info "Encrypting backup with GPG..."

    gpg --encrypt --recipient "${GPG_RECIPIENT}" \
      --output "${TEMP_DUMP_FILE}.gpg" \
      "${TEMP_DUMP_FILE}"

    # 暗号化成功後、元ファイルを削除
    rm -f "${TEMP_DUMP_FILE}"
    TEMP_DUMP_FILE="${TEMP_DUMP_FILE}.gpg"

    log_success "Backup encrypted"
  fi
}

# ===============================
# チェックサム生成
# ===============================

generate_checksum() {
  log_info "Generating SHA256 checksum..."

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${TEMP_DUMP_FILE}" > "${TEMP_DUMP_FILE}.sha256"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${TEMP_DUMP_FILE}" > "${TEMP_DUMP_FILE}.sha256"
  else
    log_error "Neither sha256sum nor shasum command found"
    exit 1
  fi

  log_success "Checksum generated"
}

# ===============================
# メタデータファイル作成
# ===============================

create_metadata() {
  log_info "Creating backup metadata..."

  local metadata_file="${BACKUP_DIR}/backup_${DATE}.json"

  cat > "${metadata_file}" <<EOF
{
  "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backup_file": "$(basename "${TEMP_DUMP_FILE}")",
  "file_size": $(stat -f%z "${TEMP_DUMP_FILE}" 2>/dev/null || stat -c%s "${TEMP_DUMP_FILE}" 2>/dev/null),
  "encrypted": ${BACKUP_ENCRYPTION},
  "database_url_hash": "$(echo -n "${SUPABASE_DB_URL}" | sha256sum | cut -d' ' -f1)",
  "script_version": "1.0",
  "hostname": "$(hostname)"
}
EOF

  log_success "Metadata created: ${metadata_file}"
}

# ===============================
# 古いバックアップの削除
# ===============================

cleanup_old_backups() {
  log_info "Cleaning up old backups (older than 60 months)..."

  # 60ヶ月（1825日）以上前のディレクトリを削除
  find "${BACKUP_BASE_DIR}" -maxdepth 1 -type d -name "20[0-9][0-9][0-1][0-9]" -mtime +1825 -exec rm -rf {} \; 2>/dev/null || true

  log_success "Old backups cleaned up"
}

# ===============================
# バックアップサマリー生成
# ===============================

generate_summary() {
  log_info "Generating backup summary..."

  local summary_file="${BACKUP_BASE_DIR}/backup_summary.txt"

  {
    echo "==================================="
    echo "Backup Summary"
    echo "==================================="
    echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Backup File: $(basename "${TEMP_DUMP_FILE}")"
    echo "Location: ${BACKUP_DIR}"
    echo "Size: $(du -h "${TEMP_DUMP_FILE}" | cut -f1)"
    echo "Encrypted: ${BACKUP_ENCRYPTION}"
    echo ""
    echo "Recent Backups:"
    find "${BACKUP_BASE_DIR}" -type f \( -name "*.sql.gz" -o -name "*.sql.gz.gpg" \) -mtime -90 | sort -r | head -10
    echo ""
    echo "Total Backup Storage:"
    du -sh "${BACKUP_BASE_DIR}"
  } > "${summary_file}"

  log_success "Summary generated: ${summary_file}"
}

# ===============================
# メイン処理
# ===============================

main() {
  log_info "=========================================="
  log_info "Monthly Backup Script Started"
  log_info "=========================================="
  log_info "Backup Date: ${DATE}"

  # 設定検証
  validate_config

  # ディレクトリ準備
  prepare_directories

  # バックアップ実行
  perform_backup

  # 圧縮
  compress_backup

  # 暗号化（有効な場合）
  encrypt_backup

  # チェックサム生成
  generate_checksum

  # メタデータ作成
  create_metadata

  # 古いバックアップ削除
  cleanup_old_backups

  # サマリー生成
  generate_summary

  log_success "=========================================="
  log_success "Monthly Backup Completed Successfully"
  log_success "=========================================="
  log_success "Backup file: ${TEMP_DUMP_FILE}"
  log_success "Backup size: $(du -h "${TEMP_DUMP_FILE}" | cut -f1)"

  # 成功通知
  send_notification "success" "Monthly backup completed successfully: $(basename "${TEMP_DUMP_FILE}")"

  # 一時ファイル変数をクリア（削除しないようにする）
  TEMP_DUMP_FILE=""

  exit 0
}

# エラー時の処理
error_handler() {
  log_error "Backup script failed at line ${1}"
  send_notification "failure" "Monthly backup failed at line ${1}"
  exit 1
}

trap 'error_handler ${LINENO}' ERR

# メイン処理実行
main "$@"
