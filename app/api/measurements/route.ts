/**
 * 測定データ参照API（UI向け）
 * GET: 顧客IDまたは発注IDで絞り込み
 * RLS適用（顧客所有者チェック）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/session'
import { errorResponse } from '@/lib/errors/handler'
import { structuredLog } from '@/lib/audit/logger'

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    await getAuthUser()
    
    const supabase = createAuthenticatedClient()
    const searchParams = request.nextUrl.searchParams
    const customer_id = searchParams.get('customer_id')
    const order_id = searchParams.get('order_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    if (!customer_id && !order_id) {
      return NextResponse.json(
        { error: 'customer_id or order_id is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    let query = supabase
      .from('measurements')
      .select('*, orders(id, external_order_id, title)', { count: 'exact' })

    if (customer_id) {
      // 顧客へのアクセス権チェック（RLSで自動チェック）
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', customer_id)
        .is('deleted_at', null)
        .single()

      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found or access denied' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        )
      }

      query = query.eq('customer_id', customer_id)
    }

    if (order_id) {
      query = query.eq('order_id', order_id)
    }

    const { data, error, count } = await query
      .order('measured_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      structuredLog('error', 'Measurements fetch failed', { customer_id, order_id, error: error.message })
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    structuredLog('info', 'Measurements fetched', { customer_id, order_id, count })

    return NextResponse.json(
      { data, count },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

