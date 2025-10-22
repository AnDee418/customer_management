/**
 * OAuth2 Client Credentials認証
 * M2M/内部API認証用
 * JWT検証実装（JWKs）
 */
import * as jose from 'jose'
import { structuredLog } from '@/lib/audit/logger'

interface OAuth2Token {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
}

interface TokenCache {
  token: string
  expiresAt: number
}

const tokenCache = new Map<string, TokenCache>()

// JWKSキャッシュ（jose内部でキャッシュされるが、初期化用）
let jwksCache: jose.JWTVerifyGetKey | null = null

export async function getOAuth2Token(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const cacheKey = `${clientId}:${clientSecret}`
  const cached = tokenCache.get(cacheKey)

  // キャッシュが有効ならそれを返す（短寿命トークン前提）
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token
  }

  // トークン取得
  const tokenUrl = process.env.OAUTH2_TOKEN_URL!
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-store',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) {
    throw new Error(`OAuth2 token fetch failed: ${response.statusText}`)
  }

  const data: OAuth2Token = await response.json()

  // キャッシュ（有効期限の90%で更新）
  const expiresAt = Date.now() + data.expires_in * 1000 * 0.9
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt,
  })

  return data.access_token
}

/**
 * OAuth2トークン検証（JWT/JWKs）
 * 
 * @param token Bearer token
 * @returns 検証成功ならtrue
 */
export async function verifyOAuth2Token(token: string): Promise<boolean> {
  try {
    const jwksUrl = process.env.OAUTH2_JWKS_URL
    const issuer = process.env.OAUTH2_ISSUER
    const audience = process.env.OAUTH2_AUDIENCE

    // 環境変数が未設定の場合はスタブモード（開発用）
    if (!jwksUrl || !issuer || !audience) {
      structuredLog('warn', 'OAuth2 verification in stub mode', {
        jwksUrl: !!jwksUrl,
        issuer: !!issuer,
        audience: !!audience,
      })
      return true // 開発環境用フォールバック
    }

    // JWKSエンドポイントから鍵を取得
    if (!jwksCache) {
      jwksCache = jose.createRemoteJWKSet(new URL(jwksUrl))
    }

    // JWT検証（署名、exp, nbf, aud, iss）
    const { payload } = await jose.jwtVerify(token, jwksCache, {
      issuer,
      audience,
    })

    // スコープチェック（オプション）
    const requiredScope = process.env.OAUTH2_REQUIRED_SCOPE
    if (requiredScope && payload.scope) {
      const scopes = String(payload.scope).split(' ')
      if (!scopes.includes(requiredScope)) {
        structuredLog('warn', 'Token missing required scope', {
          required: requiredScope,
          actual: payload.scope,
        })
        return false
      }
    }

    structuredLog('info', 'Token verified', {
      sub: payload.sub,
      aud: payload.aud,
      exp: payload.exp,
    })

    return true
  } catch (error) {
    structuredLog('error', 'Token verification failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

