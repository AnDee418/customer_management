/**
 * セッション・ユーザー情報取得
 * Supabase Auth統合
 */
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/errors/handler'

export interface AuthUser {
  id: string
  email?: string
  role?: string
  team_id?: string
}

/**
 * 認証ユーザー情報取得
 */
export async function getAuthUser(): Promise<AuthUser> {
  const supabase = createAuthenticatedClient()
  
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('Authentication required')
  }

  // プロファイル情報取得（role, team_id）
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, team_id')
    .eq('user_id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email,
    role: profile?.role,
    team_id: profile?.team_id,
  }
}

/**
 * 管理者権限チェック
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await getAuthUser()
  
  if (user.role !== 'admin') {
    throw new UnauthorizedError('Admin access required')
  }
  
  return user
}

