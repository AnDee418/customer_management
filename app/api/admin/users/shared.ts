import type { User } from '@supabase/supabase-js'

export type ProfileRow = {
  user_id: string
  role: string | null
  display_name: string | null
  department: string | null
  team_id: string | null
  location_id: string | null
  created_at?: string
}

export type TeamRow = {
  id: string
  name: string
}

export type LocationSlotRow = {
  id: string
  name: string
  code: string
  is_active?: boolean
}

export type AdminUserDTO = {
  id: string
  email: string | undefined
  role: string | null
  display_name: string | null
  department: string | null
  team_id: string | null
  team_name: string | null
  location_id: string | null
  location_name: string | null
  location_is_active: boolean | null
  status: 'active' | 'invited' | 'disabled'
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  factors_count: number
}

export function determineStatus(user: User): AdminUserDTO['status'] {
  if ((user.app_metadata as any)?.disabled) {
    return 'disabled'
  }

  const bannedUntil = (user as any).banned_until
  if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) {
    return 'disabled'
  }

  if (!user.email_confirmed_at) {
    return 'invited'
  }

  return 'active'
}

export function buildAdminUser(
  user: User,
  profile: ProfileRow | undefined,
  teamMap: Map<string, TeamRow>,
  locationMap: Map<string, LocationSlotRow>
): AdminUserDTO {
  const status = determineStatus(user)
  const teamId = profile?.team_id ?? (user.user_metadata as any)?.team_id ?? null
  const teamName = teamId ? teamMap.get(teamId)?.name ?? null : null
  const role = profile?.role ?? (user.app_metadata as any)?.role ?? null
  const locationId = profile?.location_id ?? (user.user_metadata as any)?.location_id ?? null
  const locationRecord = locationId ? locationMap.get(locationId) : undefined
  const locationName = locationRecord?.name ?? null
  const locationIsActive = locationRecord?.is_active ?? null

  return {
    id: user.id,
    email: user.email,
    role,
    display_name: profile?.display_name ?? (user.user_metadata as any)?.display_name ?? null,
    department: profile?.department ?? (user.user_metadata as any)?.department ?? null,
    team_id: teamId,
    team_name: teamName,
    location_id: locationId,
    location_name: locationName,
    location_is_active: locationIsActive,
    status,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    factors_count: Array.isArray((user as any).factors) ? (user as any).factors.length : 0,
  }
}
