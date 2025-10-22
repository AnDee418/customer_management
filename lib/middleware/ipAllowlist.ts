/**
 * IP Allowlist チェック
 * M2M APIのIP制限
 */
import { NextRequest } from 'next/server'

/**
 * リクエストからIPアドレスを取得
 */
export function getClientIP(request: NextRequest): string | null {
  // X-Forwarded-For ヘッダーから取得（プロキシ経由の場合）
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // X-Real-IP ヘッダーから取得
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // 直接接続の場合（Next.js環境では取得困難）
  return null
}

/**
 * CIDR形式の許可判定
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) {
    // 単一IPの場合
    return ip === cidr
  }

  // CIDR形式の場合（簡易実装）
  const [network, bits] = cidr.split('/')
  const mask = -1 << (32 - parseInt(bits))

  const ipNum = ipToNumber(ip)
  const networkNum = ipToNumber(network)

  return (ipNum & mask) === (networkNum & mask)
}

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0)
}

/**
 * IP Allowlistチェック
 */
export function isIPAllowed(ip: string | null): boolean {
  if (!ip) {
    return false
  }

  const allowedIPs = process.env.M2M_ALLOWED_IPS?.split(',') || []
  
  // 空リストの場合はすべて許可（開発環境用）
  if (allowedIPs.length === 0 && process.env.NODE_ENV === 'development') {
    return true
  }

  return allowedIPs.some(allowed => isIPInCIDR(ip, allowed.trim()))
}

