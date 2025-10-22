/**
 * レート制限
 * M2M APIのレート制限実装
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

/**
 * レート制限チェック
 * @param identifier クライアント識別子（IP/ClientID等）
 * @param limit 制限数（デフォルト: 100/分）
 * @param windowMs ウィンドウ時間（デフォルト: 60秒）
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  // エントリがないか期限切れの場合は新規作成
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs
    rateLimitMap.set(identifier, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  // 制限内の場合はカウント増加
  if (entry.count < limit) {
    entry.count++
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
  }

  // 制限超過
  return { allowed: false, remaining: 0, resetAt: entry.resetAt }
}

/**
 * 定期的なクリーンアップ（期限切れエントリ削除）
 */
export function cleanupRateLimitMap() {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt <= now) {
      rateLimitMap.delete(key)
    }
  }
}

// 1分ごとにクリーンアップ
if (typeof window === 'undefined') {
  setInterval(cleanupRateLimitMap, 60000)
}

