/**
 * 管理者用ユーザー更新エンドポイント
 * - PATCH: プロファイル/権限/所属情報の更新
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/session'
import { errorResponse } from '@/lib/errors/handler'
import { structuredLog, logAudit } from '@/lib/audit/logger'
import { validate, updateAdminUserSchema } from '@/lib/validation/schemas'
import { generateDiff } from '@/lib/audit/logger'
import { buildAdminUser, type TeamRow, type ProfileRow, type LocationSlotRow } from '../shared'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await requireAdmin()
    const userId = params.id

    if (!userId) {
      return errorResponse('ユーザーIDが指定されていません', 400)
    }

    const body = await request.json()
    const validation = validate(updateAdminUserSchema, body)

    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.errors.flatten())
    }

    const payload = validation.data
    const providedKeys = Object.keys(payload).filter((key) => payload[key as keyof typeof payload] !== undefined)

    if (providedKeys.length === 0) {
      return errorResponse('更新対象のフィールドが存在しません', 400)
    }

    const service = createServiceClient()

    const [userResult, profileResult] = await Promise.all([
      service.auth.admin.getUserById(userId),
      service
        .from('profiles')
        .select('user_id, role, display_name, department, team_id, location_id, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle(),
    ])

    if (userResult.error || !userResult.data.user) {
      structuredLog('error', 'Admin user fetch failed for update', {
        error: userResult.error?.message,
        user_id: userId,
      })
      return errorResponse('ユーザーが見つかりません', 404)
    }

    if (profileResult.error) {
      structuredLog('error', 'Profile fetch failed for admin update', {
        error: profileResult.error.message,
        user_id: userId,
      })
      return errorResponse('プロファイル取得に失敗しました', 500)
    }

    const currentProfile: ProfileRow | null = profileResult.data ?? null
    const beforeProfile = {
      role: currentProfile?.role ?? (userResult.data.user.app_metadata as any)?.role ?? null,
      display_name: currentProfile?.display_name ?? (userResult.data.user.user_metadata as any)?.display_name ?? null,
      department: currentProfile?.department ?? (userResult.data.user.user_metadata as any)?.department ?? null,
      team_id: currentProfile?.team_id ?? (userResult.data.user.user_metadata as any)?.team_id ?? null,
      location_id: currentProfile?.location_id ?? (userResult.data.user.user_metadata as any)?.location_id ?? null,
    }

    const mergedProfile: ProfileRow = {
      user_id: userId,
      role: payload.role ?? beforeProfile.role ?? 'user',
      display_name:
        payload.display_name !== undefined
          ? payload.display_name ?? null
          : beforeProfile.display_name ?? null,
      department:
        payload.department !== undefined ? payload.department ?? null : beforeProfile.department ?? null,
      team_id: payload.team_id !== undefined ? payload.team_id ?? null : beforeProfile.team_id ?? null,
      location_id:
        payload.location_id !== undefined ? payload.location_id ?? null : beforeProfile.location_id ?? null,
    }

    const { data: profileData, error: profileError } = await service
      .from('profiles')
      .upsert(mergedProfile, { onConflict: 'user_id' })
      .select()
      .single()

    if (profileError) {
      structuredLog('error', 'Profile upsert failed during admin update', {
        error: profileError.message,
        user_id: userId,
      })
      return errorResponse('プロファイルの更新に失敗しました', 500)
    }

    const userMetadata: Record<string, any> = {}
    const appMetadata: Record<string, any> = {}

    if (payload.display_name !== undefined) {
      userMetadata.display_name = payload.display_name ?? null
    }
    if (payload.department !== undefined) {
      userMetadata.department = payload.department ?? null
    }
    if (payload.team_id !== undefined) {
      userMetadata.team_id = payload.team_id ?? null
    }
    if (payload.location_id !== undefined) {
      userMetadata.location_id = payload.location_id ?? null
    }
    if (payload.role !== undefined) {
      appMetadata.role = payload.role
    }

    if (Object.keys(userMetadata).length > 0 || Object.keys(appMetadata).length > 0) {
      const updatePayload: Record<string, any> = {}
      if (Object.keys(userMetadata).length > 0) {
        updatePayload.user_metadata = {
          ...(userResult.data.user.user_metadata || {}),
          ...userMetadata,
        }
      }
      if (Object.keys(appMetadata).length > 0) {
        updatePayload.app_metadata = {
          ...(userResult.data.user.app_metadata || {}),
          ...appMetadata,
        }
      }

      const updateResult = await service.auth.admin.updateUserById(userId, updatePayload)
      if (updateResult.error || !updateResult.data.user) {
        structuredLog('error', 'Auth user metadata update failed', {
          error: updateResult.error?.message,
          user_id: userId,
        })
        return errorResponse('ユーザー情報の更新に失敗しました', 500)
      }
    }

    const [teamsResult, locationsResult] = await Promise.all([
      service.from('teams').select('id, name'),
      service.from('location_slots').select('id, name, code, is_active'),
    ])
    if (teamsResult.error) {
      structuredLog('error', 'Failed to load teams during admin update', {
        error: teamsResult.error.message,
        user_id: userId,
      })
      return errorResponse('チーム情報の取得に失敗しました', 500)
    }
    if (locationsResult.error) {
      structuredLog('error', 'Failed to load locations during admin update', {
        error: locationsResult.error.message,
        user_id: userId,
      })
      return errorResponse('所属地情報の取得に失敗しました', 500)
    }
    const teamMap = new Map<string, TeamRow>()
    teamsResult.data?.forEach((team) => teamMap.set(team.id, team))
    const locationMap = new Map<string, LocationSlotRow>()
    locationsResult.data?.forEach((location) => locationMap.set(location.id, location))

    const refreshedUser = await service.auth.admin.getUserById(userId)
    if (refreshedUser.error || !refreshedUser.data.user) {
      structuredLog('error', 'Failed to fetch user after admin update', {
        error: refreshedUser.error?.message,
        user_id: userId,
      })
      return errorResponse('更新後のユーザー取得に失敗しました', 500)
    }

    const responseUser = buildAdminUser(refreshedUser.data.user, profileData, teamMap, locationMap)

    const afterProfile = {
      role: responseUser.role,
      display_name: responseUser.display_name,
      department: responseUser.department,
      team_id: responseUser.team_id,
      location_id: responseUser.location_id,
    }

    const action =
      payload.role && payload.role !== beforeProfile.role ? 'permission_change' : currentProfile ? 'update' : 'create'

    await logAudit({
      actor_user_id: adminUser.id,
      entity: 'profiles',
      entity_id: userId,
      action,
      diff: generateDiff(beforeProfile, afterProfile),
    })

    structuredLog('info', 'Admin user profile updated', {
      actor: adminUser.id,
      user_id: userId,
      changed_fields: providedKeys,
    })

    return NextResponse.json(
      { data: responseUser },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
