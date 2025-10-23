'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUsers,
  faUserTie,
  faChartBar,
  faPlus,
  faArrowRight,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons'
import { initializeChartTooltip } from './chart-tooltip'
import './dashboard.css'

type DashboardStats = {
  totalCustomers: number
  typeCustomerCount: number
  agencyCount: number
  currentMonthCount: number
  previousMonthCount: number
  monthOverMonthChange: number | null
}

type MonthlyTrendPoint = {
  month: string
  count: number
}

type RecentCustomer = {
  id: string
  name: string
  type: string | null
  code: string | null
  created_at: string
}

type RecentActivity = {
  id: string
  action: string
  entity: string
  created_at: string
}

type DashboardData = {
  stats: DashboardStats
  monthlyTrend: MonthlyTrendPoint[]
  recentCustomers: RecentCustomer[]
  recentActivities: RecentActivity[]
}

type DashboardResponse = {
  data: DashboardData
}

type ChartPoint = {
  x: number
  y: number
  monthKey: string
  monthLabel: string
  count: number
  changeLabel: string
}

type ChartData = {
  points: ChartPoint[]
  polyline: string
  area: string
  yTicks: { value: number; y: number }[]
  yearOptions: string[]
  selectedYear: string | null
  hasData: boolean
}

const numberFormatter = new Intl.NumberFormat('ja-JP')
const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const typeBadgeClassMap: Record<string, string> = {
  顧客: 'badge badge-primary',
  代理店: 'badge badge-success',
  スタッフ: 'badge badge-info',
  サポート: 'badge badge-warning',
  社員: 'badge badge-primary',
  その他: 'badge badge-warning',
}

