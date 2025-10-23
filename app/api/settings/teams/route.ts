/**
 * 所属チーム管理 API
 * GET: 一覧取得
 * POST: 作成
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/errors/handler'
import { validate, createTeamSchema } from '@/lib/validation/schemas'
import { logAudit, structuredLog } from '@/lib/audit/logger'

export async function GET() {
  try {
    await requireAdmin()

    const supabase = createAuthenticatedClient()
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      structuredLog('error', 'Failed to fetch teams', { error: error.message })
      return errorResponse('所属チームの取得に失敗しました', 500)
    }

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
    const admin = await requireAdmin()
    const body = await request.json()
    const validation = validate(createTeamSchema, body)

    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.errors.flatten())
    }

    const payload = validation.data
    const supabase = createAuthenticatedClient()

    const { data, error } = await supabase
      .from('teams')
      .insert({ name: payload.name.trim() })
      .select('id, name, created_at')
      .single()

    if (error) {
      structuredLog('error', 'Failed to create team', { error: error.message })
      return errorResponse('所属チームの作成に失敗しました', 500)
    }

    await logAudit({
      actor_user_id: admin.id,
      entity: 'teams',
      entity_id: data.id,
      action: 'create',
      diff: { after: data },
    })

    structuredLog('info', 'Team created', {
      actor: admin.id,
      team_id: data.id,
    })

    return NextResponse.json(
      { data },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
