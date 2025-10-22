import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/account/stats
 * 現在のユーザーの統計情報を取得
 */
export async function GET() {
  try {
    const supabase = createClient()
    
    // 認証チェック
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // ユーザーのロールを取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // 担当顧客数を取得
    let totalCustomersQuery = supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)

    // 管理者以外は自分の顧客のみ
    if (!isAdmin) {
      totalCustomersQuery = totalCustomersQuery.eq('owner_user_id', session.user.id)
    }

    const { count: totalCustomers } = await totalCustomersQuery

    // 今月の登録数を取得
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    let thisMonthQuery = supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', startOfMonth.toISOString())

    if (!isAdmin) {
      thisMonthQuery = thisMonthQuery.eq('owner_user_id', session.user.id)
    }

    const { count: customersThisMonth } = await thisMonthQuery

    // 最近のアクティビティを取得
    let activitiesQuery = supabase
      .from('audit_logs')
      .select('action, entity, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!isAdmin) {
      activitiesQuery = activitiesQuery.eq('actor_user_id', session.user.id)
    }

    const { data: recentActivities } = await activitiesQuery

    return NextResponse.json({
      total_customers: totalCustomers || 0,
      customers_this_month: customersThisMonth || 0,
      recent_activities: recentActivities || []
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('GET /api/account/stats error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

