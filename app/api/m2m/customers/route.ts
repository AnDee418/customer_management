/**
 * M2M API - 顧客作成
 * OAuth2 CC認証、レート制限、IP Allowlist、ユーザーコンテキスト必須
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  verifyOAuth2TokenWithScope,
  createOAuth2ErrorResponse
} from '@/lib/auth/oauth2Middleware'
import { getUserContextFromRequest } from '@/lib/auth/userContext'
import { getClientIP, isIPAllowed } from '@/lib/middleware/ipAllowlist'
import { checkRateLimit } from '@/lib/middleware/rateLimit'
import { structuredLog, logAudit } from '@/lib/audit/logger'

// バリデーションスキーマ
const createCustomerSchema = z.object({
  customer_code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200),
  name_kana: z.string().max(200).optional(),
  customer_type: z.enum(['顧客', 'スタッフ', 'サポート', '社員', '代理店', 'その他']),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  postal_code: z.string().max(10).optional().nullable(),
  prefecture: z.string().max(10).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  address_line1: z.string().max(200).optional().nullable(),
  address_line2: z.string().max(200).optional().nullable(),
  birth_date: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  notes: z.string().optional().nullable()
})

export async function POST(request: NextRequest) {
  try {
    // 1. IP Allowlistチェック
    const clientIP = getClientIP(request)
    if (!isIPAllowed(clientIP)) {
      structuredLog('warn', 'M2M create request from disallowed IP', {
        ip: clientIP,
        path: request.nextUrl.pathname,
      })
      return NextResponse.json(
        { error: 'Forbidden: IP not allowed' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 2. レート制限チェック（作成は厳しめ: 20req/分）
    const rateLimitKey = clientIP || 'unknown'
    const rateLimit = checkRateLimit(rateLimitKey, 20, 60000)

    if (!rateLimit.allowed) {
      structuredLog('warn', 'M2M create rate limit exceeded', {
        ip: clientIP,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      })
      return NextResponse.json(
        { error: 'Too many requests', resetAt: rateLimit.resetAt },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetAt),
          },
        }
      )
    }

    // 3. OAuth2 CC認証チェック（customers:write スコープ必須）
    const authResult = await verifyOAuth2TokenWithScope(request, 'customers:write')

    if (!authResult.success || !authResult.payload) {
      structuredLog('warn', 'M2M create authentication failed', {
        ip: clientIP,
        error: authResult.error
      })
      return createOAuth2ErrorResponse(authResult, 401)
    }

    // 4. ユーザーコンテキスト取得（必須）
    const userContext = await getUserContextFromRequest(request, true)

    if (!userContext || !userContext.internalUserId) {
      structuredLog('warn', 'M2M create without user context', {
        client_id: authResult.payload.client_id,
        ip: clientIP
      })
      return NextResponse.json(
        { error: 'X-User-Context header is required for creating customers' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    structuredLog('info', 'M2M create request with user context', {
      client_id: authResult.payload.client_id,
      external_user_id: userContext.externalUserId,
      internal_user_id: userContext.internalUserId,
      role: userContext.role
    })

    // 5. リクエストボディ検証
    const body = await request.json()
    const validatedData = createCustomerSchema.parse(body)

    // 6. Supabase クライアント初期化
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 7. 顧客作成（owner_user_idは内部ユーザーIDを使用）
    const { data: customer, error: createError } = await supabase
      .from('customers')
      .insert({
        ...validatedData,
        owner_user_id: userContext.internalUserId,
        team_id: userContext.teamId || null
      })
      .select('id, customer_code, name, customer_type, created_at, updated_at')
      .single()

    if (createError) {
      structuredLog('error', 'M2M create failed', {
        error: createError.message,
        code: createError.code
      })

      // 重複エラーの場合
      if (createError.code === '23505') {
        return NextResponse.json(
          { error: 'Customer with this code already exists' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        )
      }

      return NextResponse.json(
        { error: createError.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 8. 監査ログ記録
    await logAudit({
      actor_user_id: userContext.internalUserId,
      entity: 'customers',
      action: 'create',
      entity_id: customer.id,
      diff: {
        metadata: {
          client_id: authResult.payload.client_id,
          via: 'm2m_api',
          external_user_id: userContext.externalUserId
        },
        newValue: customer
      }
    })

    structuredLog('info', 'M2M customer created', {
      customer_id: customer.id,
      customer_code: customer.customer_code,
      owner: userContext.internalUserId,
      ip: clientIP
    })

    return NextResponse.json(
      { customer },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    structuredLog('error', 'M2M create failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

/**
 * OPTIONS /api/m2m/customers
 *
 * CORS preflight support
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Context',
      'Access-Control-Max-Age': '86400'
    }
  })
}
