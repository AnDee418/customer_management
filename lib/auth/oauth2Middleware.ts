/**
 * OAuth2 Token Verification Middleware
 *
 * Verifies OAuth2 access tokens (JWT) issued by /api/oauth2/token
 */

import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { hasScope } from './oauth2Config'

export interface OAuth2TokenPayload {
  client_id: string
  scopes: string[]
  token_type: 'access_token'
  iat: number
  exp: number
  iss: string
}

export interface OAuth2VerificationResult {
  success: boolean
  payload?: OAuth2TokenPayload
  error?: string
  errorDescription?: string
}

/**
 * Verify OAuth2 access token from Authorization header
 */
export async function verifyOAuth2Token(
  request: NextRequest
): Promise<OAuth2VerificationResult> {
  // 1. Extract Authorization header
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return {
      success: false,
      error: 'invalid_request',
      errorDescription: 'Missing Authorization header'
    }
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'invalid_request',
      errorDescription: 'Authorization header must use Bearer scheme'
    }
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  // 2. Verify JWT signature and expiration
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    console.error('JWT_SECRET environment variable is not set')
    return {
      success: false,
      error: 'server_error',
      errorDescription: 'Internal server configuration error'
    }
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
      {
        issuer: process.env.NEXT_PUBLIC_APP_URL || 'customer-management',
        algorithms: ['HS256']
      }
    )

    // 3. Validate token type
    if (payload.token_type !== 'access_token') {
      return {
        success: false,
        error: 'invalid_token',
        errorDescription: 'Token is not an access token'
      }
    }

    // 4. Return verified payload
    return {
      success: true,
      payload: payload as unknown as OAuth2TokenPayload
    }
  } catch (error) {
    // JWT verification failed (expired, invalid signature, etc.)
    console.warn('OAuth2 token verification failed:', error)

    return {
      success: false,
      error: 'invalid_token',
      errorDescription: error instanceof Error ? error.message : 'Token verification failed'
    }
  }
}

/**
 * Verify OAuth2 token and check required scope
 */
export async function verifyOAuth2TokenWithScope(
  request: NextRequest,
  requiredScope: string
): Promise<OAuth2VerificationResult> {
  const result = await verifyOAuth2Token(request)

  if (!result.success || !result.payload) {
    return result
  }

  // Check if token has required scope
  if (!hasScope(result.payload.scopes, requiredScope)) {
    return {
      success: false,
      error: 'insufficient_scope',
      errorDescription: `Token does not have required scope: ${requiredScope}`
    }
  }

  return result
}

/**
 * Create error response for OAuth2 authentication failures
 */
export function createOAuth2ErrorResponse(
  result: OAuth2VerificationResult,
  status: number = 401
): Response {
  return new Response(
    JSON.stringify({
      error: result.error || 'unauthorized',
      error_description: result.errorDescription || 'Authentication failed'
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="M2M API"',
        'Cache-Control': 'no-store'
      }
    }
  )
}
