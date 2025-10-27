/**
 * M2M参照API - 顧客検索
 * OAuth2 CC認証、レート制限、IP Allowlist、ユーザーコンテキスト対応
 * P95 < 200ms目標、キャッシュ不使用
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  verifyOAuth2TokenWithScope,
  createOAuth2ErrorResponse
} from '@/lib/auth/oauth2Middleware'
import { getUserContextFromRequest, applyRLSFilter } from '@/lib/auth/userContext'
import { getClientIP, isIPAllowed } from '@/lib/middleware/ipAllowlist'
import { checkRateLimit } from '@/lib/middleware/rateLimit'
import { structuredLog, logAudit } from '@/lib/audit/logger'

export async function GET(request: NextRequest) {
  try {
    // 1. IP Allowlistチェック
    const clientIP = getClientIP(request)
    if (!isIPAllowed(clientIP)) {
      structuredLog('warn', 'M2M request from disallowed IP', {
        ip: clientIP,
        path: request.nextUrl.pathname,
      })
      return NextResponse.json(
        { error: 'Forbidden: IP not allowed' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 2. レート制限チェック
    const rateLimitKey = clientIP || 'unknown'
    const rateLimit = checkRateLimit(rateLimitKey, 100, 60000) // 100req/分
    
    if (!rateLimit.allowed) {
      structuredLog('warn', 'M2M rate limit exceeded', {
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

    // 3. OAuth2 CC認証チェック（customers:read スコープ必須）
    const authResult = await verifyOAuth2TokenWithScope(request, 'customers:read')

    if (!authResult.success || !authResult.payload) {
      structuredLog('warn', 'M2M authentication failed', {
        ip: clientIP,
        error: authResult.error
      })
      return createOAuth2ErrorResponse(authResult, 401)
    }

    // 4. ユーザーコンテキスト取得（オプション）
    const userContext = await getUserContextFromRequest(request, true)

    if (userContext) {
      structuredLog('info', 'M2M request with user context', {
        client_id: authResult.payload.client_id,
        external_user_id: userContext.externalUserId,
        internal_user_id: userContext.internalUserId,
        role: userContext.role
      })
    }

    const searchParams = request.nextUrl.searchParams
    const q = searchParams.get('q')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const fieldsParam = searchParams.get('fields')

    // デフォルトフィールド（PIIを含まない）
    const defaultFields = 'id, name, code, created_at'
    
    // 許可されたフィールドのallowlist
    const allowedFields = ['id', 'name', 'code', 'created_at', 'updated_at', 'team_id']
    
    // fieldsパラメータが指定された場合の処理
    let selectFields = defaultFields
    if (fieldsParam) {
      const requestedFields = fieldsParam.split(',').map(f => f.trim())
      const validFields = requestedFields.filter(f => allowedFields.includes(f))
      
      if (validFields.length === 0) {
        return NextResponse.json(
          { error: 'Invalid fields parameter', allowed: allowedFields },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        )
      }
      
      selectFields = validFields.join(', ')
      structuredLog('info', 'M2M custom fields requested', {
        requested: requestedFields,
        validated: validFields,
      })
    }

    // 5. Supabase クライアント初期化（Service Role Key使用）
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

    // 6. クエリ実行（RLSフィルタ適用）
    let query = supabase
      .from('customers')
      .select(selectFields)
      .is('deleted_at', null)
      .limit(limit)

    if (q) {
      query = query.textSearch('search_vector', q)
    }

    // ユーザーコンテキストがある場合、RLS相当のフィルタリングを適用
    query = applyRLSFilter(query, userContext)

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 7. 監査ログ記録（ユーザーコンテキストがある場合）
    if (userContext && userContext.internalUserId) {
      await logAudit({
        actor_user_id: userContext.internalUserId,
        entity: 'customers',
        action: 'sync', // 'search' is not in the allowed actions, using 'sync'
        entity_id: undefined,
        diff: {
          query: q,
          result_count: data.length,
          client_id: authResult.payload.client_id,
          via: 'm2m_api',
          external_user_id: userContext.externalUserId
        }
      })
    }

    structuredLog('info', 'M2M search completed', {
      ip: clientIP,
      resultCount: data.length,
      query: q,
      hasUserContext: !!userContext
    })

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    })
  } catch (error) {
    structuredLog('error', 'M2M search failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

