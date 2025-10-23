/**
 * 所属チーム更新 API
 * PATCH: 名称更新
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/errors/handler'
import { validate, updateTeamSchema } from '@/lib/validation/schemas'
import { logAudit, generateDiff, structuredLog } from '@/lib/audit/logger'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin()
    const teamId = params.id

    if (!teamId) {
      return errorResponse('チームIDが指定されていません', 400)
    }

    const body = await request.json()
    const validation = validate(updateTeamSchema, body)

    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.errors.flatten())
    }

    const updates = validation.data
    if (Object.keys(updates).length === 0) {
      return errorResponse('更新項目がありません', 400)
    }

    const supabase = createAuthenticatedClient()

    const { data: current, error: fetchError } = await supabase
      .from('teams')
      .select('id, name, created_at')
      .eq('id', teamId)
      .single()

    if (fetchError) {
      structuredLog('error', 'Failed to fetch team before update', { error: fetchError.message, teamId })
      return errorResponse('所属チームが見つかりません', 404)
    }

    const { data, error } = await supabase
      .from('teams')
      .update({
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      })
      .eq('id', teamId)
      .select('id, name, created_at')
      .single()

    if (error) {
      structuredLog('error', 'Failed to update team', { error: error.message, teamId })
      return errorResponse('所属チームの更新に失敗しました', 500)
    }

    await logAudit({
      actor_user_id: admin.id,
      entity: 'teams',
      entity_id: teamId,
      action: 'update',
      diff: generateDiff(current, data),
    })

    structuredLog('info', 'Team updated', {
      actor: admin.id,
      team_id: teamId,
    })

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
