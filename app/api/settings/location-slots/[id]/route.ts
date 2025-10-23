/**
 * 所属地スロット更新 API
 * PATCH: 名称・説明・並び順・ステータスを更新
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/errors/handler'
import { validate, updateLocationSlotSchema } from '@/lib/validation/schemas'
import { logAudit, generateDiff, structuredLog } from '@/lib/audit/logger'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin()
    const slotId = params.id

    if (!slotId) {
      return errorResponse('所属地IDが指定されていません', 400)
    }

    const body = await request.json()
    const validation = validate(updateLocationSlotSchema, {
      ...body,
      is_active: typeof body?.is_active === 'string' ? body.is_active !== 'false' : body?.is_active,
    })

    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.errors.flatten())
    }

    const updates = validation.data
    if (Object.keys(updates).length === 0) {
      return errorResponse('更新項目がありません', 400)
    }

    const supabase = createAuthenticatedClient()

    const { data: current, error: fetchError } = await supabase
      .from('location_slots')
      .select('*')
      .eq('id', slotId)
      .single()

    if (fetchError) {
      structuredLog('error', 'Failed to fetch location slot before update', { error: fetchError.message, slotId })
      return errorResponse('所属地スロットが見つかりません', 404)
    }

    const { data, error } = await supabase
      .from('location_slots')
      .update({
        ...(updates.name !== undefined ? { name: updates.name?.trim() || null } : {}),
        ...(updates.description !== undefined ? { description: updates.description?.trim() || null } : {}),
        ...(updates.sort_order !== undefined ? { sort_order: updates.sort_order } : {}),
        ...(updates.is_active !== undefined ? { is_active: updates.is_active } : {}),
      })
      .eq('id', slotId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return errorResponse('同じコードの所属地が既に存在します', 409)
      }

      structuredLog('error', 'Failed to update location slot', { error: error.message, slotId })
      return errorResponse('所属地スロットの更新に失敗しました', 500)
    }

    await logAudit({
      actor_user_id: admin.id,
      entity: 'location_slots',
      entity_id: slotId,
      action: 'update',
      diff: generateDiff(current, data),
    })

    structuredLog('info', 'Location slot updated', {
      actor: admin.id,
      location_slot_id: slotId,
    })

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
