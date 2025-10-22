'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus,
  faSearch,
  faFilter,
  faEdit,
  faTrash,
  faTimes,
  faMars,
  faVenus,
  faGenderless,
  faQuestion
} from '@fortawesome/free-solid-svg-icons'
import './customers.css'

// 顧客タイプの定義
type CustomerType = '顧客' | 'スタッフ' | 'サポート' | '社員' | '代理店' | 'その他'

interface Customer {
  id: string
  name: string
  code: string | null
  type: CustomerType
  gender: string | null
  contact: string
  address: string
  created_at: string
  updated_at: string
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<CustomerType | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)

  // 顧客データ取得
  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/customers', {
        headers: {
          'Cache-Control': 'no-store'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', errorData)
        throw new Error(errorData.error || '顧客データの取得に失敗しました')
      }

      const result = await response.json()
      setCustomers(result.data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      alert(`顧客データの取得に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setLoading(false)
    }
  }

  // フィルター処理
  const filteredCustomers = customers.filter(customer => {
    // 検索フィルター
    const matchesSearch = searchQuery === '' || 
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contact.toLowerCase().includes(searchQuery.toLowerCase())

    // タイプフィルター
    const matchesType = typeFilter === 'all' || customer.type === typeFilter

    return matchesSearch && matchesType
  })

  // タイプバッジの色
  const getTypeBadgeClass = (type: CustomerType) => {
    const typeMap: Record<CustomerType, string> = {
      '顧客': 'badge-customer',
      'スタッフ': 'badge-staff',
      'サポート': 'badge-support',
      '社員': 'badge-employee',
      '代理店': 'badge-agency',
      'その他': 'badge-other'
    }
    return typeMap[type] || 'badge-other'
  }

  // 性別アイコン
  const getGenderIcon = (gender: string | null) => {
    if (!gender) return { icon: faQuestion, color: 'var(--gray-400)', label: '未設定' }

    switch (gender) {
      case '男性':
        return { icon: faMars, color: '#3b82f6', label: '男性' }
      case '女性':
        return { icon: faVenus, color: '#ec4899', label: '女性' }
      case 'その他':
        return { icon: faGenderless, color: '#8b5cf6', label: 'その他' }
      case '未回答':
        return { icon: faQuestion, color: 'var(--gray-400)', label: '未回答' }
      default:
        return { icon: faQuestion, color: 'var(--gray-400)', label: '未設定' }
    }
  }

  // 削除処理
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除してもよろしいですか？`)) {
      return
    }

    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        headers: {
          'Cache-Control': 'no-store'
        }
      })

      if (!response.ok) {
        throw new Error('削除に失敗しました')
      }

      alert('削除しました')
      fetchCustomers() // リロード
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('削除に失敗しました')
    }
  }

  return (
    <AppLayout>
      <div className="page-content">
        {/* ヘッダー */}
        <div className="page-header">
          <div className="header-left">
            <h1 className="page-title">顧客管理</h1>
            <p className="page-subtitle">
              {filteredCustomers.length} 件の顧客
            </p>
          </div>
          <div className="header-right">
            <button 
              className="btn btn-primary"
              onClick={() => router.push('/customers/new')}
            >
              <FontAwesomeIcon icon={faPlus} />
              新規登録
            </button>
          </div>
        </div>

      {/* 検索・フィルターバー */}
      <div className="filters-bar">
        <div className="search-box">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="顧客名、コード、連絡先で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button 
              className="clear-btn"
              onClick={() => setSearchQuery('')}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>

        <button 
          className={`btn btn-secondary ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <FontAwesomeIcon icon={faFilter} />
          フィルター
        </button>
      </div>

      {/* フィルターパネル */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-group">
            <label className="filter-label">タイプ</label>
            <div className="filter-options">
              <button
                className={`filter-chip ${typeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                すべて
              </button>
              {(['顧客', 'スタッフ', 'サポート', '社員', '代理店', 'その他'] as CustomerType[]).map(type => (
                <button
                  key={type}
                  className={`filter-chip ${typeFilter === type ? 'active' : ''}`}
                  onClick={() => setTypeFilter(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 顧客テーブル */}
      <div className="table-container">
        {loading ? (
          <div className="loading-state">
            <p>読み込み中...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty-state">
            <p>顧客が見つかりませんでした</p>
            {searchQuery || typeFilter !== 'all' ? (
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setSearchQuery('')
                  setTypeFilter('all')
                }}
              >
                フィルターをクリア
              </button>
            ) : (
              <button 
                className="btn btn-primary"
                onClick={() => router.push('/customers/new')}
              >
                <FontAwesomeIcon icon={faPlus} />
                最初の顧客を登録
              </button>
            )}
          </div>
        ) : (
          <table className="customers-table">
            <thead>
              <tr>
                <th>顧客名</th>
                <th>コード</th>
                <th>タイプ</th>
                <th>連絡先</th>
                <th>登録日</th>
                <th className="actions-column">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr
                  key={customer.id}
                  onClick={() => router.push(`/customers/${customer.id}`)}
                  className="clickable-row"
                >
                  <td className="customer-name">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {(() => {
                        const genderInfo = getGenderIcon(customer.gender)
                        return (
                          <FontAwesomeIcon
                            icon={genderInfo.icon}
                            style={{ color: genderInfo.color }}
                            title={genderInfo.label}
                          />
                        )
                      })()}
                      {customer.name}
                    </div>
                  </td>
                  <td className="customer-code">{customer.code || '-'}</td>
                  <td>
                    <span className={`badge ${getTypeBadgeClass(customer.type)}`}>
                      {customer.type}
                    </span>
                  </td>
                  <td className="customer-contact">{customer.contact}</td>
                  <td className="customer-date">
                    {new Date(customer.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="actions-column">
                    <div className="action-buttons">
                      <button
                        className="btn-icon btn-edit"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/customers/${customer.id}/edit`)
                        }}
                        title="編集"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(customer.id, customer.name)
                        }}
                        title="削除"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </AppLayout>
  )
}

