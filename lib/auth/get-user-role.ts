import { createClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer'

export interface UserProfile {
  userId: string
  email: string | undefined
  role: UserRole
  teamId: string | null
  displayName: string | null
  department: string | null
}

/**
 * 現在のユーザープロファイルを取得
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient()
  
  // セッションを取得
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    return null
  }

  // プロファイルを取得
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, team_id, display_name, department')
    .eq('user_id', session.user.id)
    .single()

  if (error || !profile) {
    console.error('Profile fetch error:', error)
    // デフォルトで 'user' ロールを返す
    return {
      userId: session.user.id,
      email: session.user.email,
      role: 'user',
      teamId: null,
      displayName: null,
      department: null,
    }
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    role: profile.role as UserRole,
    teamId: profile.team_id,
    displayName: profile.display_name,
    department: profile.department,
  }
}

/**
 * ユーザーが指定されたロールを持っているかチェック
 */
export async function hasRole(requiredRole: UserRole | UserRole[]): Promise<boolean> {
  const profile = await getUserProfile()
  if (!profile) return false

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  return roles.includes(profile.role)
}

/**
 * 管理者権限チェック
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole('admin')
}

/**
 * マネージャー以上の権限チェック
 */
export async function isManagerOrAbove(): Promise<boolean> {
  return hasRole(['admin', 'manager'])
}

