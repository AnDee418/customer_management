#!/bin/bash
#
# バックアップ検証スクリプト
# 実施頻度: 毎月（バックアップ作成の翌日を推奨）
#
# 使用方法:
#   ./backup_verification.sh [backup_file]
#
# 環境変数:
#   BACKUP_BASE_DIR     - バックアップ保存先ディレクトリ
#   TEST_DB_URL         - テスト復元用データベースURL（オプション）
#   WEBHOOK_SUCCESS_URL - 成功時通知用WebhookURL（オプション）
#   WEBHOOK_FAILURE_URL - 失敗時通知用WebhookURL（オプション）
#

set -euo pipefail

# ===============================
# 設定読み込み
# ===============================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 環境変数ファイルを読み込み（存在する場合）
if [ -f "${SCRIPT_DIR}/.env.backup" ]; then
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env.backup"
fi

BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/mnt/nas/customer_management/backups}"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${BACKUP_BASE_DIR}/logs/verification_${DATE}.log"
VERIFICATION_PASSED=true

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
  VERIFICATION_PASSED=false
}

log_success() {
  log "SUCCESS" "$@"
}

log_warning() {
  log "WARNING" "$@"
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
# 最新バックアップファイルを取得
# ===============================

get_latest_backup() {
  log_info "Finding latest backup file..."

  # 引数でファイルが指定されている場合はそれを使用
  if [ $# -ge 1 ] && [ -f "$1" ]; then
    echo "$1"
    return
  fi

  # 最新のバックアップファイルを検索
  local latest_backup
  latest_backup=$(find "${BACKUP_BASE_DIR}" -type f \
    \( -name "*.sql.gz" -o -name "*.sql.gz.gpg" \) \
    -mtime -32 | sort -r | head -1)

  if [ -z "${latest_backup}" ]; then
    log_error "No recent backup file found (within last 32 days)"
    exit 1
  fi

  echo "${latest_backup}"
}

# ===============================
# チェックサム検証
# ===============================

verify_checksum() {
  local backup_file="$1"
  local checksum_file="${backup_file}.sha256"

  log_info "Verifying checksum for: $(basename "${backup_file}")"

  if [ ! -f "${checksum_file}" ]; then
    log_error "Checksum file not found: ${checksum_file}"
    return 1
  fi

  # チェックサム検証
  cd "$(dirname "${backup_file}")"
  if command -v sha256sum >/dev/null 2>&1; then
    if sha256sum -c "$(basename "${checksum_file}")" >/dev/null 2>&1; then
      log_success "Checksum verification PASSED"
      return 0
    else
      log_error "Checksum verification FAILED"
      return 1
    fi
  elif command -v shasum >/dev/null 2>&1; then
    if shasum -a 256 -c "$(basename "${checksum_file}")" >/dev/null 2>&1; then
      log_success "Checksum verification PASSED"
      return 0
    else
      log_error "Checksum verification FAILED"
      return 1
    fi
  else
    log_warning "Neither sha256sum nor shasum command found, skipping checksum verification"
    return 0
  fi
}

# ===============================
# ファイル整合性検証
# ===============================

verify_file_integrity() {
  local backup_file="$1"

  log_info "Verifying file integrity for: $(basename "${backup_file}")"

  # 暗号化ファイルの場合
  if [[ "${backup_file}" == *.gpg ]]; then
    log_info "Encrypted file detected, verifying GPG integrity..."
    if gpg --list-packets "${backup_file}" >/dev/null 2>&1; then
      log_success "GPG file integrity verification PASSED"
    else
      log_error "GPG file integrity verification FAILED"
      return 1
    fi

    # 暗号化ファイルの場合、ここで検証終了
    log_warning "Encrypted file detected. Skipping gzip integrity check (requires decryption)"
    return 0
  fi

  # gzipファイルの整合性確認
  if [[ "${backup_file}" == *.gz ]]; then
    log_info "Testing gzip file integrity..."
    if gunzip -t "${backup_file}" 2>/dev/null; then
      log_success "Gzip file integrity verification PASSED"
      return 0
    else
      log_error "Gzip file integrity verification FAILED"
      return 1
    fi
  fi

  log_warning "Unknown file format, skipping integrity check"
  return 0
}

# ===============================
# ファイルサイズ検証
# ===============================

verify_file_size() {
  local backup_file="$1"

  log_info "Verifying file size for: $(basename "${backup_file}")"

  local file_size_bytes
  file_size_bytes=$(stat -f%z "${backup_file}" 2>/dev/null || stat -c%s "${backup_file}" 2>/dev/null)

  local file_size_mb=$((file_size_bytes / 1048576))

  log_info "Backup file size: ${file_size_mb} MB"

  # 最小サイズチェック（1MB）
  if [ "${file_size_bytes}" -lt 1048576 ]; then
    log_error "Backup file is too small (< 1MB)"
    return 1
  fi

  # 過去のバックアップと比較（±30%以内かチェック）
  local previous_backup
  previous_backup=$(find "${BACKUP_BASE_DIR}" -type f \
    \( -name "*.sql.gz" -o -name "*.sql.gz.gpg" \) \
    ! -path "${backup_file}" \
    -mtime -62 | sort -r | head -1)

  if [ -n "${previous_backup}" ]; then
    local prev_size_bytes
    prev_size_bytes=$(stat -f%z "${previous_backup}" 2>/dev/null || stat -c%s "${previous_backup}" 2>/dev/null)

    local size_diff=$(( (file_size_bytes - prev_size_bytes) * 100 / prev_size_bytes ))

    log_info "Size change compared to previous backup: ${size_diff}%"

    if [ "${size_diff#-}" -gt 30 ]; then
      log_warning "Backup file size changed by more than 30% compared to previous backup"
      log_warning "Previous: $((prev_size_bytes / 1048576)) MB, Current: ${file_size_mb} MB"
    else
      log_success "File size is within acceptable range (±30%)"
    fi
  else
    log_info "No previous backup found for size comparison"
  fi

  return 0
}

# ===============================
# メタデータ検証
# ===============================

verify_metadata() {
  local backup_file="$1"
  local backup_dir
  backup_dir=$(dirname "${backup_file}")

  log_info "Verifying metadata..."

  # メタデータファイルを検索
  local metadata_file
  metadata_file=$(find "${backup_dir}" -type f -name "backup_*.json" | head -1)

  if [ -z "${metadata_file}" ]; then
    log_warning "Metadata file not found"
    return 0
  fi

  if [ -f "${metadata_file}" ]; then
    log_info "Metadata file found: $(basename "${metadata_file}")"

    # JSONとして読み込めるか確認
    if command -v jq >/dev/null 2>&1; then
      if jq empty "${metadata_file}" 2>/dev/null; then
        log_success "Metadata is valid JSON"

        # メタデータ内容を表示
        log_info "Metadata contents:"
        jq '.' "${metadata_file}" | while IFS= read -r line; do
          log_info "  ${line}"
        done
      else
        log_error "Metadata is not valid JSON"
        return 1
      fi
    else
      log_warning "jq command not found, skipping JSON validation"
    fi
  fi

  return 0
}

# ===============================
# テスト復元（オプション）
# ===============================

test_restore() {
  local backup_file="$1"

  if [ -z "${TEST_DB_URL:-}" ]; then
    log_info "TEST_DB_URL not set, skipping test restore"
    return 0
  fi

  log_info "Performing test restore (first 1000 lines)..."

  # 一時ファイル作成
  local temp_file
  temp_file=$(mktemp)

  # ファイルの解凍と復号化
  if [[ "${backup_file}" == *.gpg ]]; then
    log_info "Decrypting and decompressing backup..."
    gpg --decrypt "${backup_file}" 2>/dev/null | gunzip | head -n 1000 > "${temp_file}" || {
      log_error "Failed to decrypt/decompress backup file"
      rm -f "${temp_file}"
      return 1
    }
  elif [[ "${backup_file}" == *.gz ]]; then
    log_info "Decompressing backup..."
    gunzip -c "${backup_file}" | head -n 1000 > "${temp_file}" || {
      log_error "Failed to decompress backup file"
      rm -f "${temp_file}"
      return 1
    }
  else
    log_error "Unknown backup file format"
    rm -f "${temp_file}"
    return 1
  fi

  # PostgreSQLに接続してテスト復元
  if psql "${TEST_DB_URL}" -f "${temp_file}" >/dev/null 2>&1; then
    log_success "Test restore PASSED (first 1000 lines)"
  else
    log_error "Test restore FAILED"
    rm -f "${temp_file}"
    return 1
  fi

  # 一時ファイル削除
  rm -f "${temp_file}"

  return 0
}

# ===============================
# バックアップ一覧生成
# ===============================

list_recent_backups() {
  log_info "Listing recent backups (last 90 days)..."

  find "${BACKUP_BASE_DIR}" -type f \
    \( -name "*.sql.gz" -o -name "*.sql.gz.gpg" \) \
    -mtime -90 | while read -r file; do
      local size
      size=$(du -h "${file}" | cut -f1)
      local date
      date=$(stat -f%Sm -t '%Y-%m-%d %H:%M:%S' "${file}" 2>/dev/null || stat -c%y "${file}" 2>/dev/null | cut -d'.' -f1)
      log_info "  ${date} - ${size} - $(basename "${file}")"
    done
}

# ===============================
# ストレージ容量確認
# ===============================

check_storage_capacity() {
  log_info "Checking storage capacity..."

  local total_size
  total_size=$(du -sh "${BACKUP_BASE_DIR}" | cut -f1)
  log_info "Total backup storage used: ${total_size}"

  # ディスク使用率確認（dfコマンド）
  local disk_usage
  disk_usage=$(df -h "${BACKUP_BASE_DIR}" | tail -1 | awk '{print $5}' | tr -d '%')

  log_info "Disk usage: ${disk_usage}%"

  if [ "${disk_usage}" -gt 90 ]; then
    log_error "Disk usage is critically high (>90%)"
    return 1
  elif [ "${disk_usage}" -gt 80 ]; then
    log_warning "Disk usage is high (>80%)"
  else
    log_success "Disk usage is acceptable (<80%)"
  fi

  return 0
}

# ===============================
# 検証レポート生成
# ===============================

generate_report() {
  local backup_file="$1"
  local report_file="${BACKUP_BASE_DIR}/verification_report_${DATE}.txt"

  log_info "Generating verification report..."

  {
    echo "=========================================="
    echo "Backup Verification Report"
    echo "=========================================="
    echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Verified File: $(basename "${backup_file}")"
    echo "File Size: $(du -h "${backup_file}" | cut -f1)"
    echo ""
    echo "Verification Results:"
    if [ "${VERIFICATION_PASSED}" = true ]; then
      echo "  Overall Status: PASSED ✓"
    else
      echo "  Overall Status: FAILED ✗"
    fi
    echo ""
    echo "Recent Backups:"
    find "${BACKUP_BASE_DIR}" -type f \
      \( -name "*.sql.gz" -o -name "*.sql.gz.gpg" \) \
      -mtime -90 | sort -r | head -10
    echo ""
    echo "Storage Usage:"
    du -sh "${BACKUP_BASE_DIR}"
    df -h "${BACKUP_BASE_DIR}" | tail -1
  } > "${report_file}"

  log_success "Verification report generated: ${report_file}"
}

# ===============================
# メイン処理
# ===============================

main() {
  log_info "=========================================="
  log_info "Backup Verification Script Started"
  log_info "=========================================="

  # ログディレクトリ作成
  mkdir -p "${BACKUP_BASE_DIR}/logs"

  # 最新バックアップファイル取得
  BACKUP_FILE=$(get_latest_backup "$@")
  log_info "Target backup file: ${BACKUP_FILE}"

  # チェックサム検証
  verify_checksum "${BACKUP_FILE}" || true

  # ファイル整合性検証
  verify_file_integrity "${BACKUP_FILE}" || true

  # ファイルサイズ検証
  verify_file_size "${BACKUP_FILE}" || true

  # メタデータ検証
  verify_metadata "${BACKUP_FILE}" || true

  # テスト復元（オプション）
  test_restore "${BACKUP_FILE}" || true

  # 最近のバックアップ一覧
  list_recent_backups

  # ストレージ容量確認
  check_storage_capacity || true

  # レポート生成
  generate_report "${BACKUP_FILE}"

  log_info "=========================================="
  if [ "${VERIFICATION_PASSED}" = true ]; then
    log_success "Backup Verification Completed: PASSED"
    send_notification "success" "Backup verification passed for $(basename "${BACKUP_FILE}")"
    exit 0
  else
    log_error "Backup Verification Completed: FAILED"
    send_notification "failure" "Backup verification failed for $(basename "${BACKUP_FILE}")"
    exit 1
  fi
}

# メイン処理実行
main "$@"
