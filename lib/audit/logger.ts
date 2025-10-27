/**
 * 監査ログヘルパー
 * 機微情報マスキング、diff生成
 */
import { createServerClient } from '@/lib/supabase/server'

type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'restore' 
  | 'sync' 
  | 'retry' 
  | 'login' 
  | 'permission_change'

interface AuditLogEntry {
  actor_user_id?: string
  entity: string
  entity_id?: string
  action: AuditAction
  diff?: Record<string, any>
}

// 機微情報のマスキング対象フィールド
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'api_key',
  'contact',
  'email',
  'phone',
  'address',
  'credit_card',
  'ssn',
  'tax_id',
]

// PII検出用の正規表現パターン
const PII_PATTERNS = [
  { pattern: /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, replacement: '***EMAIL***' }, // Email
  { pattern: /\b(0\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{3,4})\b/g, replacement: '***PHONE***' }, // 日本の電話番号（0で始まる）
  { pattern: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g, replacement: '***CARD***' }, // クレジットカード（16桁）
]

// UUIDパターン（マスキング対象外として除外）
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// タイムスタンプパターン（マスキング対象外として除外）
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/

/**
 * 文字列中のPIIパターンをマスキング
 */
function maskPIIPatterns(str: string): string {
  // UUIDまたはタイムスタンプの場合はマスキングしない
  if (UUID_PATTERN.test(str) || TIMESTAMP_PATTERN.test(str)) {
    return str
  }

  let masked = str
  for (const { pattern, replacement } of PII_PATTERNS) {
    masked = masked.replace(pattern, replacement)
  }
  return masked
}

/**
 * 機微情報をマスキング
 */
function maskSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    // 文字列の場合はPIIパターンもチェック
    if (typeof data === 'string') {
      return maskPIIPatterns(data)
    }
    return data
  }

  if (Array.isArray(data)) {
    return data.map(maskSensitiveData)
  }

  const masked: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    // キー名ベースのマスキング
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      masked[key] = '***MASKED***'
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value)
    } else if (typeof value === 'string') {
      // 値の内容からPIIパターンを検出してマスキング
      masked[key] = maskPIIPatterns(value)
    } else {
      masked[key] = value
    }
  }
  return masked
}

/**
 * diff生成（before/after比較）
 */
export function generateDiff(
  before: Record<string, any>,
  after: Record<string, any>
): Record<string, any> {
  const diff: Record<string, any> = {}

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    if (before[key] !== after[key]) {
      diff[key] = {
        before: maskSensitiveData(before[key]),
        after: maskSensitiveData(after[key]),
      }
    }
  }

  return diff
}

/**
 * 監査ログ記録
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createServerClient()

    const { error } = await supabase.from('audit_logs').insert({
      actor_user_id: entry.actor_user_id,
      entity: entry.entity,
      entity_id: entry.entity_id,
      action: entry.action,
      diff: entry.diff ? maskSensitiveData(entry.diff) : null,
    })

    if (error) {
      console.error('Failed to log audit:', error)
    }
  } catch (error) {
    console.error('Audit logging error:', error)
  }
}

/**
 * 構造化ログ出力（コンソール）
 */
export function structuredLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, any>
) {
  const log = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...maskSensitiveData(metadata || {}),
  }
  console.log(JSON.stringify(log))
}

