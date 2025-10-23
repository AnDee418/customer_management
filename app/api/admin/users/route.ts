/**
 * 管理者用ユーザー管理エンドポイント
 * - GET: ユーザー一覧の取得（検索・フィルタ・簡易集計付き）
 * - POST: アカウント発行（招待 or 即時有効化）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createAuthenticatedClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/session'
import { errorResponse } from '@/lib/errors/handler'
import { structuredLog, logAudit } from '@/lib/audit/logger'
import { createAdminUserSchema, validate } from '@/lib/validation/schemas'
import type { User } from '@supabase/supabase-js'
import { buildAdminUser, type ProfileRow, type TeamRow, type AdminUserDTO, type LocationSlotRow } from './shared'

const MAX_USER_FETCH = 1000
const DEFAULT_PER_PAGE = 25

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin()
    const service = createServiceClient()
    const authedClient = createAuthenticatedClient()

    const search = request.nextUrl.searchParams.get('search')?.toLowerCase().trim() ?? ''
    const roleFilter = request.nextUrl.searchParams.get('role')?.trim()
    const statusFilter = request.nextUrl.searchParams.get('status')?.trim()
    const page = Math.max(parseInt(request.nextUrl.searchParams.get('page') || '1', 10), 1)
    const perPageParam = parseInt(request.nextUrl.searchParams.get('per_page') || `${DEFAULT_PER_PAGE}`, 10)
    const perPage = Math.min(Math.max(perPageParam, 1), 100)

    const [profilesResult, teamsResult, locationsResult] = await Promise.all([
      authedClient
        .from('profiles')
        .select('user_id, role, display_name, department, team_id, location_id, created_at'),
      authedClient
        .from('teams')
        .select('id, name')
        .order('name', { ascending: true }),
      authedClient
        .from('location_slots')
        .select('id, name, code, is_active, sort_order')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
    ])

    if (profilesResult.error) {
      structuredLog('warn', 'Failed to fetch profiles for admin view; continuing with empty profile map', {
        error: profilesResult.error.message,
      })
    }

    if (teamsResult.error) {
      structuredLog('warn', 'Failed to fetch teams for admin view; continuing with empty teams list', {
        error: teamsResult.error.message,
      })
    }

    if (locationsResult.error) {
      structuredLog('warn', 'Failed to fetch location slots for admin view; continuing with empty list', {
        error: locationsResult.error.message,
      })
    }

    const profileMap = new Map<string, ProfileRow>()
    profilesResult.data?.forEach((row) => profileMap.set(row.user_id, row))

    const teams = teamsResult.data ?? []
    const teamMap = new Map<string, TeamRow>()
    teams.forEach((team) => teamMap.set(team.id, team))

    const locations = locationsResult.data ?? []
    const locationMap = new Map<string, LocationSlotRow>()
    locations.forEach((location) => locationMap.set(location.id, location))

    let users: User[]
    try {
      users = await fetchAllUsers(service)
    } catch (fetchError: any) {
      const message = fetchError?.message || 'Unknown error'
      structuredLog('error', 'Fetching auth users failed', { error: message })
      return errorResponse('Failed to load user directory', 500)
    }

    const merged = users.map((user) => buildAdminUser(user, profileMap.get(user.id), teamMap, locationMap))

    const filtered = merged.filter((user) => {
      const matchesSearch =
        !search ||
        user.email?.toLowerCase().includes(search) ||
        user.display_name?.toLowerCase().includes(search) ||
        user.department?.toLowerCase().includes(search) ||
        user.team_name?.toLowerCase().includes(search) ||
        user.location_name?.toLowerCase().includes(search)

      const matchesRole = !roleFilter || user.role === roleFilter
      const matchesStatus = !statusFilter || user.status === statusFilter

      return matchesSearch && matchesRole && matchesStatus
    })

    const total = filtered.length
    const start = (page - 1) * perPage
    const end = start + perPage
    const paginated = filtered.slice(start, end)

    const roleSummary = filtered.reduce<Record<string, number>>((acc, user) => {
      const role = user.role ?? 'unknown'
      acc[role] = (acc[role] || 0) + 1
      return acc
    }, {})

    structuredLog('info', 'Admin users fetched', {
      actor: adminUser.id,
      total,
      search,
      roleFilter,
      statusFilter,
    })

    return NextResponse.json(
      {
        data: paginated,
        total,
        page,
        per_page: perPage,
        role_summary: roleSummary,
        teams,
        locations,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin()
    const body = await request.json()
    const validation = validate(createAdminUserSchema, body)

    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.errors.flatten())
    }

    const payload = validation.data
    const service = createServiceClient()

    // Try to create the user (Supabase will handle duplicate email check)
    const createResult = await service.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        display_name: payload.display_name,
        department: payload.department ?? undefined,
        team_id: payload.team_id ?? undefined,
        location_id: payload.location_id ?? undefined,
      },
      app_metadata: {
        role: payload.role,
      },
    })

    if (createResult.error || !createResult.data.user) {
      structuredLog('error', 'Admin user creation failed', {
        error: createResult.error?.message,
        email: payload.email,
      })

      // Handle duplicate email error
      const errorMsg = createResult.error?.message || ''
      if (errorMsg.toLowerCase().includes('already') || errorMsg.toLowerCase().includes('duplicate')) {
        return errorResponse('同じメールアドレスのユーザーが既に存在します', 409)
      }

      return errorResponse(createResult.error?.message || 'ユーザー作成に失敗しました', 400)
    }

    const userResponse = createResult

    const createdUser = userResponse.data.user!

    const updateResult = await service.auth.admin.updateUserById(createdUser.id, {
      user_metadata: {
        ...(createdUser.user_metadata || {}),
        display_name: payload.display_name,
        department: payload.department ?? undefined,
        team_id: payload.team_id ?? undefined,
        location_id: payload.location_id ?? undefined,
      },
      app_metadata: {
        ...(createdUser.app_metadata || {}),
        role: payload.role,
      },
    })

    if (updateResult.error || !updateResult.data.user) {
      structuredLog('error', 'Admin user metadata sync failed', {
        error: updateResult.error?.message,
        user_id: createdUser.id,
      })
      return errorResponse(updateResult.error?.message || 'ユーザーメタデータの同期に失敗しました', 500)
    }

    const { data: profileData, error: profileError } = await service
      .from('profiles')
      .upsert(
        {
          user_id: createdUser.id,
          role: payload.role,
          display_name: payload.display_name,
          department: payload.department ?? null,
          team_id: payload.team_id ?? null,
          location_id: payload.location_id ?? null,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (profileError) {
      structuredLog('error', 'Failed to persist profile for new user', {
        error: profileError.message,
        user_id: createdUser.id,
      })
      return errorResponse('プロファイルの作成に失敗しました', 500)
    }

    await logAudit({
      actor_user_id: adminUser.id,
      entity: 'profiles',
      entity_id: createdUser.id,
      action: 'create',
      diff: { after: profileData },
    })

    const finalUserResult = await service.auth.admin.getUserById(createdUser.id)
    if (finalUserResult.error || !finalUserResult.data.user) {
      structuredLog('error', 'Failed to re-fetch created user', {
        error: finalUserResult.error?.message,
        user_id: createdUser.id,
      })
      return errorResponse('ユーザー情報の取得に失敗しました', 500)
    }

    const [teamsResult, locationsResult] = await Promise.all([
      service.from('teams').select('id, name'),
      service.from('location_slots').select('id, name, code, is_active'),
    ])

    const teamMap = new Map<string, TeamRow>()
    teamsResult.data?.forEach((team: TeamRow) => teamMap.set(team.id, team))

    const locationMap = new Map<string, LocationSlotRow>()
    locationsResult.data?.forEach((location: LocationSlotRow) => locationMap.set(location.id, location))

    const mergedUser = buildAdminUser(finalUserResult.data.user, profileData, teamMap, locationMap)

    structuredLog('info', 'Admin user created', {
      actor: adminUser.id,
      user_id: mergedUser.id,
      role: mergedUser.role,
    })

    return NextResponse.json(
      {
        data: mergedUser,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

async function fetchAllUsers(service: ReturnType<typeof createServiceClient>) {
  const users: User[] = []
  let page = 1
  const perPage = 200

  while (users.length < MAX_USER_FETCH) {
    const response = await service.auth.admin.listUsers({ page, perPage })

    if (response.error) {
      structuredLog('error', 'Failed to list users', { error: response.error.message, page })
      throw response.error
    }

    users.push(...response.data.users)

    if (!response.data.nextPage || response.data.nextPage === page) {
      break
    }

    page = response.data.nextPage
  }

  return users.slice(0, MAX_USER_FETCH)
}