const fallbackTypeClass = 'badge badge-info'

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/dashboard/summary', {
          headers: { 'Cache-Control': 'no-store' },
        })

        if (!response.ok) {
          const detail = await response.json().catch(() => ({}))
          throw new Error(detail.error || 'ダッシュボードデータの取得に失敗しました')
        }

        const result = (await response.json()) as DashboardResponse
        setData(result.data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ダッシュボードデータの取得に失敗しました'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (!loading && data?.monthlyTrend?.length) {
      const timer = setTimeout(() => initializeChartTooltip(), 0)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [loading, data])

  const chartData = useMemo(() => computeChartData(data?.monthlyTrend ?? []), [data?.monthlyTrend])

  const statChangeInfo = data
    ? getPercentChange(data.stats.currentMonthCount, data.stats.previousMonthCount)
    : { label: 'N/A', className: 'neutral' as const }

  const rightPanelContent = (
    <div>
      <h4 style={{ marginBottom: '1rem', color: 'var(--gray-700)' }}>クイックアクション</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => router.push('/customers/new')}
        >
          新規顧客登録
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => router.push('/analytics')}
        >
          顧客分析ダッシュボード
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => router.push('/audit')}
        >
          監査ログ確認
        </button>
      </div>

      <div className="divider" />

      <h4 style={{ marginBottom: '1rem', color: 'var(--gray-700)' }}>最近の活動</h4>
      <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
        {loading ? (
          <div style={{ padding: '0.75rem', background: 'var(--gray-50)', borderRadius: '6px' }}>
            読み込み中...
          </div>
        ) : data && data.recentActivities.length > 0 ? (
          data.recentActivities.map((activity) => (
            <div
              key={activity.id}
              style={{
                padding: '0.75rem',
                background: 'var(--gray-50)',
                borderRadius: '6px',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                {describeActivity(activity)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                {formatRelativeTime(activity.created_at)}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '0.75rem', background: 'var(--gray-50)', borderRadius: '6px' }}>
            最近の活動はありません
          </div>
        )}
      </div>
    </div>
  )

  return (
    <AppLayout showRightPanel rightPanelContent={rightPanelContent}>
      <div className="dashboard-container">
        {error && <div className="dashboard-message error">{error}</div>}

        {loading ? (
          <div className="dashboard-loading">データを読み込んでいます...</div>
        ) : data ? (
          <>
            <div className="page-header">
              <h1 className="page-title">ダッシュボード</h1>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push('/analytics')}
                >
                  <FontAwesomeIcon icon={faChartBar} />
                  レポート出力
                </button>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={() => router.push('/customers/new')}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  新規顧客登録
                </button>
              </div>
            </div>

            <div className="stats-grid-custom">
              <div className="stat-card">
                <div
                  className="stat-icon"
                  style={{ background: 'rgba(20, 36, 63, 0.1)', color: 'var(--brand-primary)' }}
                >
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">総顧客数</div>
                  <div className="stat-value">{numberFormatter.format(data.stats.totalCustomers)}</div>
                  <div className={`stat-change ${statChangeInfo.className}`}>
                    前月比 {statChangeInfo.label}
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div
                  className="stat-icon"
                  style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}
                >
                  <FontAwesomeIcon icon={faUserTie} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">顧客タイプ（顧客）</div>
                  <div className="stat-value">
                    {numberFormatter.format(data.stats.typeCustomerCount)}
                  </div>
                  <div className="stat-change neutral">
                    代理店 {numberFormatter.format(data.stats.agencyCount)} 件
                  </div>
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">新規顧客登録数の推移</h3>
                  <select className="chart-year-selector" value={chartData?.selectedYear ?? ''} disabled>
                    {chartData?.yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}年
                      </option>
                    ))}
                    {!chartData?.yearOptions.length && <option value="">年次データなし</option>}
                  </select>
                </div>
                <div className="chart-body">
                  {chartData && chartData.points.length > 0 ? (
                    <svg className="line-chart" viewBox="0 0 600 140" preserveAspectRatio="xMidYMid meet">
                      <line x1="40" y1="20" x2="40" y2="110" stroke="#e5e7eb" strokeWidth="1" />
                      <line x1="40" y1="110" x2="580" y2="110" stroke="#e5e7eb" strokeWidth="2" />

                      {chartData.yTicks.map((tick) => (
                        <g key={`tick-${tick.value}`}>
                          <line
                            x1="40"
                            y1={tick.y}
                            x2="580"
                            y2={tick.y}
                            stroke="#f3f4f6"
                            strokeWidth="1"
                          />
                          <text
                            x="30"
                            y={tick.y + 2}
                            fontSize="10"
                            fill="#6b7280"
                            textAnchor="end"
                          >
                            {numberFormatter.format(tick.value)}
                          </text>
                        </g>
                      ))}

                      {chartData.area && (
                        <polygon points={chartData.area} fill="rgba(20, 36, 63, 0.1)" />
                      )}
                      {chartData.polyline && (
                        <polyline
                          points={chartData.polyline}
                          fill="none"
                          stroke="#14243F"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {chartData.points.map((point, index) => (
                        <circle
                          key={`${point.monthKey}-${index}`}
                          className="data-point"
                          cx={point.x}
                          cy={point.y}
                          r="5"
                          fill="#14243F"
                          data-month={point.monthLabel}
                          data-value={point.count.toString()}
                          data-change={point.changeLabel}
                        />
                      ))}

                      {chartData.points.map((point, index) => (
                        <text
                          key={`label-${point.monthKey}-${index}`}
                          x={point.x}
                          y="128"
                          fontSize="10"
                          fill="#6b7280"
                          textAnchor="middle"
                        >
                          {point.monthLabel}
                        </text>
                      ))}
                    </svg>
                  ) : (
                    <div className="chart-empty">表示可能なデータがありません</div>
                  )}

                  <div id="chart-tooltip" className="chart-tooltip">
                    <div className="tooltip-month"></div>
                    <div className="tooltip-value"></div>
                    <div className="tooltip-change"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="content-grid">
              <div className="card content-card">
                <div className="card-header">
                  <h3 className="card-title">最近の登録</h3>
                  <Link href="/customers" className="card-link">
                    すべて見る{' '}
                    <FontAwesomeIcon
                      icon={faArrowRight}
                      style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}
                    />
                  </Link>
                </div>
                <div className="card-body">
                  {data.recentCustomers.length > 0 ? (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>名前</th>
                          <th>タイプ</th>
                          <th>コード</th>
                          <th>登録日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentCustomers.map((customer) => {
                          const badgeClass =
                            typeBadgeClassMap[customer.type ?? ''] ?? fallbackTypeClass
                          return (
                            <tr key={customer.id}>
                              <td>
                                <strong>{customer.name || '名称未設定'}</strong>
                              </td>
                              <td>
                                <span className={badgeClass}>{customer.type || '未設定'}</span>
                              </td>
                              <td>
                                <code>{customer.code || '—'}</code>
                              </td>
                              <td>{dateFormatter.format(new Date(customer.created_at))}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="card-empty">最近登録された顧客はありません</div>
                  )}
                </div>
              </div>

              <div className="card content-card">
                <div className="card-header">
                  <h3 className="card-title">クイックアクション</h3>
                </div>
                <div className="card-body">
                  <div className="quick-actions">
                    <button
                      type="button"
                      className="action-card"
                      onClick={() => router.push('/customers/new')}
                    >
                      <div
                        className="action-icon"
                        style={{ background: 'rgba(20, 36, 63, 0.1)', color: 'var(--brand-primary)' }}
                      >
                        <FontAwesomeIcon icon={faUsers} />
                      </div>
                      <div className="action-content">
                        <div className="action-title">新規顧客登録</div>
                        <div className="action-desc">新しい顧客を登録</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="action-card"
                      onClick={() => router.push('/analytics')}
                    >
                      <div
                        className="action-icon"
                        style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}
                      >
                        <FontAwesomeIcon icon={faChartBar} />
                      </div>
                      <div className="action-content">
                        <div className="action-title">顧客分析</div>
                        <div className="action-desc">統計データを確認</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="action-card"
                      onClick={() => router.push('/audit')}
                    >
                      <div
                        className="action-icon"
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}
                      >
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                      </div>
                      <div className="action-content">
                        <div className="action-title">要対応項目</div>
                        <div className="action-desc">監査ログと再試行履歴を確認</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="dashboard-message">表示するデータがありません。</div>
        )}
      </div>
    </AppLayout>
  )
}

