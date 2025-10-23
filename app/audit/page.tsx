'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFileAlt,
  faFilter,
  faSync,
  faCalendarAlt,
  faUser,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons'
import './audit.css'

type AuditLog = {
  id: string
  actor_user_id: string | null
  actor_email: string | null
  actor_display_name: string | null
  actor_location_id: string | null
  entity: string
  entity_id: string | null
  action: string
  diff: any
  created_at: string
}

const actionLabels: Record<string, { label: string; className: string }> = {
  create: { label: '作成', className: 'action-create' },
  update: { label: '更新', className: 'action-update' },
  delete: { label: '削除', className: 'action-delete' },
  restore: { label: '復元', className: 'action-restore' },
  sync: { label: '同期', className: 'action-sync' },
  retry: { label: '再試行', className: 'action-retry' },
  login: { label: 'ログイン', className: 'action-login' },
  permission_change: { label: '権限変更', className: 'action-permission' },
}

const entityLabels: Record<string, string> = {
  customer: '顧客',
  user: 'ユーザー',
  team: 'チーム',
  location: '所属地',
  order: '注文',
  measurement: '測定',
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    search: '',
    entity: '',
    action: '',
    from_date: '',
    to_date: '',
  })
  const [searchInput, setSearchInput] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('per_page', perPage.toString())
      if (filters.search) params.set('search', filters.search)
      if (filters.entity) params.set('entity', filters.entity)
      if (filters.action) params.set('action', filters.action)
      if (filters.from_date) params.set('from_date', filters.from_date)
      if (filters.to_date) params.set('to_date', filters.to_date)

      const response = await fetch(`/api/audit/logs?${params.toString()}`, {
        headers: { 'Cache-Control': 'no-store' },
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
          throw new Error(detail.error || 'この機能にアクセスする権限がありません')
        }
        throw new Error(detail.error || '監査ログの取得に失敗しました')
      }

      const result = await response.json()
      setLogs(result.data || [])
      setTotal(result.total || 0)
      setPerPage(result.per_page || 50)
      setUserRole(result.user_role || null)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : '監査ログの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [filters, page, perPage])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage])

  return (
    <AppLayout>
      <div className="page-content audit-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <FontAwesomeIcon icon={faFileAlt} />
              監査ログ
            </h1>
            <p className="page-subtitle">
              {userRole === 'admin'
                ? 'すべての操作履歴を確認できます'
                : 'あなたの所属地のユーザーの操作履歴を確認できます'}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => fetchLogs()} disabled={loading}>
            <FontAwesomeIcon icon={faSync} />
            再読み込み
          </button>
        </div>

        {error && (
          <div className="audit-alert audit-alert-error">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <span>{error}</span>
          </div>
        )}

        {/* フィルターバー */}
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
                <FontAwesomeIcon icon={faUser} />
                ユーザー検索
              </label>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="メールアドレスまたは表示名で検索"
              />
            </div>
            <button type="submit" className="btn btn-secondary">
              検索
            </button>
          </form>

          <div className="filter-controls">
            <div className="filter-field">
              <label>エンティティ</label>
              <select
                value={filters.entity}
                onChange={(e) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, entity: e.target.value }))
                }}
              >
                <option value="">すべて</option>
                {Object.entries(entityLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>アクション</label>
              <select
                value={filters.action}
                onChange={(e) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, action: e.target.value }))
                }}
              >
                <option value="">すべて</option>
                {Object.entries(actionLabels).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>
                <FontAwesomeIcon icon={faCalendarAlt} />
                開始日
              </label>
              <input
                type="date"
                value={filters.from_date}
                onChange={(e) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, from_date: e.target.value }))
                }}
              />
            </div>

            <div className="filter-field">
              <label>
                <FontAwesomeIcon icon={faCalendarAlt} />
                終了日
              </label>
              <input
                type="date"
                value={filters.to_date}
                onChange={(e) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, to_date: e.target.value }))
                }}
              />
            </div>
          </div>
        </div>

        {/* ログテーブル */}
        <section className="audit-section">
          <div className="section-header">
            <h2 className="section-title">
              <FontAwesomeIcon icon={faFileAlt} />
              操作履歴
            </h2>
            <div className="log-summary">
              <span>全 {total} 件</span>
            </div>
          </div>

          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>ユーザー</th>
                  <th>エンティティ</th>
                  <th>アクション</th>
                  <th>詳細</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="table-loading">
                      読み込み中...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      条件に一致するログが見つかりません
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const actionMeta = actionLabels[log.action] || {
                      label: log.action,
                      className: 'action-default',
                    }
                    const entityLabel = entityLabels[log.entity] || log.entity

                    return (
                      <tr key={log.id}>
                        <td>
                          <div className="cell-main">
                            <span className="cell-primary">
                              {new Date(log.created_at).toLocaleString('ja-JP')}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-main">
                            <span className="cell-primary">
                              {log.actor_display_name || log.actor_email || 'システム'}
                            </span>
                            {log.actor_email && log.actor_display_name && (
                              <span className="cell-secondary">{log.actor_email}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="entity-badge">{entityLabel}</span>
                        </td>
                        <td>
                          <span className={`action-badge ${actionMeta.className}`}>{actionMeta.label}</span>
                        </td>
                        <td>
                          <div className="log-details">
                            {log.entity_id && (
                              <div className="detail-item">
                                <span className="detail-label">ID:</span>
                                <span className="detail-value">{log.entity_id.slice(0, 8)}...</span>
                              </div>
                            )}
                            {log.diff && Object.keys(log.diff).length > 0 && (
                              <details className="diff-details">
                                <summary>変更内容</summary>
                                <pre>{JSON.stringify(log.diff, null, 2)}</pre>
                              </details>
                            )}
                          </div>
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
