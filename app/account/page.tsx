'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faUser, 
  faEnvelope, 
  faBuilding, 
  faSave,
  faUsers,
  faFileAlt,
  faChartLine,
  faCalendar,
  faSpinner
} from '@fortawesome/free-solid-svg-icons'
import './account.css'

interface UserProfile {
  display_name: string
  department: string
  role: string
}

interface UserStats {
  total_customers: number
  customers_this_month: number
  recent_activities: Array<{
    action: string
    entity: string
    created_at: string
  }>
}

export default function AccountPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile>({
    display_name: '',
    department: '',
    role: ''
  })
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // プロファイルと統計データを取得
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // プロファイル取得
        const profileRes = await fetch('/api/account/profile')
        if (profileRes.ok) {
          const data = await profileRes.json()
          console.log('Profile data:', data)
          setProfile({
            display_name: data.display_name || '',
            department: data.department || '',
            role: data.role || ''
          })
        } else {
          const errorData = await profileRes.json()
          console.error('Profile fetch error:', errorData)
        }

        // 統計データ取得
        const statsRes = await fetch('/api/account/stats')
        if (statsRes.ok) {
          const data = await statsRes.json()
          console.log('Stats data:', data)
          setStats(data)
        } else {
          const errorData = await statsRes.json()
          console.error('Stats fetch error:', errorData)
        }
      } catch (error) {
        console.error('Failed to fetch account data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'プロファイルを更新しました' })
      } else {
        throw new Error('更新に失敗しました')
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '更新に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  const getRoleName = (role: string) => {
    const roleMap: Record<string, string> = {
      admin: '管理者',
      manager: 'マネージャー',
      user: '一般ユーザー',
      viewer: '閲覧者'
    }
    return roleMap[role] || role
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="loading-container">
          <FontAwesomeIcon icon={faSpinner} spin size="2x" />
          <p>読み込み中...</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="account-container">
        {/* ページヘッダー */}
        <div className="page-header">
          <h1 className="page-title">マイページ</h1>
          <p className="page-subtitle">アカウント情報と統計データ</p>
        </div>

        {/* メッセージ */}
        {message && (
          <div className={`message message-${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="account-grid">
          {/* 左側: プロファイル編集 */}
          <div className="account-section">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <FontAwesomeIcon icon={faUser} />
                  プロファイル情報
                </h2>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit} className="profile-form">
                  {/* メールアドレス（読み取り専用） */}
                  <div className="form-group">
                    <label className="label">
                      <FontAwesomeIcon icon={faEnvelope} />
                      メールアドレス
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      className="input"
                      disabled
                    />
                    <p className="help-text">メールアドレスは変更できません</p>
                  </div>

                  {/* 表示名 */}
                  <div className="form-group">
                    <label className="label">
                      <FontAwesomeIcon icon={faUser} />
                      表示名
                    </label>
                    <input
                      type="text"
                      value={profile.display_name}
                      onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                      className="input"
                      placeholder="例: 山田 太郎"
                      required
                    />
                  </div>

                  {/* 部署 */}
                  <div className="form-group">
                    <label className="label">
                      <FontAwesomeIcon icon={faBuilding} />
                      部署
                    </label>
                    <select
                      value={profile.department}
                      onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">選択してください</option>
                      <option value="北海道">北海道</option>
                      <option value="仙台">仙台</option>
                      <option value="東京">東京</option>
                      <option value="名古屋">名古屋</option>
                      <option value="大阪">大阪</option>
                      <option value="代理店">代理店</option>
                    </select>
                  </div>

                  {/* ロール（読み取り専用） */}
                  <div className="form-group">
                    <label className="label">
                      <FontAwesomeIcon icon={faBuilding} />
                      権限
                    </label>
                    <div className="role-badge">
                      {profile.role ? (
                        <span className={`badge badge-${profile.role}`}>
                          {getRoleName(profile.role)}
                        </span>
                      ) : (
                        <span className="badge">読み込み中...</span>
                      )}
                    </div>
                    <p className="help-text">権限の変更は管理者にお問い合わせください</p>
                  </div>

                  {/* 保存ボタン */}
                  <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span>保存中...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faSave} />
                        <span>変更を保存</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* 右側: 統計情報 */}
          <div className="account-section">
            {/* 統計カード */}
            <div className="stats-cards">
              <div className="stat-card-small">
                <div className="stat-icon" style={{ background: 'rgba(20, 36, 63, 0.1)', color: 'var(--brand-primary)' }}>
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">担当顧客</div>
                  <div className="stat-value">{stats?.total_customers || 0}</div>
                </div>
              </div>

              <div className="stat-card-small">
                <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                  <FontAwesomeIcon icon={faCalendar} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">今月の登録</div>
                  <div className="stat-value">{stats?.customers_this_month || 0}</div>
                </div>
              </div>
            </div>

            {/* 最近のアクティビティ */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <FontAwesomeIcon icon={faChartLine} />
                  最近のアクティビティ
                </h2>
              </div>
              <div className="card-body">
                {stats?.recent_activities && stats.recent_activities.length > 0 ? (
                  <div className="activity-list">
                    {stats.recent_activities.map((activity, index) => (
                      <div key={index} className="activity-item">
                        <div className="activity-icon">
                          <FontAwesomeIcon icon={faFileAlt} />
                        </div>
                        <div className="activity-content">
                          <div className="activity-action">
                            {activity.action === 'create' && '作成'}
                            {activity.action === 'update' && '更新'}
                            {activity.action === 'delete' && '削除'}
                          </div>
                          <div className="activity-entity">{activity.entity}</div>
                          <div className="activity-time">
                            {new Date(activity.created_at).toLocaleString('ja-JP')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <FontAwesomeIcon icon={faFileAlt} size="2x" />
                    <p>まだアクティビティがありません</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

