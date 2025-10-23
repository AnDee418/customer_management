/**
 * 所属地スロット管理 API
 * GET: 一覧取得
 * POST: 作成
 */
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { createAuthenticatedClient, createServiceClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/errors/handler'
import { validate, createLocationSlotSchema } from '@/lib/validation/schemas'
import { logAudit, structuredLog } from '@/lib/audit/logger'

const LOCATION_CODE_FALLBACK = 'LOCATION'
const MAX_CODE_GENERATION_ATTEMPTS = 5

function normalizeLocationCodeSource(name: string): string {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized.length > 0 ? normalized : LOCATION_CODE_FALLBACK
}

function randomSuffix(length = 4): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .toUpperCase()
    .slice(0, length)
}

export async function GET() {
  try {
    await requireAdmin()

    const supabase = createAuthenticatedClient()
    const { data, error } = await supabase
      .from('location_slots')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      if (
        error.code === '42P01' ||
        error.message?.includes("Could not find the table 'public.location_slots'")
      ) {
        structuredLog('error', 'Location slot table missing in Supabase during fetch', {
          error: error.message,
        })
        return errorResponse(
          '所属地スロットのテーブルが存在しません。最新のデータベースマイグレーションを適用してください。',
          500
        )
      }

      structuredLog('error', 'Failed to fetch location slots', { error: error.message })
      return errorResponse('所属地スロットの取得に失敗しました', 500)
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
    const validation = validate(createLocationSlotSchema, {
      ...body,
      is_active: typeof body?.is_active === 'string' ? body.is_active !== 'false' : body?.is_active,
    })

    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.errors.flatten())
    }

    const payload = validation.data
    const serviceClient = createServiceClient()
    const normalizedName = payload.name.trim() || payload.name
    const baseCode = normalizeLocationCodeSource(normalizedName)

    let createdSlot: any = null

    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const candidateCode = attempt === 0 ? baseCode : `${baseCode}-${randomSuffix()}`

      const { data, error } = await serviceClient
        .from('location_slots')
        .insert({
          code: candidateCode,
          name: normalizedName,
          description: payload.description?.trim() || null,
          sort_order: payload.sort_order ?? 100,
          is_active: payload.is_active ?? true,
        })
        .select()
        .single()

      if (!error) {
        createdSlot = data
        break
      }

      if (error.code === '23505') {
        structuredLog('warn', 'Location slot code collision detected; retrying', {
          attempt,
          baseCode,
          candidateCode,
        })
        continue
      }

      if (
        error.code === '42P01' ||
        error.message?.includes("Could not find the table 'public.location_slots'")
      ) {
        structuredLog('error', 'Location slot table missing in Supabase', {
          error: error.message,
        })
        return errorResponse(
          '所属地スロットのテーブルが存在しません。最新のデータベースマイグレーションを適用してください。',
          500
        )
      }

      structuredLog('error', 'Failed to create location slot', { error: error.message })
      return errorResponse('所属地スロットの作成に失敗しました', 500)
    }

    if (!createdSlot) {
      structuredLog('error', 'Failed to create location slot after exhausting code generation attempts', {
        baseCode,
        attempts: MAX_CODE_GENERATION_ATTEMPTS,
      })
      return errorResponse('所属地スロットの作成に失敗しました', 500)
    }

    await logAudit({
      actor_user_id: admin.id,
      entity: 'location_slots',
      entity_id: createdSlot.id,
      action: 'create',
      diff: { after: createdSlot },
    })

    structuredLog('info', 'Location slot created', {
      actor: admin.id,
      location_slot_id: createdSlot.id,
      code: createdSlot.code,
    })

    return NextResponse.json(
      { data: createdSlot },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
