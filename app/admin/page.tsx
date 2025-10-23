'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUsersGear,
  faUserShield,
  faUserPlus,
  faFilter,
  faSync,
  faEdit,
  faTimes,
  faCheck,
  faEnvelope,
  faLock,
  faMapMarkerAlt,
  faCog,
  faList,
  faPlus,
  faSave,
  faUndo,
  faToggleOn,
  faToggleOff,
  faListOl,
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
  created_at?: string
}

type LocationSlot = {
  id: string
  code: string
  name: string
  description?: string | null
  is_active: boolean
  sort_order: number
  created_at?: string
}

type TabType = 'users' | 'create' | 'settings'
type SettingsSubTab = 'locations' | 'teams'

const roleLabels: Record<string, string> = {
  admin: '管理者',
  manager: 'マネージャー',
  agency: '代理店',
  user: '一般ユーザー',
  viewer: '閲覧者',
}

const statusLabels: Record<AdminUser['status'], { label: string; className: string }> = {
  active: { label: '有効', className: 'badge-active' },
  invited: { label: '招待中', className: 'badge-invited' },
  disabled: { label: '停止中', className: 'badge-disabled' },
}

const roleOrder = ['admin', 'manager', 'agency', 'user', 'viewer']

const initialInviteForm = {
  email: '',
  display_name: '',
  role: 'user',
  team_id: '',
  location_id: '',
  password: '',
  passwordConfirm: '',
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('users')
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('locations')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [locations, setLocations] = useState<LocationSlot[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState({ search: '', role: '', status: '', location: '' })
  const [searchInput, setSearchInput] = useState('')

  const [inviteForm, setInviteForm] = useState(() => ({ ...initialInviteForm }))
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

  // Settings tab states
  const [locationForm, setLocationForm] = useState({
    name: '',
    description: '',
    sort_order: '100',
    is_active: true,
  })
  const [editingLocation, setEditingLocation] = useState<LocationSlot | null>(null)
  const [editLocationForm, setEditLocationForm] = useState({
    name: '',
    description: '',
    sort_order: '100',
    is_active: true,
  })
  const [locationSaving, setLocationSaving] = useState(false)
  const [locationInfo, setLocationInfo] = useState<string | null>(null)

  const [teamForm, setTeamForm] = useState({ name: '' })
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [editTeamForm, setEditTeamForm] = useState({ name: '' })
  const [teamSaving, setTeamSaving] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [teamInfo, setTeamInfo] = useState<string | null>(null)

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
      if (filters.location) params.set('location_id', filters.location)

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
      setTotal(result.total || 0)
      setPerPage(result.per_page || 25)
      setLocations(result.locations || [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'ユーザー情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [filters.search, filters.role, filters.status, filters.location, page, perPage])

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

  useEffect(() => {
    if (editingLocation) {
      setEditLocationForm({
        name: editingLocation.name,
        description: editingLocation.description ?? '',
        sort_order: String(editingLocation.sort_order),
        is_active: editingLocation.is_active,
      })
    }
  }, [editingLocation])

  useEffect(() => {
    if (editingTeam) {
      setEditTeamForm({
        name: editingTeam.name,
      })
    }
  }, [editingTeam])

  const handleInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInviteLoading(true)
    setInviteResult(null)
    setError(null)

    try {
      if (!inviteForm.email || !inviteForm.display_name) {
        throw new Error('メールアドレスと表示名は必須です')
      }

      if (!inviteForm.password || inviteForm.password.length < 12) {
        throw new Error('パスワードは12文字以上で入力してください')
      }

      if (inviteForm.password !== inviteForm.passwordConfirm) {
        throw new Error('パスワードと確認用パスワードが一致しません')
      }

      const payload = {
        email: inviteForm.email.trim(),
        display_name: inviteForm.display_name.trim(),
        role: inviteForm.role,
        team_id: inviteForm.team_id || undefined,
        location_id: inviteForm.location_id || undefined,
        password: inviteForm.password,
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

      await response.json()

      setInviteResult('アカウントを作成しました。設定したパスワードを利用者に共有してください。')

      setInviteForm(() => ({ ...initialInviteForm }))

      await fetchUsers()

      // 成功後はユーザー一覧タブに自動切り替え
      setTimeout(() => {
        setActiveTab('users')
      }, 2000)
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

  // Settings tab handlers
  const handleLocationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocationSaving(true)
    setError(null)
    setLocationInfo(null)

    try {
      if (!locationForm.name.trim()) {
        throw new Error('名称は必須です')
      }

      const numericSort = Number(locationForm.sort_order || '0')
      if (Number.isNaN(numericSort)) {
        throw new Error('表示順は数値で入力してください')
      }

      const payload = {
        name: locationForm.name.trim(),
        description: locationForm.description.trim() || null,
        sort_order: numericSort,
        is_active: locationForm.is_active,
      }

      const response = await fetch('/api/settings/location-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new Error(detail.error || '所属地スロットの作成に失敗しました')
      }

      setLocationForm({ name: '', description: '', sort_order: '100', is_active: true })
      await fetchUsers()
      setLocationInfo('所属地スロットを作成しました')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : '所属地スロットの作成に失敗しました')
    } finally {
      setLocationSaving(false)
    }
  }

  const handleEditLocationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingLocation) return

    setLocationSaving(true)
    setError(null)
    setLocationInfo(null)

    try {
      if (!editLocationForm.name.trim()) {
        throw new Error('名称は必須です')
      }

      const numericSort = Number(editLocationForm.sort_order || '0')
      if (Number.isNaN(numericSort)) {
        throw new Error('表示順は数値で入力してください')
      }

      const diff: Record<string, any> = {}

      if (editLocationForm.name.trim() !== editingLocation.name) {
        diff.name = editLocationForm.name.trim()
      }
      if ((editLocationForm.description.trim() || null) !== (editingLocation.description || null)) {
        diff.description = editLocationForm.description.trim() || null
      }
      if (numericSort !== editingLocation.sort_order) {
        diff.sort_order = numericSort
      }
      if (editLocationForm.is_active !== editingLocation.is_active) {
        diff.is_active = editLocationForm.is_active
      }

      if (Object.keys(diff).length === 0) {
        setEditingLocation(null)
        return
      }

      const response = await fetch(`/api/settings/location-slots/${editingLocation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diff),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new Error(detail.error || '所属地スロットの更新に失敗しました')
      }

      setEditingLocation(null)
      await fetchUsers()
      setLocationInfo('所属地スロットを更新しました')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : '所属地スロットの更新に失敗しました')
    } finally {
      setLocationSaving(false)
    }
  }

  const handleLocationEdit = (location: LocationSlot) => {
    setEditingLocation(location)
  }

  const handleLocationToggle = async (location: LocationSlot) => {
    setLocationSaving(true)
    setError(null)
    setLocationInfo(null)
    try {
      const response = await fetch(`/api/settings/location-slots/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !location.is_active }),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new Error(detail.error || 'ステータスの更新に失敗しました')
      }

      await fetchUsers()
      setLocationInfo('ステータスを更新しました')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'ステータスの更新に失敗しました')
    } finally {
      setLocationSaving(false)
    }
  }

  const handleTeamSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTeamSaving(true)
    setTeamError(null)
    setTeamInfo(null)

    try {
      if (!teamForm.name.trim()) {
        throw new Error('所属チーム名は必須です')
      }

      const payload = { name: teamForm.name.trim() }

      const response = await fetch('/api/settings/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new Error(detail.error || '所属チームの作成に失敗しました')
      }

      setTeamForm({ name: '' })
      await fetchUsers()
      setTeamInfo('所属チームを作成しました')
    } catch (err) {
      console.error(err)
      setTeamError(err instanceof Error ? err.message : '所属チームの作成に失敗しました')
    } finally {
      setTeamSaving(false)
    }
  }

  const handleEditTeamSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingTeam) return

    setTeamSaving(true)
    setTeamError(null)
    setTeamInfo(null)

    try {
      if (!editTeamForm.name.trim()) {
        throw new Error('所属チーム名は必須です')
      }

      if (editTeamForm.name.trim() === editingTeam.name) {
        setEditingTeam(null)
        return
      }

      const payload = { name: editTeamForm.name.trim() }

      const response = await fetch(`/api/settings/teams/${editingTeam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new Error(detail.error || '所属チームの更新に失敗しました')
      }

      setEditingTeam(null)
      await fetchUsers()
      setTeamInfo('所属チームを更新しました')
    } catch (err) {
      console.error(err)
      setTeamError(err instanceof Error ? err.message : '所属チームの更新に失敗しました')
    } finally {
      setTeamSaving(false)
    }
  }

  const handleTeamEdit = (team: Team) => {
    setEditingTeam(team)
  }

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

        {/* タブナビゲーション */}
        <nav className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <FontAwesomeIcon icon={faList} />
            <span>ユーザー一覧</span>
          </button>
          <button
            className={`admin-tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <FontAwesomeIcon icon={faUserPlus} />
            <span>アカウント発行</span>
          </button>
          <button
            className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <FontAwesomeIcon icon={faCog} />
            <span>設定</span>
          </button>
        </nav>

        {/* アカウント発行タブ */}
        {activeTab === 'create' && (
          <div className="tab-content">
            <section className="admin-section">
              <h2 className="section-title">
                <FontAwesomeIcon icon={faUserPlus} />
                新規アカウント発行
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
              <div className="form-field">
                <label>
                  <FontAwesomeIcon icon={faLock} />
                  パスワード
                </label>
                <input
                  type="password"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="12文字以上で入力してください"
                  minLength={12}
                  required
                />
                <p className="field-help">英数字や記号を組み合わせた12文字以上のパスワードを設定してください</p>
              </div>
              <div className="form-field">
                <label>
                  <FontAwesomeIcon icon={faLock} />
                  パスワード（確認）
                </label>
                <input
                  type="password"
                  value={inviteForm.passwordConfirm}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, passwordConfirm: e.target.value }))}
                  placeholder="確認のため再入力してください"
                  minLength={12}
                  required
                />
              </div>
            </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                    <FontAwesomeIcon icon={faUserPlus} />
                    {inviteLoading ? '作成中...' : 'アカウントを作成'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* ユーザー一覧タブ */}
        {activeTab === 'users' && (
          <div className="tab-content">
            <section className="admin-section">
          <div className="section-header">
            <h2 className="section-title">
              <FontAwesomeIcon icon={faUsersGear} />
              ユーザー管理
            </h2>
            <div className="section-meta">
              <span className="total-indicator">
                <FontAwesomeIcon icon={faListOl} />
                総ユーザー数
                <strong>{total}</strong>
              </span>
              <button className="btn btn-secondary" onClick={() => fetchUsers()} disabled={loading}>
                <FontAwesomeIcon icon={faSync} />
                再読み込み
              </button>
            </div>
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
              <div className="filter-field">
                <label>所属地</label>
                <select
                  value={filters.location}
                  onChange={(e) => {
                    setPage(1)
                    setFilters((prev) => ({ ...prev, location: e.target.value }))
                  }}
                >
                  <option value="">すべて</option>
                  {locationOptions.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                      {!location.is_active ? '（停止中）' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {editingUser && (
            <div className="modal-overlay" onClick={() => setEditingUser(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>
                    <FontAwesomeIcon icon={faEdit} />
                    ユーザー編集 - {editingUser.display_name || editingUser.email}
                  </h3>
                  <button
                    className="modal-close"
                    onClick={() => setEditingUser(null)}
                    title="閉じる"
                    type="button"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
                <div className="modal-body">
                  <form className="modal-form" onSubmit={handleEditSubmit}>
                    <div className="form-grid">
                      <div className="form-field">
                        <label>
                          <FontAwesomeIcon icon={faUserShield} />
                          表示名
                        </label>
                        <input
                          type="text"
                          value={editForm.display_name}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, display_name: e.target.value }))}
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
                        <label>
                          <FontAwesomeIcon icon={faUsersGear} />
                          所属チーム
                        </label>
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
                        <label>
                          <FontAwesomeIcon icon={faMapMarkerAlt} />
                          所属地
                        </label>
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
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditingUser(null)}
                        disabled={savingEdit}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                        キャンセル
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                        <FontAwesomeIcon icon={faCheck} />
                        {savingEdit ? '保存中...' : '変更を保存'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
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
        )}

        {/* 設定タブ */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            {/* サブタブナビゲーション */}
            <nav className="sub-tabs">
              <button
                className={`sub-tab ${settingsSubTab === 'locations' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('locations')}
              >
                <FontAwesomeIcon icon={faMapMarkerAlt} />
                <span>所属地管理</span>
              </button>
              <button
                className={`sub-tab ${settingsSubTab === 'teams' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('teams')}
              >
                <FontAwesomeIcon icon={faUsersGear} />
                <span>所属チーム管理</span>
              </button>
            </nav>

            {teamError && (
              <div className="admin-alert admin-alert-error">
                <FontAwesomeIcon icon={faTimes} />
                <span>{teamError}</span>
              </div>
            )}
            {teamInfo && (
              <div className="admin-alert admin-alert-success">
                <FontAwesomeIcon icon={faCheck} />
                <span>{teamInfo}</span>
              </div>
            )}
            {locationInfo && (
              <div className="admin-alert admin-alert-success">
                <FontAwesomeIcon icon={faCheck} />
                <span>{locationInfo}</span>
              </div>
            )}

            {/* 所属地スロット管理サブタブ */}
            {settingsSubTab === 'locations' && (
              <>
                <section className="admin-section">
              <h2 className="section-title">
                <FontAwesomeIcon icon={faPlus} />
                所属地を追加
              </h2>
              <form className="invite-form" onSubmit={handleLocationSubmit}>
                <div className="form-grid">
                  <div className="form-field">
                    <label>
                      <FontAwesomeIcon icon={faMapMarkerAlt} />
                      名称
                    </label>
                    <input
                      type="text"
                      value={locationForm.name}
                      onChange={(e) => setLocationForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="例: 東京本社"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label>説明</label>
                    <input
                      type="text"
                      value={locationForm.description}
                      onChange={(e) => setLocationForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="例: 東京本社ビル 17F"
                    />
                  </div>

                  <div className="form-field">
                    <label>
                      <FontAwesomeIcon icon={faListOl} />
                      表示順
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={locationForm.sort_order}
                      onChange={(e) => setLocationForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                    />
                  </div>

                  <div className="form-field">
                    <label>ステータス</label>
                    <div className="toggle-switch-wrapper">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={locationForm.is_active}
                          onChange={(e) => setLocationForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                      <span className={`toggle-status ${locationForm.is_active ? 'active' : 'inactive'}`}>
                        {locationForm.is_active ? '有効' : '無効'}
                      </span>
                    </div>
                    <p className="field-help">無効にすると選択肢から除外されます</p>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={locationSaving}>
                    <FontAwesomeIcon icon={faPlus} />
                    {locationSaving ? '作成中...' : '追加する'}
                  </button>
                </div>
              </form>
            </section>

            {/* Location edit modal */}
            {editingLocation && (
              <div className="modal-overlay" onClick={() => setEditingLocation(null)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>
                      <FontAwesomeIcon icon={faEdit} />
                      所属地編集 - {editingLocation.name}
                    </h3>
                    <button
                      className="modal-close"
                      onClick={() => setEditingLocation(null)}
                      title="閉じる"
                      type="button"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                  <div className="modal-body">
                    <form className="modal-form" onSubmit={handleEditLocationSubmit}>
                      <div className="form-grid">
                        <div className="form-field">
                          <label>
                            <FontAwesomeIcon icon={faMapMarkerAlt} />
                            名称
                          </label>
                          <input
                            type="text"
                            value={editLocationForm.name}
                            onChange={(e) => setEditLocationForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="例: 東京本社"
                            required
                          />
                        </div>

                        <div className="form-field">
                          <label>説明</label>
                          <input
                            type="text"
                            value={editLocationForm.description}
                            onChange={(e) => setEditLocationForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="例: 東京本社ビル 17F"
                          />
                        </div>

                        <div className="form-field">
                          <label>
                            <FontAwesomeIcon icon={faListOl} />
                            表示順
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            value={editLocationForm.sort_order}
                            onChange={(e) => setEditLocationForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                          />
                        </div>

                        <div className="form-field">
                          <label>ステータス</label>
                          <div className="toggle-switch-wrapper">
                            <label className="toggle-switch">
                              <input
                                type="checkbox"
                                checked={editLocationForm.is_active}
                                onChange={(e) =>
                                  setEditLocationForm((prev) => ({ ...prev, is_active: e.target.checked }))
                                }
                              />
                              <span className="toggle-slider"></span>
                            </label>
                            <span className={`toggle-status ${editLocationForm.is_active ? 'active' : 'inactive'}`}>
                              {editLocationForm.is_active ? '有効' : '無効'}
                            </span>
                          </div>
                          <p className="field-help">無効にすると選択肢から除外されます</p>
                        </div>
                      </div>
                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setEditingLocation(null)}
                          disabled={locationSaving}
                        >
                          <FontAwesomeIcon icon={faTimes} />
                          キャンセル
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={locationSaving}>
                          <FontAwesomeIcon icon={faCheck} />
                          {locationSaving ? '保存中...' : '変更を保存'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* 所属地一覧 */}
            <section className="admin-section">
              <div className="section-header">
                <h2 className="section-title">
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                  所属地一覧
                </h2>
                <div className="slot-summary">
                  <span>有効拠点: {activeLocations.length}</span>
                  <span>全拠点: {locations.length}</span>
                </div>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>説明</th>
                      <th>表示順</th>
                      <th>状態</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="table-loading">
                          読み込み中...
                        </td>
                      </tr>
                    ) : locations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="table-empty">
                          所属地がまだ登録されていません
                        </td>
                      </tr>
                    ) : (
                      locations.map((location) => (
                        <tr key={location.id} className={!location.is_active ? 'slot-inactive' : undefined}>
                          <td>{location.name}</td>
                          <td>{location.description || '—'}</td>
                          <td>{location.sort_order}</td>
                          <td>
                            <span className={`status-badge ${location.is_active ? 'badge-active' : 'badge-disabled'}`}>
                              {location.is_active ? '有効' : '無効'}
                            </span>
                          </td>
                          <td className="table-actions">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleLocationEdit(location)}
                              disabled={locationSaving}
                            >
                              <FontAwesomeIcon icon={faEdit} />
                              編集
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleLocationToggle(location)}
                              disabled={locationSaving}
                            >
                              <FontAwesomeIcon icon={location.is_active ? faToggleOff : faToggleOn} />
                              {location.is_active ? '無効化' : '有効化'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
              </>
            )}

            {/* 所属チーム管理サブタブ */}
            {settingsSubTab === 'teams' && (
              <>
                <section className="admin-section">
              <h2 className="section-title">
                <FontAwesomeIcon icon={faPlus} />
                所属チームを追加
              </h2>
              <form className="invite-form" onSubmit={handleTeamSubmit}>
                <div className="form-grid team-grid">
                  <div className="form-field">
                    <label>
                      <FontAwesomeIcon icon={faUsersGear} />
                      チーム名
                    </label>
                    <input
                      type="text"
                      value={teamForm.name}
                      onChange={(e) => setTeamForm({ name: e.target.value })}
                      placeholder="例: 北海道支部"
                      required
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={teamSaving}>
                    <FontAwesomeIcon icon={faPlus} />
                    {teamSaving ? '作成中...' : '追加する'}
                  </button>
                </div>
              </form>
            </section>

            {/* Team edit modal */}
            {editingTeam && (
              <div className="modal-overlay" onClick={() => setEditingTeam(null)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>
                      <FontAwesomeIcon icon={faEdit} />
                      所属チーム編集 - {editingTeam.name}
                    </h3>
                    <button
                      className="modal-close"
                      onClick={() => setEditingTeam(null)}
                      title="閉じる"
                      type="button"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                  <div className="modal-body">
                    <form className="modal-form" onSubmit={handleEditTeamSubmit}>
                      <div className="form-grid team-grid">
                        <div className="form-field">
                          <label>
                            <FontAwesomeIcon icon={faUsersGear} />
                            チーム名
                          </label>
                          <input
                            type="text"
                            value={editTeamForm.name}
                            onChange={(e) => setEditTeamForm({ name: e.target.value })}
                            placeholder="例: 北海道支部"
                            required
                          />
                        </div>
                      </div>
                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setEditingTeam(null)}
                          disabled={teamSaving}
                        >
                          <FontAwesomeIcon icon={faTimes} />
                          キャンセル
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={teamSaving}>
                          <FontAwesomeIcon icon={faCheck} />
                          {teamSaving ? '保存中...' : '変更を保存'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* 所属チーム一覧 */}
            <section className="admin-section">
              <div className="section-header">
                <h2 className="section-title">
                  <FontAwesomeIcon icon={faUsersGear} />
                  所属チーム一覧
                </h2>
                <div className="slot-summary">
                  <span>登録済み: {teams.length}</span>
                </div>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>作成日</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="table-loading">
                          読み込み中...
                        </td>
                      </tr>
                    ) : teams.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="table-empty">
                          所属チームがまだ登録されていません
                        </td>
                      </tr>
                    ) : (
                      teams.map((team) => (
                        <tr key={team.id}>
                          <td>{team.name}</td>
                          <td>{team.created_at ? new Date(team.created_at).toLocaleString('ja-JP') : '—'}</td>
                          <td className="table-actions">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleTeamEdit(team)}
                              disabled={teamSaving}
                            >
                              <FontAwesomeIcon icon={faEdit} />
                              編集
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
              </>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
