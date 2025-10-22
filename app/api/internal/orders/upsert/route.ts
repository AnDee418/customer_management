/**
 * 内部API - 発注データupsert
 * 連携サービス専用、OAuth2 CC認証
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { verifyOAuth2Token } from '@/lib/auth/oauth2'
import { ensureCustomerId } from '@/lib/customers/resolver'
import { validate, upsertOrderSchema } from '@/lib/validation/schemas'
import { structuredLog } from '@/lib/audit/logger'

export async function POST(request: NextRequest) {
  try {
    // OAuth2 CC認証チェック
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

    const body = await request.json()

    // customer_code/customer_id から確実にIDを取得
    const customerId = await ensureCustomerId(body.customer_id || body.customer_code)

    // バリデーション（customer_idは解決済みなので上書き）
    const orderPayload = { ...body, customer_id: customerId }
    const validation = validate(upsertOrderSchema, orderPayload)
    
    if (!validation.success) {
      structuredLog('error', 'Order upsert validation failed', {
        errors: validation.errors.errors,
      })
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.errors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const orderData = validation.data

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('orders')
      .upsert(orderData, {
        onConflict: 'external_order_id,source_system',
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // TODO: integration_jobs更新

    return NextResponse.json(data, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

