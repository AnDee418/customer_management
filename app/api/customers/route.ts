/**
 * 顧客一覧・作成API
 * GET: 一覧・検索、POST: 作成
 * RLS適用、リアルタイム最優先
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/session'
import { errorResponse } from '@/lib/errors/handler'
import { validate, createCustomerSchema } from '@/lib/validation/schemas'
import { logAudit, structuredLog } from '@/lib/audit/logger'

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    await getAuthUser()
    
    const supabase = createAuthenticatedClient()
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 検索（search_vectorを利用）
    if (search) {
      query = query.textSearch('search_vector', search)
    }

    const { data, error, count } = await query

    if (error) {
      structuredLog('error', 'Customer fetch failed', { error: error.message })
      return errorResponse(error.message, 400)
    }

    structuredLog('info', 'Customers fetched', { count, search, limit, offset })

    return NextResponse.json(
      { data, count },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const user = await getAuthUser()
    
    const supabase = createAuthenticatedClient()
    const body = await request.json()

    // バリデーション
    const validation = validate(createCustomerSchema, body)
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.errors.errors)
    }

    // owner_user_idの自動設定
    const customerData = {
      ...validation.data,
      owner_user_id: user.id,
      team_id: validation.data.team_id || user.team_id,
    }

    const { data, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single()

    if (error) {
      structuredLog('error', 'Customer create failed', { error: error.message })
      return errorResponse(error.message, 400)
    }

    // 監査ログ記録
    await logAudit({
      actor_user_id: user.id,
      entity: 'customers',
      entity_id: data.id,
      action: 'create',
      diff: { after: data },
    })

    structuredLog('info', 'Customer created', { customer_id: data.id, actor: user.id })

    return NextResponse.json(data, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    return errorResponse(error)
  }
}

