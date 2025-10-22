/**
 * 顧客詳細・更新・削除API
 * GET: 詳細、PUT: 更新、DELETE: 論理削除
 * RLS適用
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/session'
import { errorResponse } from '@/lib/errors/handler'
import { validate, updateCustomerSchema } from '@/lib/validation/schemas'
import { logAudit, generateDiff, structuredLog } from '@/lib/audit/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 認証チェック
    await getAuthUser()
    
    const supabase = createAuthenticatedClient()
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single()

    if (error) {
      structuredLog('error', 'Customer fetch failed', { customer_id: params.id, error: error.message })
      return NextResponse.json({ error: error.message }, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' }
      })
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 認証チェック
    const user = await getAuthUser()
    
    const supabase = createAuthenticatedClient()
    
    // 更新前データ取得（diff用）
    const { data: before } = await supabase
      .from('customers')
      .select('*')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single()

    if (!before) {
      return NextResponse.json({ error: 'Customer not found' }, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' }
      })
    }

    const body = await request.json()

    // バリデーション
    const validation = validate(updateCustomerSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.errors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const { data, error } = await supabase
      .from('customers')
      .update(validation.data)
      .eq('id', params.id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      structuredLog('error', 'Customer update failed', { customer_id: params.id, error: error.message })
      return NextResponse.json({ error: error.message }, {
        status: 400,
        headers: { 'Cache-Control': 'no-store' }
      })
    }

    // 監査ログ記録（diff生成）
    const diff = generateDiff(before, data)
    await logAudit({
      actor_user_id: user.id,
      entity: 'customers',
      entity_id: params.id,
      action: 'update',
      diff,
    })

    structuredLog('info', 'Customer updated', { customer_id: params.id, actor: user.id })

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 認証チェック
    const user = await getAuthUser()
    
    const supabase = createAuthenticatedClient()

    // 削除前データ取得（監査用）
    const { data: before } = await supabase
      .from('customers')
      .select('*')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single()

    if (!before) {
      return NextResponse.json({ error: 'Customer not found' }, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' }
      })
    }

    // 論理削除（deleted_at設定）
    const { data, error } = await supabase
      .from('customers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      structuredLog('error', 'Customer delete failed', { customer_id: params.id, error: error.message })
      return NextResponse.json({ error: error.message }, {
        status: 400,
        headers: { 'Cache-Control': 'no-store' }
      })
    }

    // 監査ログ記録
    await logAudit({
      actor_user_id: user.id,
      entity: 'customers',
      entity_id: params.id,
      action: 'delete',
      diff: { before },
    })

    structuredLog('info', 'Customer deleted', { customer_id: params.id, actor: user.id })

    return NextResponse.json(
      { message: 'Deleted successfully' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

