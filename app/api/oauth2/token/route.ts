/**
 * OAuth2 Token Endpoint (Client Credentials Flow)
 *
 * RFC 6749: https://tools.ietf.org/html/rfc6749#section-4.4
 *
 * This endpoint issues access tokens for machine-to-machine (M2M) authentication.
 * External microservices use this to obtain tokens for accessing M2M APIs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import {
  validateClientCredentials,
  validateScopes,
  type OAuth2Client
} from '@/lib/auth/oauth2Config'

/**
 * POST /api/oauth2/token
 *
 * Request format (application/x-www-form-urlencoded):
 *   grant_type=client_credentials
 *   client_id=<client_id>
 *   client_secret=<client_secret>
 *   scope=<space-separated scopes>
 *
 * Response format (application/json):
 *   {
 *     "access_token": "<jwt_token>",
 *     "token_type": "Bearer",
 *     "expires_in": 3600,
 *     "scope": "<granted scopes>"
 *   }
 *
 * Error response format:
 *   {
 *     "error": "invalid_client",
 *     "error_description": "Client authentication failed"
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body (application/x-www-form-urlencoded)
    const formData = await request.formData()

    const grantType = formData.get('grant_type') as string | null
    const clientId = formData.get('client_id') as string | null
    const clientSecret = formData.get('client_secret') as string | null
    const scopeString = formData.get('scope') as string | null

    // 2. Validate grant_type
    if (grantType !== 'client_credentials') {
      return NextResponse.json(
        {
          error: 'unsupported_grant_type',
          error_description: 'Only client_credentials grant type is supported'
        },
        { status: 400 }
      )
    }

    // 3. Validate required parameters
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'Missing client_id or client_secret'
        },
        { status: 400 }
      )
    }

    // 4. Authenticate client
    const client = validateClientCredentials(clientId, clientSecret)

    if (!client) {
      // Log authentication failure (for security monitoring)
      console.warn('OAuth2 authentication failed', {
        client_id: clientId,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString()
      })

      return NextResponse.json(
        {
          error: 'invalid_client',
          error_description: 'Client authentication failed'
        },
        { status: 401 }
      )
    }

    // 5. Validate and filter scopes
    const requestedScopes = scopeString ? scopeString.split(' ').filter(s => s.length > 0) : []
    const grantedScopes = validateScopes(client, requestedScopes)

    if (grantedScopes.length === 0 && requestedScopes.length > 0) {
      return NextResponse.json(
        {
          error: 'invalid_scope',
          error_description: 'None of the requested scopes are allowed for this client'
        },
        { status: 400 }
      )
    }

    // If no scopes requested, grant all allowed scopes
    const finalScopes = grantedScopes.length > 0 ? grantedScopes : client.scopes

    // 6. Generate access token (JWT)
    const expiresIn = 3600 // 1 hour
    const now = Math.floor(Date.now() / 1000)

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set')
      return NextResponse.json(
        {
          error: 'server_error',
          error_description: 'Internal server configuration error'
        },
        { status: 500 }
      )
    }

    const accessToken = await new SignJWT({
      client_id: clientId,
      scopes: finalScopes,
      token_type: 'access_token'
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .setIssuer(process.env.NEXT_PUBLIC_APP_URL || 'customer-management')
      .sign(new TextEncoder().encode(jwtSecret))

    // 7. Log successful token issuance
    console.info('OAuth2 token issued', {
      client_id: clientId,
      scopes: finalScopes,
      expires_in: expiresIn,
      timestamp: new Date().toISOString()
    })

    // 8. Return token response
    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        scope: finalScopes.join(' ')
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache'
        }
      }
    )
  } catch (error) {
    console.error('OAuth2 token endpoint error:', error)

    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/oauth2/token
 *
 * CORS preflight support
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}