function computeChartData(monthlyTrend: MonthlyTrendPoint[]): ChartData | null {
  if (!monthlyTrend.length) {
    return null
  }

  const left = 40
  const right = 580
  const top = 30
  const bottom = 110
  const counts = monthlyTrend.map((item) => item.count)
  const maxCount = Math.max(...counts, 0)
  const step = monthlyTrend.length > 1 ? (right - left) / (monthlyTrend.length - 1) : 0

  const points: ChartPoint[] = monthlyTrend.map((item, index) => {
    const x = left + index * step
    const ratio = maxCount === 0 ? 0 : item.count / maxCount
    const y = bottom - ratio * (bottom - top)
    const prevCount = index > 0 ? monthlyTrend[index - 1].count : null
    const changeInfo = getPercentChange(item.count, prevCount)

    return {
      x,
      y,
      monthKey: item.month,
      monthLabel: formatMonthLabel(item.month),
      count: item.count,
      changeLabel: changeInfo.label,
    }
  })

  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area =
    points.length > 0
      ? `${polyline} ${points[points.length - 1].x},${bottom} ${points[0].x},${bottom}`
      : ''

  const yTicks = createTickValues(maxCount).map((value) => ({
    value,
    y: bottom - (maxCount === 0 ? 0 : (value / maxCount) * (bottom - top)),
  }))

  const yearOptions = Array.from(new Set(monthlyTrend.map((item) => item.month.slice(0, 4)))).sort()
  const selectedYear = yearOptions.at(-1) ?? null
  const hasData = points.some((point) => point.count > 0)

  return { points, polyline, area, yTicks, yearOptions, selectedYear, hasData }
}

function createTickValues(max: number): number[] {
  if (max <= 0) {
    return [0]
  }

  const top = max
  const middle = Math.max(Math.round(max * (2 / 3)), 1)
  const bottom = Math.max(Math.round(max * (1 / 3)), 0)

  return Array.from(new Set([top, middle, bottom])).sort((a, b) => b - a)
}

function getPercentChange(current: number, previous: number | null) {
  if (previous === null) {
    return { label: 'N/A', className: 'neutral' as const }
  }
  if (previous === 0) {
    if (current === 0) {
      return { label: '+0%', className: 'neutral' as const }
    }
    return { label: 'N/A', className: 'neutral' as const }
  }

  const diff = ((current - previous) / previous) * 100
  const label = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`
  const className = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'
  return { label, className }
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  if (!year || !month) return monthKey
  const monthNumber = parseInt(month, 10)
  return `${monthNumber}月`
}

function formatRelativeTime(isoString: string): string {
  const target = new Date(isoString)
  const diffMs = Date.now() - target.getTime()

  if (Number.isNaN(diffMs)) {
    return '-'
  }

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return 'たった今'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}分前`
  if (diffMs < day) return `${Math.floor(diffMs / hour)}時間前`
  return `${Math.floor(diffMs / day)}日前`
}

function describeActivity(activity: RecentActivity): string {
  const entityLabels: Record<string, string> = {
    customers: '顧客',
    profiles: 'ユーザー',
    orders: '発注',
    measurements: '測定',
    contacts: '担当者',
    teams: 'チーム',
    location_slots: '所属地',
    audit_logs: '監査ログ',
  }

  const actionLabels: Record<string, string> = {
    create: '作成',
    update: '更新',
    delete: '削除',
    restore: '復元',
    sync: '同期',
    retry: '再試行',
    login: 'ログイン',
    permission_change: '権限変更',
  }

  const entity = entityLabels[activity.entity] || activity.entity || '操作'
  const action = actionLabels[activity.action] || activity.action

  if (action === 'ログイン') {
    return 'ユーザーがログインしました'
  }

  return `${entity}を${action}`
}
