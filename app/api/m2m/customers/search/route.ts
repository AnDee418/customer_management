/**
 * M2M参照API - 顧客検索
 * OAuth2 CC認証、レート制限、IP Allowlist
 * P95 < 200ms目標、キャッシュ不使用
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { verifyOAuth2Token } from '@/lib/auth/oauth2'
import { getClientIP, isIPAllowed } from '@/lib/middleware/ipAllowlist'
import { checkRateLimit } from '@/lib/middleware/rateLimit'
import { structuredLog } from '@/lib/audit/logger'

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

    // 3. OAuth2 CC認証チェック
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const token = authHeader.substring(7)
    const isValid = await verifyOAuth2Token(token)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
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

    const supabase = createServerClient()
    
    let query = supabase
      .from('customers')
      .select(selectFields)
      .is('deleted_at', null)
      .limit(limit)

    if (q) {
      query = query.textSearch('search_vector', q)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    structuredLog('info', 'M2M search completed', {
      ip: clientIP,
      resultCount: data.length,
      query: q,
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

