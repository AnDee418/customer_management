/**
 * Supabase Server Client
 * サーバーサイドでのSupabase接続（RLS有効）
 * リアルタイム最優先・キャッシュ不使用
 * 
 * セキュリティ: NEXT_PUBLIC_プレフィックスを使用せず、
 * サーバーサイドのみで環境変数を管理
 */
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * サーバーサイド用Supabaseクライアント（サービスロールキー）
 * RLSをバイパスする必要がある場合に使用（内部API等）
 */
export function createServiceClient() {
  const { createClient } = require('@supabase/supabase-js')
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase service credentials')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  })
}

/**
 * 認証済みユーザー用Supabaseクライアント（RLS有効）
 * Server Components/Route Handlersで使用
 */
export function createClient() {
  const cookieStore = cookies()
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials')
  }

  return createSSRClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Componentではcookieの設定ができない場合がある
          }
        },
      },
      global: {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    }
  )
}

/**
 * createClientのエイリアス（互換性のため）
 */
export const createAuthenticatedClient = createClient
export const createServerClient = createClient

