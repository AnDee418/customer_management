'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUsers, faFilter, faCalendar, faTimes, faChartLine } from '@fortawesome/free-solid-svg-icons'
import { initializeAnalyticsChartTooltip } from './chart-tooltip'
import './analytics.css'

interface AnalyticsData {
  totalCount: number
  byPrefecture: Array<{ prefecture: string; count: number }>
  monthlyTrend: Array<{ month: string; count: number }>
  byDayOfWeek: Array<{ day: number; count: number }>
  genderAgeMatrix: Record<string, Record<string, number>>
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchAnalytics()
  }, [startDate, endDate])

  useEffect(() => {
    // グラフ描画後にツールチップを初期化
    if (analytics) {
      setTimeout(() => {
        initializeAnalyticsChartTooltip()
      }, 100)
    }
  }, [analytics])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/analytics/overview?${params}`, {
        headers: {
          'Cache-Control': 'no-store'
        }
      })

      if (!response.ok) {
        throw new Error('分析データの取得に失敗しました')
      }

      const result = await response.json()
      setAnalytics(result.data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      alert('分析データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
  }

  return (
    <AppLayout>
      <div className="page-content">
        {/* ヘッダー */}
        <div className="page-header">
          <div className="header-left">
            <h1 className="page-title">顧客分析</h1>
            <p className="page-subtitle">
              {analytics ? `${analytics.totalCount} 件のデータを分析` : '読み込み中...'}
            </p>
          </div>
          <div className="header-right">
            <button
              className={`btn btn-secondary ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <FontAwesomeIcon icon={faFilter} />
              フィルター
            </button>
          </div>
        </div>

        {/* フィルターパネル */}
        {showFilters && (
          <div className="filter-panel">
            <div className="filter-group">
              <label className="filter-label">
                <FontAwesomeIcon icon={faCalendar} />
                登録日期間
              </label>
              <div className="date-range">
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="開始日"
                />
                <span className="date-separator">〜</span>
                <input
                  type="date"
                  className="input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="終了日"
                />
                {(startDate || endDate) && (
                  <button className="btn-clear" onClick={clearFilters}>
                    <FontAwesomeIcon icon={faTimes} />
                    クリア
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* コンテンツ */}
        {loading ? (
          <div className="loading-state">
            <p>読み込み中...</p>
          </div>
        ) : !analytics ? (
          <div className="empty-state">
            <p>データがありません</p>
          </div>
        ) : (
          <div className="analytics-content">
            {/* サマリーカード */}
            <div className="summary-cards">
              <div className="summary-card">
                <div className="summary-icon">
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <div className="summary-info">
                  <div className="summary-label">総顧客数</div>
                  <div className="summary-value">{analytics.totalCount}</div>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon">
                  <FontAwesomeIcon icon={faChartLine} />
                </div>
                <div className="summary-info">
                  <div className="summary-label">都道府県数</div>
                  <div className="summary-value">{analytics.byPrefecture.length}</div>
                </div>
              </div>
            </div>

            {/* グラフエリア */}
            <div className="charts-layout">
              {/* 月別登録推移（ダッシュボードスタイル） */}
              <MonthlyTrendChart data={analytics.monthlyTrend} />

              {/* 2カラム行 */}
              <div className="charts-row">
                {/* 曜日別登録パターン（棒グラフ） */}
                <DayOfWeekBarChart data={analytics.byDayOfWeek} />

                {/* 性別×年齢層分布（円グラフ） */}
                <GenderAgePieChart data={analytics.genderAgeMatrix} />
              </div>

              {/* 都道府県別分布（日本地図ヒートマップ） */}
              <JapanMapHeatmap data={analytics.byPrefecture} />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

// 月別登録推移グラフ（ダッシュボードスタイル）
function MonthlyTrendChart({ data }: { data: Array<{ month: string; count: number }> }) {
  if (data.length === 0) {
    return <div className="empty-chart">データがありません</div>
  }

  // 最大値とスケーリング
  const maxValue = Math.max(...data.map(d => d.count), 1)
  const scale = 100 / maxValue

  // データポイントの座標を計算
  const points = data.map((item, index) => {
    const x = 85 + (index * 45) // 45px間隔
    const y = 110 - (item.count * scale)
    return { x, y, ...item }
  })

  // ポリライン用のポイント文字列
  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ')

  // エリア塗りつぶし用のポリゴン
  const polygonPoints = `${points.map(p => `${p.x},${p.y}`).join(' ')} ${points[points.length - 1].x},110 85,110`

  // 前月比を計算
  const monthlyChanges = points.map((p, i) => {
    if (i === 0) return '+0%'
    const prev = points[i - 1].count
    const change = ((p.count - prev) / prev) * 100
    return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`
  })

  return (
    <div className="chart-card full-width">
      <div className="chart-header">
        <h3 className="chart-title">
          <FontAwesomeIcon icon={faChartLine} style={{ marginRight: '0.5rem' }} />
          月別登録推移（過去12ヶ月）
        </h3>
      </div>
      <div className="chart-body">
        <svg className="line-chart" viewBox="0 0 600 140" preserveAspectRatio="xMidYMid meet">
          {/* グリッドとY軸 */}
          <line x1="40" y1="10" x2="40" y2="110" stroke="#e5e7eb" strokeWidth="1"/>
          <line x1="40" y1="110" x2="580" y2="110" stroke="#e5e7eb" strokeWidth="2"/>

          {/* Y軸ラベル */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = 110 - (ratio * 100)
            const value = Math.round(maxValue * ratio)
            return (
              <g key={i}>
                <line x1="40" y1={y} x2="580" y2={y} stroke="#f3f4f6" strokeWidth="1"/>
                <text x="30" y={y + 4} fontSize="10" fill="#6b7280" textAnchor="end">{value}</text>
              </g>
            )
          })}

          {/* エリア塗りつぶし */}
          <polygon
            points={polygonPoints}
            fill="rgba(20, 36, 63, 0.1)"
          />

          {/* 折れ線 */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#14243F"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* データポイント */}
          {points.map((point, index) => (
            <circle
              key={index}
              className="data-point"
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#14243F"
              data-month={point.month.split('-')[1] + '月'}
              data-value={point.count}
              data-change={monthlyChanges[index]}
            />
          ))}

          {/* X軸ラベル */}
          {points.map((point, index) => {
            if (index % 2 === 0 || data.length <= 6) {
              return (
                <text
                  key={index}
                  x={point.x}
                  y="128"
                  fontSize="10"
                  fill="#6b7280"
                  textAnchor="middle"
                >
                  {point.month.split('-')[1]}月
                </text>
              )
            }
            return null
          })}
        </svg>

        {/* ツールチップ */}
        <div id="analytics-chart-tooltip" className="chart-tooltip">
          <div className="tooltip-month"></div>
          <div className="tooltip-value"></div>
          <div className="tooltip-change"></div>
        </div>
      </div>
    </div>
  )
}

// 曜日別登録パターン（棒グラフ）
function DayOfWeekBarChart({ data }: { data: Array<{ day: number; count: number }> }) {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  const maxValue = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="chart-card half-width">
      <h3 className="chart-title">曜日別登録パターン</h3>
      <div className="chart-content">
        <div className="day-bar-chart">
          {data.sort((a, b) => a.day - b.day).map(item => {
            const percentage = (item.count / maxValue) * 100
            return (
              <div key={item.day} className="day-bar-item">
                <div className="day-label">{dayNames[item.day]}</div>
                <div className="day-bar-track">
                  <div
                    className="day-bar-fill"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="day-value">{item.count}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// 性別×年齢層分布（円グラフ）
function GenderAgePieChart({ data }: { data: Record<string, Record<string, number>> }) {
  // 性別×年齢層の組み合わせでデータを作成
  const chartData: Array<{ label: string; value: number; gender: string; age: string }> = []

  Object.entries(data).forEach(([gender, ageData]) => {
    Object.entries(ageData).forEach(([age, count]) => {
      chartData.push({
        label: `${gender}・${age}`,
        value: count,
        gender,
        age
      })
    })
  })

  // ソート（性別→年代順）
  chartData.sort((a, b) => {
    if (a.gender === b.gender) {
      if (a.age === '未設定') return 1
      if (b.age === '未設定') return -1
      return parseInt(a.age) - parseInt(b.age)
    }
    const genderOrder = ['男性', '女性', '未設定']
    return genderOrder.indexOf(a.gender) - genderOrder.indexOf(b.gender)
  })

  const total = chartData.reduce((sum, item) => sum + item.value, 0)
  const size = 220
  const center = size / 2
  const radius = size / 2 - 20

  let currentAngle = -90

  // 性別ごとの色パレット
  const genderColors: Record<string, string[]> = {
    '男性': ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
    '女性': ['#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8'],
    '未設定': ['#6b7280', '#9ca3af', '#d1d5db']
  }

  const slices = chartData.map((item, index) => {
    const percentage = (item.value / total) * 100
    const angle = (percentage / 100) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = center + radius * Math.cos(startRad)
    const y1 = center + radius * Math.sin(startRad)
    const x2 = center + radius * Math.cos(endRad)
    const y2 = center + radius * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

    // 性別に応じた色を選択
    const colors = genderColors[item.gender] || genderColors['未設定']
    const colorIndex = chartData.filter(d => d.gender === item.gender).indexOf(item)
    const color = colors[colorIndex % colors.length]

    return { ...item, path, percentage, color }
  })

  return (
    <div className="chart-card half-width">
      <h3 className="chart-title">性別×年齢層分布</h3>
      <div className="chart-content">
        <div className="age-pie-container">
          <svg viewBox={`0 0 ${size} ${size}`} className="age-pie-chart">
            {chartData.length === 1 ? (
              // 100%の場合は円を描画
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill={slices[0].color}
                opacity={0.9}
              >
                <title>{`${slices[0].label}: ${slices[0].value} (${slices[0].percentage.toFixed(1)}%)`}</title>
              </circle>
            ) : (
              // 複数データの場合はパスで円グラフを描画
              slices.map((slice, index) => (
                <g key={index}>
                  <path d={slice.path} fill={slice.color} opacity={0.9}>
                    <title>{`${slice.label}: ${slice.value} (${slice.percentage.toFixed(1)}%)`}</title>
                  </path>
                </g>
              ))
            )}
          </svg>
          <div className="age-legend">
            {chartData.map((item, index) => {
              const percentage = ((item.value / total) * 100).toFixed(1)
              const color = slices[index].color
              return (
                <div key={index} className="age-legend-item">
                  <span className="age-legend-color" style={{ backgroundColor: color }}></span>
                  <span className="age-legend-label">{item.label}</span>
                  <span className="age-legend-value">{item.value} ({percentage}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// 日本地図ヒートマップ（SVG版）
function JapanMapHeatmap({ data }: { data: Array<{ prefecture: string; count: number }> }) {
  const [svgContent, setSvgContent] = useState('')
  const [hoveredPrefecture, setHoveredPrefecture] = useState<{ name: string; count: number } | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  const maxCount = Math.max(...data.map(d => d.count), 1)

  // 都道府県コードから名前へのマッピング
  const prefectureCodeToName: Record<string, string> = {
    '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県',
    '05': '秋田県', '06': '山形県', '07': '福島県', '08': '茨城県',
    '09': '栃木県', '10': '群馬県', '11': '埼玉県', '12': '千葉県',
    '13': '東京都', '14': '神奈川県', '15': '新潟県', '16': '富山県',
    '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
    '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県',
    '25': '滋賀県', '26': '京都府', '27': '大阪府', '28': '兵庫県',
    '29': '奈良県', '30': '和歌山県', '31': '鳥取県', '32': '島根県',
    '33': '岡山県', '34': '広島県', '35': '山口県', '36': '徳島県',
    '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
    '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県',
    '45': '宮崎県', '46': '鹿児島県', '47': '沖縄県',
  }

  // 都道府県の色を取得
  const getPrefectureColor = (prefName: string): string => {
    const prefData = data.find(d => d.prefecture === prefName)
    if (!prefData || prefData.count === 0) {
      return '#E8F4FD' // データなし
    }

    const ratio = prefData.count / maxCount
    if (ratio <= 0.25) {
      return '#90CAF9' // 少ない
    } else if (ratio <= 0.5) {
      return '#42A5F5' // 中程度
    } else {
      return '#1976D2' // 多い
    }
  }

  // SVGファイルを読み込み
  useEffect(() => {
    fetch('/japan-map-geolonia.svg')
      .then(response => response.text())
      .then(data => {
        setSvgContent(data)
      })
      .catch(error => {
        console.error('Failed to load SVG map:', error)
      })
  }, [])

  // SVGコンテンツを動的に更新（色を適用）
  useEffect(() => {
    if (!svgContent) return

    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svg = doc.querySelector('svg')

    if (!svg) return

    // 各都道府県グループに色とイベントを設定
    const prefectureGroups = svg.querySelectorAll('g.prefecture')
    prefectureGroups.forEach(group => {
      const code = group.getAttribute('data-code')?.padStart(2, '0')
      const prefName = code ? prefectureCodeToName[code] : null

      if (prefName) {
        const fillColor = getPrefectureColor(prefName)
        const prefData = data.find(d => d.prefecture === prefName)
        const count = prefData?.count || 0

        // 塗りつぶし色を設定
        group.setAttribute('fill', fillColor)
        group.setAttribute('data-prefecture-name', prefName)
        group.setAttribute('data-original-fill', fillColor)
        group.setAttribute('data-count', count.toString())
        ;(group as HTMLElement).style.cursor = 'pointer'
      }
    })

    // 更新されたSVGをコンテナにセット
    const container = document.getElementById('japan-map-container')
    if (container) {
      container.innerHTML = ''
      svg.setAttribute('viewBox', '0 0 1000 1000')
      svg.setAttribute('width', '100%')
      svg.setAttribute('height', 'auto')
      svg.style.maxHeight = '500px'

      container.appendChild(svg)

      // ホバーイベントを追加
      let currentHoveredGroup: Element | null = null

      const handleMouseOver = (e: Event) => {
        let target = e.target as Element
        const svgEl = svg

        // 都道府県グループを探す
        while (target && target !== svgEl) {
          if (target.classList && target.classList.contains('prefecture')) {
            if (target === currentHoveredGroup) {
              return
            }

            // 前の要素の色を戻す
            if (currentHoveredGroup) {
              const prevOriginalFill = currentHoveredGroup.getAttribute('data-original-fill')
              if (prevOriginalFill) {
                currentHoveredGroup.setAttribute('fill', prevOriginalFill)
              }
            }

            currentHoveredGroup = target
            const prefName = target.getAttribute('data-prefecture-name')
            const count = parseInt(target.getAttribute('data-count') || '0')

            if (prefName) {
              target.setAttribute('fill', '#FFD93D')
              setHoveredPrefecture({ name: prefName, count })
              const mouseEvent = e as MouseEvent
              setTooltipPosition({
                x: mouseEvent.clientX,
                y: mouseEvent.clientY
              })
            }
            break
          }
          target = target.parentElement as Element
        }

        // どの都道府県の上でもない場合
        if (!target || target === svgEl) {
          if (currentHoveredGroup) {
            const prevOriginalFill = currentHoveredGroup.getAttribute('data-original-fill')
            if (prevOriginalFill) {
              currentHoveredGroup.setAttribute('fill', prevOriginalFill)
            }
            currentHoveredGroup = null
            setHoveredPrefecture(null)
          }
        }
      }

      const handleMouseMove = (e: Event) => {
        if (currentHoveredGroup) {
          const mouseEvent = e as MouseEvent
          setTooltipPosition({
            x: mouseEvent.clientX,
            y: mouseEvent.clientY
          })
        }
      }

      const handleMouseLeave = () => {
        if (currentHoveredGroup) {
          const prevOriginalFill = currentHoveredGroup.getAttribute('data-original-fill')
          if (prevOriginalFill) {
            currentHoveredGroup.setAttribute('fill', prevOriginalFill)
          }
          currentHoveredGroup = null
        }
        setHoveredPrefecture(null)
      }

      svg.addEventListener('mouseover', handleMouseOver as EventListener)
      svg.addEventListener('mousemove', handleMouseMove as EventListener)
      svg.addEventListener('mouseleave', handleMouseLeave)
    }
  }, [svgContent, data])

  // TOP10都道府県を取得
  const top10 = [...data]
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return (
    <div className="chart-card full-width">
      <h3 className="chart-title">都道府県別分布</h3>
      <div className="chart-content">
        <div className="prefecture-content-layout">
          {/* 左側：TOP10ランキング */}
          <div className="prefecture-ranking">
            <h4 className="ranking-title">登録数TOP10</h4>
            <div className="ranking-list">
              {top10.length > 0 ? (
                top10.map((item, index) => (
                  <div key={item.prefecture} className="ranking-item">
                    <div className="ranking-rank">{index + 1}</div>
                    <div className="ranking-prefecture">{item.prefecture}</div>
                    <div className="ranking-count">{item.count}</div>
                  </div>
                ))
              ) : (
                <div className="ranking-empty">データがありません</div>
              )}
            </div>
          </div>

          {/* 右側：地図 */}
          <div className="japan-map-wrapper">
            <div id="japan-map-container"></div>

            {/* ホバーツールチップ */}
            {hoveredPrefecture && (
              <div
                className="prefecture-tooltip"
                style={{
                  position: 'fixed',
                  left: `${tooltipPosition.x + 15}px`,
                  top: `${tooltipPosition.y + 15}px`,
                  zIndex: 1000,
                }}
              >
                <div className="tooltip-header">
                  <strong>{hoveredPrefecture.name}</strong>
                </div>
                <div className="tooltip-body">
                  顧客数: {hoveredPrefecture.count}件
                </div>
              </div>
            )}

            {/* 凡例 */}
            <div className="map-legend">
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#1976D2' }}></div>
                <span>多い (上位25%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#42A5F5' }}></div>
                <span>中程度 (25-50%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#90CAF9' }}></div>
                <span>少ない (下位25%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#E8F4FD' }}></div>
                <span>データなし</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
