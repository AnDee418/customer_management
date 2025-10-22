import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/account/profile
 * 現在のユーザーのプロファイル情報を取得
 */
export async function GET() {
  try {
    console.log('[Profile API] GET request started')
    const supabase = createClient()
    console.log('[Profile API] Supabase client created')
    
    // 認証チェック
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('[Profile API] Session:', session?.user?.id, 'Error:', sessionError)
    
    if (!session) {
      console.log('[Profile API] No session found')
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    console.log('[Profile API] Fetching profile for user:', session.user.id)
    
    // プロファイル取得
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('display_name, department, role')
      .eq('user_id', session.user.id)
      .single()

    console.log('[Profile API] Profile data:', profile)
    console.log('[Profile API] Profile error:', error)

    if (error) {
      console.error('[Profile API] Profile fetch error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json(
        { 
          error: 'プロファイルの取得に失敗しました',
          details: error.message,
          code: error.code
        },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    console.log('[Profile API] Successfully fetched profile')
    return NextResponse.json(profile, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('[Profile API] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

/**
 * PUT /api/account/profile
 * 現在のユーザーのプロファイル情報を更新
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('[Profile API] PUT request started')
    const supabase = createClient()
    
    // 認証チェック
    const { data: { session } } = await supabase.auth.getSession()
    console.log('[Profile API] Session:', session?.user?.id)
    
    if (!session) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // リクエストボディを取得
    const body = await request.json()
    console.log('[Profile API] Request body:', body)
    const { display_name, department } = body

    // バリデーション
    if (!display_name || !department) {
      console.log('[Profile API] Validation failed:', { display_name, department })
      return NextResponse.json(
        { error: '表示名と部署は必須です' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    console.log('[Profile API] Updating profile for user:', session.user.id)

    // プロファイル更新（roleは更新不可、updated_atも削除）
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        display_name,
        department
      })
      .eq('user_id', session.user.id)
      .select('display_name, department, role')
      .single()

    console.log('[Profile API] Update result:', profile)
    console.log('[Profile API] Update error:', error)

    if (error) {
      console.error('[Profile API] Profile update error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json(
        { 
          error: 'プロファイルの更新に失敗しました',
          details: error.message,
          code: error.code
        },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    console.log('[Profile API] Inserting audit log')

    // 監査ログ記録
    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor_user_id: session.user.id,
      entity: 'profile',
      entity_id: session.user.id,
      action: 'update',
      diff: {
        display_name,
        department
      }
    })

    if (auditError) {
      console.error('[Profile API] Audit log error:', auditError)
      // 監査ログのエラーは無視（プロファイル更新は成功）
    }

    console.log('[Profile API] Successfully updated profile')
    return NextResponse.json(profile, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('[Profile API] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

