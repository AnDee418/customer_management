import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/session'
import { structuredLog } from '@/lib/audit/logger'

type MonthlyTrendPoint = {
  month: string
  count: number
}

export async function GET(request: NextRequest) {
  try {
    await getAuthUser()

    const supabase = createAuthenticatedClient()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const trendWindowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const [
      totalResult,
      customerTypeResult,
      agencyResult,
      monthlyRawResult,
      recentCustomersResult,
      recentActivitiesResult,
    ] = await Promise.all([
      supabase
        .from('customers')
        .select('id', { head: true, count: 'exact' })
        .is('deleted_at', null),
      supabase
        .from('customers')
        .select('id', { head: true, count: 'exact' })
        .is('deleted_at', null)
        .eq('type', '顧客'),
      supabase
        .from('customers')
        .select('id', { head: true, count: 'exact' })
        .is('deleted_at', null)
        .eq('type', '代理店'),
      supabase
        .from('customers')
        .select('created_at')
        .is('deleted_at', null)
        .gte('created_at', trendWindowStart.toISOString()),
      supabase
        .from('customers')
        .select('id, name, type, code, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('audit_logs')
        .select('id, action, entity, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const errors = [
      totalResult.error,
      customerTypeResult.error,
      agencyResult.error,
      monthlyRawResult.error,
      recentCustomersResult.error,
      recentActivitiesResult.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      const message = (errors[0] as { message: string }).message ?? 'Unknown error'
      structuredLog('error', 'Failed to load dashboard summary', { error: message })
      return NextResponse.json(
        { error: 'ダッシュボードデータの取得に失敗しました' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const totalCustomers = totalResult.count ?? 0
    const typeCustomerCount = customerTypeResult.count ?? 0
    const agencyCount = agencyResult.count ?? 0

    const monthlyTrend = buildMonthlyTrend(monthlyRawResult.data ?? [], trendWindowStart, now)
    const currentMonthCount = monthlyTrend[monthlyTrend.length - 1]?.count ?? 0
    const previousMonthCount =
      monthlyTrend.length > 1 ? monthlyTrend[monthlyTrend.length - 2]?.count ?? 0 : 0
    const monthOverMonthChange =
      previousMonthCount > 0
        ? ((currentMonthCount - previousMonthCount) / previousMonthCount) * 100
        : null

    const recentCustomers = (recentCustomersResult.data ?? []).map((customer) => ({
      id: customer.id,
      name: customer.name,
      type: customer.type,
      code: customer.code,
      created_at: customer.created_at,
    }))

    const recentActivities = (recentActivitiesResult.data ?? []).map((activity) => ({
      id: activity.id,
      action: activity.action,
      entity: activity.entity,
      created_at: activity.created_at,
    }))

    const stats = {
      totalCustomers,
      typeCustomerCount,
      agencyCount,
      currentMonthCount,
      previousMonthCount,
      monthOverMonthChange,
      startOfMonth: startOfMonth.toISOString(),
      previousMonthStart: previousMonthStart.toISOString(),
    }

    structuredLog('info', 'Dashboard summary computed', {
      totalCustomers,
      currentMonthCount,
      previousMonthCount,
    })

    return NextResponse.json(
      {
        data: {
          stats,
          monthlyTrend,
          recentCustomers,
          recentActivities,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    structuredLog('error', 'Dashboard summary failed', { error: error?.message })
    return NextResponse.json(
      { error: 'ダッシュボードデータの取得に失敗しました' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

function buildMonthlyTrend(
  rows: { created_at: string }[],
  windowStart: Date,
  now: Date
): MonthlyTrendPoint[] {
  const months: Record<string, number> = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months[key] = 0
  }

  rows.forEach((row) => {
    const createdAt = new Date(row.created_at)
    if (createdAt < windowStart) return
    const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`
    if (months[key] !== undefined) {
      months[key]++
    }
  })

  return Object.entries(months).map(([month, count]) => ({ month, count }))
}
