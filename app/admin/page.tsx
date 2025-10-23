'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUsersGear,
  faUserShield,
  faUserPlus,
  faFilter,
  faPaperPlane,
  faSync,
  faEdit,
  faTimes,
  faCheck,
  faEnvelope,
  faLock,
  faMapMarkerAlt,
} from '@fortawesome/free-solid-svg-icons'
import './admin.css'

type AdminUser = {
  id: string
  email?: string
  role: string | null
  display_name: string | null
  department: string | null
  team_id: string | null
  team_name: string | null
  location_id: string | null
  location_name: string | null
  location_is_active: boolean | null
  status: 'active' | 'invited' | 'disabled'
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  factors_count: number
}

type Team = {
  id: string
  name: string
}

type LocationSlot = {
  id: string
  code: string
  name: string
  is_active: boolean
  sort_order: number
}

type RoleSummary = Record<string, number>

const roleLabels: Record<string, string> = {
  admin: '管理者',
  manager: 'マネージャー',
  user: '一般ユーザー',
  viewer: '閲覧者',
}

const statusLabels: Record<AdminUser['status'], { label: string; className: string }> = {
  active: { label: '有効', className: 'badge-active' },
  invited: { label: '招待中', className: 'badge-invited' },
  disabled: { label: '停止中', className: 'badge-disabled' },
}

