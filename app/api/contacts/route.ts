/**
 * 担当者一覧・作成API
 * GET: 顧客IDで絞り込み、POST: 作成
 * RLS適用（顧客所有者チェック）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/session'
import { errorResponse } from '@/lib/errors/handler'
import { validate, createContactSchema } from '@/lib/validation/schemas'
import { logAudit, structuredLog } from '@/lib/audit/logger'

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    await getAuthUser()
    
    const supabase = createAuthenticatedClient()
    const searchParams = request.nextUrl.searchParams
    const customer_id = searchParams.get('customer_id')
    
    if (!customer_id) {
      return NextResponse.json(
        { error: 'customer_id is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

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

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false })

    if (error) {
      structuredLog('error', 'Contacts fetch failed', { customer_id, error: error.message })
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    structuredLog('info', 'Contacts fetched', { customer_id, count: data.length })

    return NextResponse.json(
      { data },
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
    const validation = validate(createContactSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.errors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 顧客へのアクセス権チェック（RLSで自動チェック）
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', validation.data.customer_id)
      .is('deleted_at', null)
      .single()

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or access denied' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert(validation.data)
      .select()
      .single()

    if (error) {
      structuredLog('error', 'Contact create failed', { error: error.message })
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 監査ログ記録
    await logAudit({
      actor_user_id: user.id,
      entity: 'contacts',
      entity_id: data.id,
      action: 'create',
      diff: { after: data },
    })

    structuredLog('info', 'Contact created', { contact_id: data.id, customer_id: validation.data.customer_id, actor: user.id })

    return NextResponse.json(data, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    return errorResponse(error)
  }
}

