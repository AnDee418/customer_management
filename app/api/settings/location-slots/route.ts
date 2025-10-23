/**
 * 所属地スロット管理 API
 * GET: 一覧取得
 * POST: 作成
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/errors/handler'
import { validate, createLocationSlotSchema } from '@/lib/validation/schemas'
import { logAudit, structuredLog } from '@/lib/audit/logger'

type AuthenticatedSupabaseClient = ReturnType<typeof createAuthenticatedClient>

const LOCATION_CODE_FALLBACK = 'LOCATION'

function normalizeLocationCodeSource(name: string): string {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized.length > 0 ? normalized : LOCATION_CODE_FALLBACK
}

async function generateLocationSlotCode(
  supabase: AuthenticatedSupabaseClient,
  name: string
): Promise<string> {
  const base = normalizeLocationCodeSource(name)

  const { data, error } = await supabase
    .from('location_slots')
    .select('code')
    .ilike('code', `${base}%`)

  if (error) {
    structuredLog('error', 'Failed to list location slot codes for generation', { error: error.message })
    throw new Error('Failed to generate location slot code')
  }

  const existingCodes = new Set((data ?? []).map(({ code }) => code))
  if (!existingCodes.has(base)) {
    return base
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!existingCodes.has(candidate)) {
      return candidate
    }
  }

  structuredLog('error', 'Exceeded attempts while generating location slot code', { base })
  throw new Error('Failed to generate location slot code')
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
    const supabase = createAuthenticatedClient()
    const normalizedName = payload.name.trim() || payload.name
    const generatedCode = await generateLocationSlotCode(supabase, normalizedName)

    const { data, error } = await supabase
      .from('location_slots')
      .insert({
        code: generatedCode,
        name: normalizedName,
        description: payload.description?.trim() || null,
        sort_order: payload.sort_order ?? 100,
        is_active: payload.is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return errorResponse('同じコードの所属地が既に存在します', 409)
      }

      structuredLog('error', 'Failed to create location slot', { error: error.message })
      return errorResponse('所属地スロットの作成に失敗しました', 500)
    }

    await logAudit({
      actor_user_id: admin.id,
      entity: 'location_slots',
      entity_id: data.id,
      action: 'create',
      diff: { after: data },
    })

    structuredLog('info', 'Location slot created', {
      actor: admin.id,
      location_slot_id: data.id,
      code: data.code,
    })

    return NextResponse.json(
      { data },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
