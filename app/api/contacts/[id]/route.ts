/**
 * 担当者詳細・更新・削除API
 * GET: 詳細、PUT: 更新、DELETE: 削除
 * RLS適用（顧客所有者チェック）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/session'
import { errorResponse } from '@/lib/errors/handler'
import { validate, updateContactSchema } from '@/lib/validation/schemas'
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
      .from('contacts')
      .select('*, customers!inner(id, name)')
      .eq('id', params.id)
      .single()

    if (error) {
      structuredLog('error', 'Contact fetch failed', { contact_id: params.id, error: error.message })
      return NextResponse.json(
        { error: error.message },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
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
    
    // 更新前データ取得（diff用 & アクセス権チェック）
    const { data: before } = await supabase
      .from('contacts')
      .select('*, customers!inner(id)')
      .eq('id', params.id)
      .single()

    if (!before) {
      return NextResponse.json(
        { error: 'Contact not found or access denied' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const body = await request.json()

    // バリデーション
    const validation = validate(updateContactSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.errors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const { data, error } = await supabase
      .from('contacts')
      .update(validation.data)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      structuredLog('error', 'Contact update failed', { contact_id: params.id, error: error.message })
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 監査ログ記録（diff生成）
    const diff = generateDiff(before, data)
    await logAudit({
      actor_user_id: user.id,
      entity: 'contacts',
      entity_id: params.id,
      action: 'update',
      diff,
    })

    structuredLog('info', 'Contact updated', { contact_id: params.id, actor: user.id })

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

    // 削除前データ取得（監査用 & アクセス権チェック）
    const { data: before } = await supabase
      .from('contacts')
      .select('*, customers!inner(id)')
      .eq('id', params.id)
      .single()

    if (!before) {
      return NextResponse.json(
        { error: 'Contact not found or access denied' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', params.id)

    if (error) {
      structuredLog('error', 'Contact delete failed', { contact_id: params.id, error: error.message })
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 監査ログ記録
    await logAudit({
      actor_user_id: user.id,
      entity: 'contacts',
      entity_id: params.id,
      action: 'delete',
      diff: { before },
    })

    structuredLog('info', 'Contact deleted', { contact_id: params.id, actor: user.id })

    return NextResponse.json(
      { message: 'Deleted successfully' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

