'use client'

import { useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faUsers, 
  faUserTie,
  faHandshake,
  faUserCog,
  faChartBar, 
  faPlus,
  faArrowRight,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons'
import { initializeChartTooltip } from './chart-tooltip'
import './dashboard.css'

export default function DashboardPage() {
  useEffect(() => {
    initializeChartTooltip()
  }, [])
  return (
    <AppLayout
      showRightPanel={true}
      rightPanelContent={
        <div>
          <h4 style={{ marginBottom: '1rem', color: 'var(--gray-700)' }}>
            クイックアクション
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn btn-primary btn-sm">
              新規顧客登録
            </button>
            <button className="btn btn-secondary btn-sm">
              発注データ同期
            </button>
            <button className="btn btn-secondary btn-sm">
              監査ログ確認
            </button>
          </div>

          <div className="divider" />

          <h4 style={{ marginBottom: '1rem', color: 'var(--gray-700)' }}>
            最近の活動
          </h4>
          <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
            <div style={{ padding: '0.75rem', background: 'var(--gray-50)', borderRadius: '6px', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>顧客登録</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>5分前</div>
            </div>
            <div style={{ padding: '0.75rem', background: 'var(--gray-50)', borderRadius: '6px', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>発注データ更新</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>15分前</div>
            </div>
          </div>
        </div>
      }
    >
      <div className="dashboard-container">
        {/* ページタイトル */}
        <div className="page-header">
          <h1 className="page-title">ダッシュボード</h1>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary btn-sm">
              <FontAwesomeIcon icon={faChartBar} />
              レポート出力
            </button>
            <button className="btn btn-accent">
              <FontAwesomeIcon icon={faPlus} />
              新規顧客登録
            </button>
          </div>
        </div>

        {/* 統計カード */}
        <div className="stats-grid-custom">
          {/* 総登録数 */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(20, 36, 63, 0.1)', color: 'var(--brand-primary)' }}>
              <FontAwesomeIcon icon={faUsers} />
            </div>
            <div className="stat-content">
              <div className="stat-label">総登録数</div>
              <div className="stat-value">1,234</div>
              <div className="stat-change positive">+12.5%</div>
            </div>
          </div>

          {/* 顧客数 */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <FontAwesomeIcon icon={faUserTie} />
            </div>
            <div className="stat-content">
              <div className="stat-label">顧客</div>
              <div className="stat-value">856</div>
              <div className="stat-change positive">+8.3%</div>
            </div>
          </div>

          {/* 月別推移グラフ（2枚分） */}
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">2025年 新規顧客登録数の推移</h3>
              <select className="chart-year-selector">
                <option value="2025">2025年</option>
                <option value="2024">2024年</option>
                <option value="2023">2023年</option>
              </select>
            </div>
            <div className="chart-body">
              <svg className="line-chart" viewBox="0 0 600 140" preserveAspectRatio="xMidYMid meet">
                {/* グリッドライン */}
                <line x1="40" y1="10" x2="40" y2="110" stroke="#e5e7eb" strokeWidth="1"/>
                <line x1="40" y1="110" x2="580" y2="110" stroke="#e5e7eb" strokeWidth="2"/>
                
                {/* Y軸ラベル */}
                <text x="30" y="15" fontSize="10" fill="#6b7280" textAnchor="end">100</text>
                <text x="30" y="40" fontSize="10" fill="#6b7280" textAnchor="end">75</text>
                <text x="30" y="65" fontSize="10" fill="#6b7280" textAnchor="end">50</text>
                <text x="30" y="90" fontSize="10" fill="#6b7280" textAnchor="end">25</text>
                <text x="30" y="113" fontSize="10" fill="#6b7280" textAnchor="end">0</text>

                {/* グリッド横線 */}
                <line x1="40" y1="10" x2="580" y2="10" stroke="#f3f4f6" strokeWidth="1"/>
                <line x1="40" y1="35" x2="580" y2="35" stroke="#f3f4f6" strokeWidth="1"/>
                <line x1="40" y1="60" x2="580" y2="60" stroke="#f3f4f6" strokeWidth="1"/>
                <line x1="40" y1="85" x2="580" y2="85" stroke="#f3f4f6" strokeWidth="1"/>
                
                {/* エリア塗りつぶし */}
                <polygon
                  points="85,70 130,60 175,67 220,50 265,55 310,40 355,45 400,35 445,48 490,30 535,45 535,110 85,110"
                  fill="rgba(20, 36, 63, 0.1)"
                />
                
                {/* データポイント（折れ線） */}
                <polyline
                  points="85,70 130,60 175,67 220,50 265,55 310,40 355,45 400,35 445,48 490,30 535,45"
                  fill="none"
                  stroke="#14243F"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* データポイントの丸（ホバー可能） */}
                <circle className="data-point" cx="85" cy="70" r="5" fill="#14243F" data-month="1月" data-value="42" data-change="+5%"/>
                <circle className="data-point" cx="130" cy="60" r="5" fill="#14243F" data-month="2月" data-value="52" data-change="+23.8%"/>
                <circle className="data-point" cx="175" cy="67" r="5" fill="#14243F" data-month="3月" data-value="45" data-change="-13.5%"/>
                <circle className="data-point" cx="220" cy="50" r="5" fill="#14243F" data-month="4月" data-value="62" data-change="+37.8%"/>
                <circle className="data-point" cx="265" cy="55" r="5" fill="#14243F" data-month="5月" data-value="57" data-change="-8.1%"/>
                <circle className="data-point" cx="310" cy="40" r="5" fill="#14243F" data-month="6月" data-value="72" data-change="+26.3%"/>
                <circle className="data-point" cx="355" cy="45" r="5" fill="#14243F" data-month="7月" data-value="67" data-change="-6.9%"/>
                <circle className="data-point" cx="400" cy="35" r="5" fill="#14243F" data-month="8月" data-value="77" data-change="+14.9%"/>
                <circle className="data-point" cx="445" cy="48" r="5" fill="#14243F" data-month="9月" data-value="64" data-change="-16.9%"/>
                <circle className="data-point" cx="490" cy="30" r="5" fill="#14243F" data-month="10月" data-value="82" data-change="+28.1%"/>
                <circle className="data-point" cx="535" cy="45" r="5" fill="#ce6b0f" data-month="11月" data-value="67" data-change="-18.3%"/>
                
                {/* X軸ラベル（月） */}
                <text x="85" y="128" fontSize="10" fill="#6b7280" textAnchor="middle">1月</text>
                <text x="130" y="128" fontSize="10" fill="#6b7280" textAnchor="middle">2月</text>
                <text x="175" y="128" fontSize="10" fill="#6b7280" textAnchor="middle">3月</text>
                <text x="220" y="128" fontSize="10" fill="#6b7280" textAnchor="middle">4月</text>
                <text x="265" y="128" fontSize="10" fill="#6b7280" textAnchor="middle">5月</text>
                <text x="310" y="128" fontSize="10" fill="#6b7280" textAnchor="middle">6月</text>
                <text x="355" y="128" fontSize="10" fill="#6b7280" textAnchor="middle">7月</text>
                <text x="400" y="128" fontSize="10" fill="#6b7280" textAnchor="middle">8月</text>
                <text x="445" y="128" fontSize="10" fill="#6b7280" textAnchor="middle">9月</text>
                <text x="490" y="128" fontSize="10" fill="#6b7280" textAnchor="middle">10月</text>
                <text x="535" y="128" fontSize="10" fill="#ce6b0f" textAnchor="middle" fontWeight="600">11月</text>
              </svg>
              
              {/* ツールチップ（JSで制御） */}
              <div id="chart-tooltip" className="chart-tooltip">
                <div className="tooltip-month"></div>
                <div className="tooltip-value"></div>
                <div className="tooltip-change"></div>
              </div>
            </div>
          </div>
        </div>

        {/* コンテンツグリッド */}
        <div className="content-grid">
          {/* 最近の登録 */}
          <div className="card content-card">
            <div className="card-header">
              <h3 className="card-title">最近の登録</h3>
              <a href="/customers" className="card-link">
                すべて見る <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }} />
              </a>
            </div>
            <div className="card-body">
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
                  <tr>
                    <td><strong>株式会社サンプル</strong></td>
                    <td><span className="badge badge-primary">顧客</span></td>
                    <td><code>C-001234</code></td>
                    <td>2025-10-20</td>
                  </tr>
                  <tr>
                    <td><strong>テスト代理店</strong></td>
                    <td><span className="badge badge-success">代理店</span></td>
                    <td><code>A-000045</code></td>
                    <td>2025-10-19</td>
                  </tr>
                  <tr>
                    <td><strong>山田 太郎</strong></td>
                    <td><span className="badge badge-info">スタッフ</span></td>
                    <td><code>S-000123</code></td>
                    <td>2025-10-18</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* クイックアクション */}
          <div className="card content-card">
            <div className="card-header">
              <h3 className="card-title">クイックアクション</h3>
            </div>
            <div className="card-body">
              <div className="quick-actions">
                <button className="action-card">
                  <div className="action-icon" style={{ background: 'rgba(20, 36, 63, 0.1)', color: 'var(--brand-primary)' }}>
                    <FontAwesomeIcon icon={faUsers} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">新規顧客登録</div>
                    <div className="action-desc">新しい顧客を登録</div>
                  </div>
                </button>

                <button className="action-card">
                  <div className="action-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <FontAwesomeIcon icon={faChartBar} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">顧客分析</div>
                    <div className="action-desc">統計データを確認</div>
                  </div>
                </button>

                <button className="action-card">
                  <div className="action-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">要対応項目</div>
                    <div className="action-desc">3件の要確認事項</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

