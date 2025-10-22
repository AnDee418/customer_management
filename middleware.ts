import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// 認証が不要な公開ルート
const publicRoutes = ['/login']

// 認証が必要な保護されたルート（プレフィックス）
const protectedRoutes = ['/dashboard', '/customers', '/analytics', '/audit', '/settings']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 公開ルートの場合はそのまま通す
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  let response = NextResponse.next()

  // Supabaseクライアントの作成（ミドルウェア用）
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials in middleware')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 保護されたルートの場合は認証チェック
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // 未認証の場合はログインページにリダイレクト
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // 認証済みの場合は続行
    return response
  }

  // ルートパス（/）へのアクセス
  if (pathname === '/') {
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      // 認証済みの場合はダッシュボードへリダイレクト
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      // 未認証の場合はログインページへリダイレクト
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

