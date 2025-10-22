import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    await getAuthUser()

    const supabase = createAuthenticatedClient()

    // URLパラメータから期間フィルタを取得
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 基本クエリ
    let query = supabase
      .from('customers')
      .select('type, gender, prefecture, age, created_at')
      .is('deleted_at', null)

    // 期間フィルタ適用
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: customers, error } = await query

    if (error) {
      console.error('Analytics query error:', error)
      return NextResponse.json(
        { error: 'データの取得に失敗しました' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 総数
    const totalCount = customers.length

    // タイプ別集計
    const byType: Record<string, number> = {}
    customers.forEach(c => {
      const type = c.type || 'その他'
      byType[type] = (byType[type] || 0) + 1
    })

    // 性別別集計
    const byGender: Record<string, number> = {}
    customers.forEach(c => {
      const gender = c.gender || '未設定'
      byGender[gender] = (byGender[gender] || 0) + 1
    })

    // 都道府県別集計
    const byPrefecture: Record<string, number> = {}
    customers.forEach(c => {
      const prefecture = c.prefecture || '未設定'
      byPrefecture[prefecture] = (byPrefecture[prefecture] || 0) + 1
    })

    // 年齢層別集計（10歳刻み）
    const byAgeGroup: Record<string, number> = {}
    customers.forEach(c => {
      if (c.age) {
        const ageGroup = Math.floor(c.age / 10) * 10
        const label = `${ageGroup}代`
        byAgeGroup[label] = (byAgeGroup[label] || 0) + 1
      } else {
        byAgeGroup['未設定'] = (byAgeGroup['未設定'] || 0) + 1
      }
    })

    // 都道府県別を降順ソート（上位10件）
    const topPrefectures = Object.entries(byPrefecture)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([prefecture, count]) => ({ prefecture, count }))

    // 年齢層をソート
    const ageGroups = Object.entries(byAgeGroup)
      .filter(([label]) => label !== '未設定')
      .sort((a, b) => {
        const ageA = parseInt(a[0])
        const ageB = parseInt(b[0])
        return ageA - ageB
      })
      .map(([ageGroup, count]) => ({ ageGroup, count }))

    // 未設定を最後に追加
    if (byAgeGroup['未設定']) {
      ageGroups.push({ ageGroup: '未設定', count: byAgeGroup['未設定'] })
    }

    // 月別登録推移（過去12ヶ月）
    const monthlyTrend: Record<string, number> = {}
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyTrend[key] = 0
    }

    customers.forEach(c => {
      const date = new Date(c.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (monthlyTrend.hasOwnProperty(key)) {
        monthlyTrend[key]++
      }
    })

    // 曜日別登録パターン
    const byDayOfWeek: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    customers.forEach(c => {
      const day = new Date(c.created_at).getDay()
      byDayOfWeek[day]++
    })

    // 性別×年齢層のクロス集計
    const genderAgeMatrix: Record<string, Record<string, number>> = {}
    customers.forEach(c => {
      const gender = c.gender || '未設定'
      let ageGroup = '未設定'
      if (c.age) {
        const groupNum = Math.floor(c.age / 10) * 10
        ageGroup = `${groupNum}代`
      }

      if (!genderAgeMatrix[gender]) {
        genderAgeMatrix[gender] = {}
      }
      genderAgeMatrix[gender][ageGroup] = (genderAgeMatrix[gender][ageGroup] || 0) + 1
    })

    // タイプ別月次推移（直近6ヶ月）
    const typeMonthlyTrend: Record<string, Record<string, number>> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      customers.forEach(c => {
        const date = new Date(c.created_at)
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

        if (dateKey === key) {
          const type = c.type || 'その他'
          if (!typeMonthlyTrend[type]) {
            typeMonthlyTrend[type] = {}
          }
          typeMonthlyTrend[type][key] = (typeMonthlyTrend[type][key] || 0) + 1
        }
      })
    }

    const analytics = {
      totalCount,
      byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
      byGender: Object.entries(byGender).map(([gender, count]) => ({ gender, count })),
      byPrefecture: topPrefectures,
      byAgeGroup: ageGroups,
      monthlyTrend: Object.entries(monthlyTrend).map(([month, count]) => ({ month, count })),
      byDayOfWeek: Object.entries(byDayOfWeek).map(([day, count]) => ({
        day: parseInt(day),
        count
      })),
      genderAgeMatrix,
      typeMonthlyTrend,
    }

    return NextResponse.json(
      { data: analytics },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Analytics overview error:', error)
    return NextResponse.json(
      { error: '分析データの取得に失敗しました' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