const roleOrder = ['admin', 'manager', 'user', 'viewer']

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [locations, setLocations] = useState<LocationSlot[]>([])
  const [roleSummary, setRoleSummary] = useState<RoleSummary>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState({ search: '', role: '', status: '' })
  const [searchInput, setSearchInput] = useState('')

  const [inviteForm, setInviteForm] = useState({
    email: '',
    display_name: '',
    role: 'user',
    team_id: '',
    location_id: '',
    send_invite: true,
    temporary_password: '',
  })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteResult, setInviteResult] = useState<string | null>(null)

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editForm, setEditForm] = useState({
    display_name: '',
    role: 'user',
    team_id: '',
    location_id: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const activeLocations = useMemo(
    () => locations.filter((location) => location.is_active),
    [locations]
  )

  const locationOptions = useMemo(() => {
    const active = locations.filter((location) => location.is_active)
    const inactive = locations.filter((location) => !location.is_active)
    return [...active, ...inactive]
  }, [locations])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('per_page', perPage.toString())
      if (filters.search) params.set('search', filters.search)
      if (filters.role) params.set('role', filters.role)
      if (filters.status) params.set('status', filters.status)

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { 'Cache-Control': 'no-store' },
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error('管理者権限が必要です')
        }
        throw new Error(detail.error || 'ユーザー情報の取得に失敗しました')
      }

      const result = await response.json()
      setUsers(result.data || [])
      setTeams(result.teams || [])
      setRoleSummary(result.role_summary || {})
      setTotal(result.total || 0)
      setPerPage(result.per_page || 25)
      setLocations(result.locations || [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'ユーザー情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [filters.search, filters.role, filters.status, page, perPage])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    if (editingUser) {
      setEditForm({
        display_name: editingUser.display_name ?? '',
        role: editingUser.role ?? 'user',
        team_id: editingUser.team_id ?? '',
        location_id: editingUser.location_id ?? '',
      })
    }
  }, [editingUser])

  const handleInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInviteLoading(true)
    setInviteResult(null)
    setError(null)

    try {
      if (!inviteForm.email || !inviteForm.display_name) {
        throw new Error('メールアドレスと表示名は必須です')
      }

      if (!inviteForm.send_invite && inviteForm.temporary_password && inviteForm.temporary_password.length < 12) {
        throw new Error('仮パスワードは12文字以上で指定してください')
      }

      const payload = {
        email: inviteForm.email.trim(),
        display_name: inviteForm.display_name.trim(),
        role: inviteForm.role,
        team_id: inviteForm.team_id || undefined,
        location_id: inviteForm.location_id || undefined,
        send_invite: inviteForm.send_invite,
        temporary_password: inviteForm.send_invite ? undefined : inviteForm.temporary_password || undefined,
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error('管理者権限が必要です')
        }
        throw new Error(detail.error || 'ユーザーの作成に失敗しました')
      }

      const result = await response.json()
      const generatedPassword = result.generated_password as string | null

      setInviteResult(
        generatedPassword
          ? `アカウントを作成しました。仮パスワード: ${generatedPassword}`
          : 'アカウントを作成しました。招待メールを送信しています。'
      )

      setInviteForm({
        email: '',
        display_name: '',
        role: 'user',
        team_id: '',
        location_id: '',
        send_invite: true,
        temporary_password: '',
      })

      await fetchUsers()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'ユーザーの作成に失敗しました')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingUser) return

    setSavingEdit(true)
    setError(null)

    try {
      if (!editForm.display_name.trim()) {
        throw new Error('表示名は必須です')
      }

      const payload: Record<string, any> = {}
      if (editForm.display_name.trim() !== (editingUser.display_name ?? '')) {
        payload.display_name = editForm.display_name.trim()
      }
      if (editForm.role !== (editingUser.role ?? 'user')) {
        payload.role = editForm.role
      }
      if ((editForm.team_id || '') !== (editingUser.team_id ?? '')) {
        payload.team_id = editForm.team_id || null
      }
      if ((editForm.location_id || '') !== (editingUser.location_id ?? '')) {
        payload.location_id = editForm.location_id || null
      }

      if (Object.keys(payload).length === 0) {
        setEditingUser(null)
        return
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error('管理者権限が必要です')
        }
        throw new Error(detail.error || 'ユーザー情報の更新に失敗しました')
      }

      const result = await response.json()
      const updatedUser: AdminUser = result.data

      setUsers((prev) => prev.map((user) => (user.id === updatedUser.id ? updatedUser : user)))
      setEditingUser(null)
      await fetchUsers()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'ユーザー情報の更新に失敗しました')
    } finally {
      setSavingEdit(false)
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage])

  return (
    <AppLayout>
      <div className="page-content admin-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <FontAwesomeIcon icon={faUsersGear} />
              管理者コンソール
            </h1>
            <p className="page-subtitle">アカウント発行・ユーザー管理・権限設定を行います</p>
          </div>
        </div>

        {error && (
          <div className="admin-alert admin-alert-error">
            <FontAwesomeIcon icon={faTimes} />
            <span>{error}</span>
          </div>
        )}

        {inviteResult && (
          <div className="admin-alert admin-alert-success">
            <FontAwesomeIcon icon={faCheck} />
            <span>{inviteResult}</span>
          </div>
        )}

        <section className="admin-section">
          <h2 className="section-title">
            <FontAwesomeIcon icon={faUserPlus} />
            アカウント発行
          </h2>
          <form className="invite-form" onSubmit={handleInviteSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>
                  <FontAwesomeIcon icon={faEnvelope} />
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="form-field">
                <label>
                  <FontAwesomeIcon icon={faUserShield} />
                  表示名
                </label>
                <input
                  type="text"
                  value={inviteForm.display_name}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, display_name: e.target.value }))}
                  placeholder="例: 山田 太郎"
                  required
                />
              </div>
              <div className="form-field">
                <label>
                  <FontAwesomeIcon icon={faUserShield} />
                  権限ロール
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  {roleOrder.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>
                  <FontAwesomeIcon icon={faUsersGear} />
                  所属チーム
                </label>
                <select
                  value={inviteForm.team_id}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, team_id: e.target.value }))}
                >
                  <option value="">未設定</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                  所属地
                </label>
                <select
                  value={inviteForm.location_id}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, location_id: e.target.value }))}
                >
                  <option value="">未設定</option>
                  {locationOptions.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                      {!location.is_active ? '（停止中）' : ''}
                    </option>
                  ))}
                </select>
                {!activeLocations.length && (
                  <p className="field-help">有効な所属地がありません。設定ページで追加してください。</p>
                )}
              </div>
              <div className="form-field toggle-field">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={inviteForm.send_invite}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, send_invite: e.target.checked }))}
                  />
                  招待メールを送信
                </label>
                <p className="field-help">無効にすると仮パスワードを発行します</p>
              </div>
              {!inviteForm.send_invite && (
                <div className="form-field">
                  <label>
                    <FontAwesomeIcon icon={faLock} />
                    仮パスワード
                  </label>
                  <input
                    type="text"
                    value={inviteForm.temporary_password}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, temporary_password: e.target.value }))}
                    placeholder="ランダム生成されます（任意）"
                  />
                  <p className="field-help">未入力の場合は安全なパスワードを自動発行します</p>
                </div>
              )}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                <FontAwesomeIcon icon={inviteForm.send_invite ? faPaperPlane : faUserPlus} />
                {inviteLoading ? '送信中...' : inviteForm.send_invite ? '招待メールを送信' : 'アカウントを作成'}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-section">
          <h2 className="section-title">
            <FontAwesomeIcon icon={faUserShield} />
            ユーザーサマリー
          </h2>
          <div className="summary-grid">
            {roleOrder.map((role) => (
              <div key={role} className="summary-card">
                <div className="summary-header">
                  <FontAwesomeIcon icon={faUserShield} />
                  <span>{roleLabels[role]}</span>
                </div>
                <div className="summary-value">{roleSummary[role] ?? 0}</div>
              </div>
            ))}
            <div className="summary-card">
              <div className="summary-header">
                <FontAwesomeIcon icon={faUsersGear} />
                <span>総ユーザー</span>
              </div>
              <div className="summary-value">{total}</div>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <div className="section-header">
            <h2 className="section-title">
              <FontAwesomeIcon icon={faUsersGear} />
              ユーザー管理
            </h2>
            <button className="btn btn-secondary" onClick={() => fetchUsers()} disabled={loading}>
              <FontAwesomeIcon icon={faSync} />
              再読み込み
            </button>
          </div>

          <div className="filters-bar">
            <form
              className="search-form"
              onSubmit={(e) => {
                e.preventDefault()
                setPage(1)
                setFilters((prev) => ({ ...prev, search: searchInput.trim() }))
              }}
            >
              <div className="search-field">
                <label>
                  <FontAwesomeIcon icon={faFilter} />
                  検索
                </label>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="メール、氏名、所属地、チームで検索"
                />
              </div>
              <button type="submit" className="btn btn-secondary">
                検索
              </button>
            </form>

            <div className="filter-controls">
              <div className="filter-field">
                <label>ロール</label>
                <select
                  value={filters.role}
                  onChange={(e) => {
                    setPage(1)
                    setFilters((prev) => ({ ...prev, role: e.target.value }))
                  }}
                >
                  <option value="">すべて</option>
                  {roleOrder.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>ステータス</label>
                <select
                  value={filters.status}
                  onChange={(e) => {
                    setPage(1)
                    setFilters((prev) => ({ ...prev, status: e.target.value as AdminUser['status'] | '' }))
                  }}
                >
                  <option value="">すべて</option>
                  <option value="active">有効</option>
                  <option value="invited">招待中</option>
                  <option value="disabled">停止中</option>
                </select>
              </div>
            </div>
          </div>

          {editingUser && (
            <div className="edit-panel">
              <div className="edit-header">
                <h3>
                  <FontAwesomeIcon icon={faEdit} />
                  ユーザー編集
                </h3>
                <button className="icon-button" onClick={() => setEditingUser(null)}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <form className="edit-form" onSubmit={handleEditSubmit}>
                <div className="form-grid">
                  <div className="form-field">
                    <label>表示名</label>
                    <input
                      type="text"
                      value={editForm.display_name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, display_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>ロール</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                    >
                      {roleOrder.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>所属チーム</label>
                    <select
                      value={editForm.team_id}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, team_id: e.target.value }))}
                    >
                      <option value="">未設定</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>所属地</label>
                    <select
                      value={editForm.location_id}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, location_id: e.target.value }))}
                    >
                      <option value="">未設定</option>
                      {locationOptions.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                          {!location.is_active ? '（停止中）' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                    <FontAwesomeIcon icon={faCheck} />
                    {savingEdit ? '保存中...' : '変更を保存'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>メール</th>
                  <th>表示名 / 所属地</th>
                  <th>ロール</th>
                  <th>チーム</th>
                  <th>状態</th>
                  <th>最終ログイン</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="table-loading">
                      読み込み中...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      条件に一致するユーザーが見つかりません
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const statusMeta = statusLabels[user.status]
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="cell-main">
                            <span className="cell-primary">{user.email}</span>
                            <span className="cell-secondary">
                              作成: {new Date(user.created_at).toLocaleString('ja-JP')}
                            </span>
                          </div>
                        </td>
                        <td>
                      <div className="cell-main">
                        <span className="cell-primary">{user.display_name || '未設定'}</span>
                        <span className="cell-secondary">
                          {user.location_name
                            ? `${user.location_name}${user.location_is_active === false ? '（停止中）' : ''}`
                            : '所属地未設定'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`role-pill role-${user.role ?? 'unknown'}`}>
                        {roleLabels[user.role ?? 'user'] || user.role || '未設定'}
                      </span>
                    </td>
                    <td>{user.team_name || '未設定'}</td>
                    <td>
                      <span className={`status-badge ${statusMeta.className}`}>{statusMeta.label}</span>
                    </td>
                        <td>
                          <div className="cell-main">
                            <span className="cell-primary">
                              {user.last_sign_in_at
                                ? new Date(user.last_sign_in_at).toLocaleString('ja-JP')
                                : '未ログイン'}
                            </span>
                            <span className="cell-secondary">
                              {user.email_confirmed_at ? '確認済み' : '未確認'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser(user)}>
                            <FontAwesomeIcon icon={faEdit} />
                            編集
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              前へ
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
            >
              次へ
            </button>
          </div>
        </section>
      </div>
    </AppLayout>
  )
}
