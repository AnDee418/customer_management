'use client'

import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus,
  faSave,
  faUndo,
  faToggleOn,
  faToggleOff,
  faMapMarkerAlt,
  faListOl,
  faUsersGear,
} from '@fortawesome/free-solid-svg-icons'
import './settings.css'

type LocationSlot = {
  id: string
  code: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type Team = {
  id: string
  name: string
  created_at: string
}

type FormState = {
  code: string
  name: string
  description: string
  sort_order: string
  is_active: boolean
}

const initialForm: FormState = {
  code: '',
  name: '',
  description: '',
  sort_order: '100',
  is_active: true,
}

const initialTeamForm = {
  name: '',
}

export default function SettingsPage() {
  const [slots, setSlots] = useState<LocationSlot[]>([])
  const [form, setForm] = useState<FormState>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [teamForm, setTeamForm] = useState(initialTeamForm)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamLoading, setTeamLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [teamSaving, setTeamSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [teamInfo, setTeamInfo] = useState<string | null>(null)

  const activeSlots = useMemo(() => slots.filter((slot) => slot.is_active), [slots])

  useEffect(() => {
    fetchSlots()
    fetchTeams()
  }, [])

  const fetchSlots = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/settings/location-slots', {
        headers: { 'Cache-Control': 'no-store' },
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error('管理者権限が必要です')
        }
        throw new Error(detail.error || '所属地スロットの取得に失敗しました')
      }

      const result = await response.json()
      setSlots(result.data || [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : '所属地スロットの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm(initialForm)
    setEditingId(null)
  }

  const fetchTeams = async () => {
    setTeamLoading(true)
    setTeamError(null)
    try {
      const response = await fetch('/api/settings/teams', {
        headers: { 'Cache-Control': 'no-store' },
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error('管理者権限が必要です')
        }
        throw new Error(detail.error || '所属チームの取得に失敗しました')
      }

      const result = await response.json()
      setTeams(result.data || [])
    } catch (err) {
      console.error(err)
      setTeamError(err instanceof Error ? err.message : '所属チームの取得に失敗しました')
    } finally {
      setTeamLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setInfo(null)

    try {
      if (!form.code.trim() || !form.name.trim()) {
        throw new Error('コードと名称は必須です')
      }

      const numericSort = Number(form.sort_order || '0')
      if (Number.isNaN(numericSort)) {
        throw new Error('表示順は数値で入力してください')
      }

      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        sort_order: numericSort,
        is_active: form.is_active,
      }

      let response: Response
      if (editingId) {
        const diff: Record<string, any> = {}
        const current = slots.find((slot) => slot.id === editingId)
        if (!current) {
          throw new Error('編集中の所属地が見つかりませんでした')
        }

        if (payload.name !== current.name) diff.name = payload.name
        if ((payload.description || null) !== (current.description || null)) diff.description = payload.description
        if (payload.sort_order !== current.sort_order) diff.sort_order = payload.sort_order
        if (payload.is_active !== current.is_active) diff.is_active = payload.is_active

        if (Object.keys(diff).length === 0) {
          setInfo('変更点はありません')
          setSaving(false)
          return
        }

        response = await fetch(`/api/settings/location-slots/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(diff),
        })
      } else {
        response = await fetch('/api/settings/location-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error('管理者権限が必要です')
        }
        throw new Error(detail.error || '所属地スロットの保存に失敗しました')
      }

      resetForm()
      await fetchSlots()
      setInfo('所属地スロットを保存しました')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : '所属地スロットの保存に失敗しました')
    } finally {
      setSaving(false)
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

      let response: Response
      if (editingTeamId) {
        const current = teams.find((team) => team.id === editingTeamId)
        if (!current) {
          throw new Error('編集中の所属チームが見つかりませんでした')
        }

        if (payload.name === current.name) {
          setTeamInfo('変更点はありません')
          setTeamSaving(false)
          return
        }

        response = await fetch(`/api/settings/teams/${editingTeamId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch('/api/settings/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error('管理者権限が必要です')
        }
        throw new Error(detail.error || '所属チームの保存に失敗しました')
      }

      resetTeamForm()
      await fetchTeams()
      setTeamInfo('所属チームを保存しました')
    } catch (err) {
      console.error(err)
      setTeamError(err instanceof Error ? err.message : '所属チームの保存に失敗しました')
    } finally {
      setTeamSaving(false)
    }
  }

  const handleEdit = (slot: LocationSlot) => {
    setEditingId(slot.id)
    setForm({
      code: slot.code,
      name: slot.name,
      description: slot.description ?? '',
      sort_order: String(slot.sort_order),
      is_active: slot.is_active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleTeamEdit = (team: Team) => {
    setEditingTeamId(team.id)
    setTeamForm({ name: team.name })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToggle = async (slot: LocationSlot) => {
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(`/api/settings/location-slots/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !slot.is_active }),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error('管理者権限が必要です')
        }
        throw new Error(detail.error || 'ステータスの更新に失敗しました')
      }

      await fetchSlots()
      setInfo('ステータスを更新しました')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'ステータスの更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const resetTeamForm = () => {
    setTeamForm(initialTeamForm)
    setEditingTeamId(null)
  }

  return (
    <AppLayout>
      <div className="page-content settings-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
            所属地設定
          </h1>
          <p className="page-subtitle">所属チームに紐づく拠点マスタを管理します</p>
        </div>
      </div>

        {error && (
          <div className="settings-alert settings-alert-error">
            {error}
          </div>
        )}

        {info && (
          <div className="settings-alert settings-alert-info">
            {info}
          </div>
        )}

        <section className="settings-section">
          <h2 className="section-title">
            <FontAwesomeIcon icon={editingId ? faSave : faPlus} />
            {editingId ? '所属地を編集' : '所属地を追加'}
          </h2>
          <form className="location-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>コード</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="例: TOKYO_HQ"
                  maxLength={40}
                  required
                  disabled={!!editingId}
                />
                <p className="field-help">大文字英数字・ハイフン・アンダースコアのみ</p>
              </div>

              <div className="form-field">
                <label>名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例: 東京本社"
                  required
                />
              </div>

              <div className="form-field">
                <label>説明</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
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
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                />
              </div>

              <div className="form-field toggle-field">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  有効
                </label>
                <p className="field-help">無効にすると選択肢から除外されます</p>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <FontAwesomeIcon icon={faSave} />
                {saving ? '保存中...' : '保存する'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                  disabled={saving}
                >
                  <FontAwesomeIcon icon={faUndo} />
                  キャンセル
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="settings-section">
          <div className="section-header">
            <h2 className="section-title">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
              所属地一覧
            </h2>
            <div className="slot-summary">
              <span>有効拠点: {activeSlots.length}</span>
              <span>全拠点: {slots.length}</span>
            </div>
          </div>

          <div className="settings-table-wrapper">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>コード</th>
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
                    <td colSpan={6} className="table-placeholder">
                      読み込み中...
                    </td>
                  </tr>
                ) : slots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-placeholder">
                      所属地がまだ登録されていません
                    </td>
                  </tr>
                ) : (
                  slots.map((slot) => (
                    <tr key={slot.id} className={!slot.is_active ? 'slot-inactive' : undefined}>
                      <td>{slot.code}</td>
                      <td>{slot.name}</td>
                      <td>{slot.description || '—'}</td>
                      <td>{slot.sort_order}</td>
                      <td>
                        <span className={`status-pill ${slot.is_active ? 'status-active' : 'status-inactive'}`}>
                          {slot.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="table-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEdit(slot)}
                          disabled={saving}
                        >
                          編集
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggle(slot)}
                          disabled={saving}
                        >
                          <FontAwesomeIcon icon={slot.is_active ? faToggleOff : faToggleOn} />
                          {slot.is_active ? '無効化' : '有効化'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="section-title">
            <FontAwesomeIcon icon={faUsersGear} />
            {editingTeamId ? '所属チームを編集' : '所属チームを追加'}
          </h2>
          {teamError && <div className="settings-alert settings-alert-error">{teamError}</div>}
          {teamInfo && <div className="settings-alert settings-alert-info">{teamInfo}</div>}

          <form className="team-form" onSubmit={handleTeamSubmit}>
            <div className="form-grid team-grid">
              <div className="form-field">
                <label>チーム名</label>
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
                <FontAwesomeIcon icon={faSave} />
                {teamSaving ? '保存中...' : '保存する'}
              </button>
              {editingTeamId && (
                <button type="button" className="btn btn-secondary" onClick={resetTeamForm} disabled={teamSaving}>
                  <FontAwesomeIcon icon={faUndo} />
                  キャンセル
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="settings-section">
          <div className="section-header">
            <h2 className="section-title">
              <FontAwesomeIcon icon={faUsersGear} />
              所属チーム一覧
            </h2>
            <div className="slot-summary">
              <span>登録済み: {teams.length}</span>
            </div>
          </div>

          <div className="settings-table-wrapper">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>作成日</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {teamLoading ? (
                  <tr>
                    <td colSpan={3} className="table-placeholder">
                      読み込み中...
                    </td>
                  </tr>
                ) : teams.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-placeholder">
                      所属チームがまだ登録されていません
                    </td>
                  </tr>
                ) : (
                  teams.map((team) => (
                    <tr key={team.id}>
                      <td>{team.name}</td>
                      <td>{new Date(team.created_at).toLocaleString('ja-JP')}</td>
                      <td className="table-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => handleTeamEdit(team)} disabled={teamSaving}>
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
      </div>
    </AppLayout>
  )
}
