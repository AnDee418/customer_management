'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faEdit,
  faTrash,
  faFileInvoice,
  faRuler,
  faUser,
  faExternalLinkAlt
} from '@fortawesome/free-solid-svg-icons'
import { getOrderDetailUrl, getMeasurementDetailUrl, openExternalSystem } from '@/lib/utils/externalLinks'
import { useCustomerRealtime } from '@/lib/hooks/useRealtimeSubscription'
import '../customers.css'
import './detail.css'

type CustomerType = '顧客' | 'スタッフ' | 'サポート' | '社員' | '代理店' | 'その他'

interface Customer {
  id: string
  name: string
  name_kana: string | null
  code: string | null
  type: CustomerType
  gender: string | null
  contact: string
  postal_code: string | null
  prefecture: string | null
  city: string | null
  address_line1: string | null
  address_line2: string | null
  age: number | null
  weight_kg: number | null
  usual_shoe_size: string | null
  foot_length_right_cm: number | null
  foot_length_left_cm: number | null
  foot_width_right_cm: number | null
  foot_width_left_cm: number | null
  foot_arch_right_cm: number | null
  foot_arch_left_cm: number | null
  medical_conditions: string[] | null
  created_at: string
  updated_at: string
}

interface Order {
  id: string
  external_order_id: string
  title: string | null
  status: string | null
  ordered_at: string | null
  created_at: string
}

interface Measurement {
  id: string
  external_measurement_id: string
  summary: any
  measured_at: string | null
  created_at: string
}

type TabType = 'info' | 'orders' | 'measurements'

export default function CustomerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const customerId = params?.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('info')

  // リアルタイム更新の購読
  const { isSubscribed } = useCustomerRealtime(customerId, {
    onUpdate: (updatedCustomer) => {
      setCustomer(updatedCustomer)
    },
    onDelete: () => {
      alert('この顧客は削除されました')
      router.push('/customers')
    },
  })

  useEffect(() => {
    if (customerId) {
      fetchCustomerData()
    }
  }, [customerId])

  const fetchCustomerData = async () => {
    try {
      setLoading(true)

      // 顧客情報取得
      const customerResponse = await fetch(`/api/customers/${customerId}`, {
        headers: { 'Cache-Control': 'no-store' }
      })

      if (!customerResponse.ok) {
        throw new Error('顧客情報の取得に失敗しました')
      }

      const customerData = await customerResponse.json()
      setCustomer(customerData)

      // 発注情報取得
      const ordersResponse = await fetch(`/api/orders?customer_id=${customerId}`, {
        headers: { 'Cache-Control': 'no-store' }
      })

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        setOrders(ordersData.data || [])
      }

      // 測定情報取得
      const measurementsResponse = await fetch(`/api/measurements?customer_id=${customerId}`, {
        headers: { 'Cache-Control': 'no-store' }
      })

      if (measurementsResponse.ok) {
        const measurementsData = await measurementsResponse.json()
        setMeasurements(measurementsData.data || [])
      }
    } catch (error) {
      console.error('Error fetching customer data:', error)
      alert('顧客情報の取得に失敗しました')
      router.push('/customers')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!customer) return

    if (!confirm(`「${customer.name}」を削除してもよろしいですか？`)) {
      return
    }

    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-store' }
      })

      if (!response.ok) {
        throw new Error('削除に失敗しました')
      }

      alert('削除しました')
      router.push('/customers')
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('削除に失敗しました')
    }
  }

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

  if (loading) {
    return (
      <AppLayout>
        <div className="page-content">
          <div className="loading-state">
            <p>読み込み中...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!customer) {
    return (
      <AppLayout>
        <div className="page-content">
          <div className="empty-state">
            <p>顧客が見つかりませんでした</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="page-content">
        {/* ヘッダー */}
        <div className="page-header">
          <div className="header-title-group">
            <button
              className="btn-icon btn-back"
              onClick={() => router.push('/customers')}
              title="戻る"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <div className="title-wrapper">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                <h1 className="page-title">{customer.name}</h1>
                <span className={`badge ${getTypeBadgeClass(customer.type)}`}>
                  {customer.type}
                </span>
                {isSubscribed && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--success)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                    title="リアルタイム更新が有効です"
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--success)',
                        display: 'inline-block',
                      }}
                    />
                    リアルタイム
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="btn btn-secondary"
              onClick={() => router.push(`/customers/${customerId}/edit`)}
            >
              <FontAwesomeIcon icon={faEdit} />
              編集
            </button>
            <button
              className="btn btn-danger"
              onClick={handleDelete}
            >
              <FontAwesomeIcon icon={faTrash} />
              削除
            </button>
          </div>
        </div>

      {/* タブナビゲーション */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <FontAwesomeIcon icon={faUser} />
          基本情報
        </button>
        <button
          className={`tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <FontAwesomeIcon icon={faFileInvoice} />
          発注履歴
          {orders.length > 0 && <span className="tab-badge">{orders.length}</span>}
        </button>
        <button
          className={`tab ${activeTab === 'measurements' ? 'active' : ''}`}
          onClick={() => setActiveTab('measurements')}
        >
          <FontAwesomeIcon icon={faRuler} />
          測定データ
          {measurements.length > 0 && <span className="tab-badge">{measurements.length}</span>}
        </button>
      </div>

      {/* タブコンテンツ */}
      <div className="tab-content">
        {activeTab === 'info' && (
          <div className="detail-sections">
            {/* 基本情報 */}
            <div className="detail-section">
              <h2 className="section-title">基本情報</h2>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">顧客名</span>
                  <span className="detail-value">{customer.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">フリガナ</span>
                  <span className="detail-value">{customer.name_kana || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">顧客コード</span>
                  <span className="detail-value">{customer.code || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">タイプ</span>
                  <span className="detail-value">
                    <span className={`badge ${getTypeBadgeClass(customer.type)}`}>
                      {customer.type}
                    </span>
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">性別</span>
                  <span className="detail-value">{customer.gender || '-'}</span>
                </div>
                <div className="detail-item full-width">
                  <span className="detail-label">連絡先</span>
                  <span className="detail-value">{customer.contact}</span>
                </div>
              </div>
            </div>

            {/* 住所情報 */}
            {(customer.postal_code || customer.prefecture || customer.city ||
              customer.address_line1 || customer.address_line2) && (
              <div className="detail-section">
                <h2 className="section-title">住所情報</h2>
                <div className="detail-grid">
                  {customer.postal_code && (
                    <div className="detail-item">
                      <span className="detail-label">郵便番号</span>
                      <span className="detail-value">{customer.postal_code}</span>
                    </div>
                  )}
                  {customer.prefecture && (
                    <div className="detail-item">
                      <span className="detail-label">都道府県</span>
                      <span className="detail-value">{customer.prefecture}</span>
                    </div>
                  )}
                  {customer.city && (
                    <div className="detail-item full-width">
                      <span className="detail-label">市区町村</span>
                      <span className="detail-value">{customer.city}</span>
                    </div>
                  )}
                  {customer.address_line1 && (
                    <div className="detail-item full-width">
                      <span className="detail-label">番地・丁目</span>
                      <span className="detail-value">{customer.address_line1}</span>
                    </div>
                  )}
                  {customer.address_line2 && (
                    <div className="detail-item full-width">
                      <span className="detail-label">建物名・部屋番号</span>
                      <span className="detail-value">{customer.address_line2}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 身体情報 */}
            {(customer.age || customer.weight_kg || customer.usual_shoe_size) && (
              <div className="detail-section">
                <h2 className="section-title">身体情報</h2>
                <div className="detail-grid">
                  {customer.age && (
                    <div className="detail-item">
                      <span className="detail-label">年齢</span>
                      <span className="detail-value">{customer.age}歳</span>
                    </div>
                  )}
                  {customer.weight_kg && (
                    <div className="detail-item">
                      <span className="detail-label">体重</span>
                      <span className="detail-value">{customer.weight_kg}kg</span>
                    </div>
                  )}
                  {customer.usual_shoe_size && (
                    <div className="detail-item">
                      <span className="detail-label">普段の靴サイズ</span>
                      <span className="detail-value">{customer.usual_shoe_size}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 足のサイズ */}
            {(customer.foot_length_right_cm || customer.foot_length_left_cm || 
              customer.foot_width_right_cm || customer.foot_width_left_cm ||
              customer.foot_arch_right_cm || customer.foot_arch_left_cm) && (
              <div className="detail-section">
                <h2 className="section-title">足のサイズ</h2>
                <div className="detail-grid">
                  {customer.foot_length_right_cm && (
                    <div className="detail-item">
                      <span className="detail-label">足の長さ（右）</span>
                      <span className="detail-value">{customer.foot_length_right_cm}cm</span>
                    </div>
                  )}
                  {customer.foot_length_left_cm && (
                    <div className="detail-item">
                      <span className="detail-label">足の長さ（左）</span>
                      <span className="detail-value">{customer.foot_length_left_cm}cm</span>
                    </div>
                  )}
                  {customer.foot_width_right_cm && (
                    <div className="detail-item">
                      <span className="detail-label">足の幅（右）</span>
                      <span className="detail-value">{customer.foot_width_right_cm}cm</span>
                    </div>
                  )}
                  {customer.foot_width_left_cm && (
                    <div className="detail-item">
                      <span className="detail-label">足の幅（左）</span>
                      <span className="detail-value">{customer.foot_width_left_cm}cm</span>
                    </div>
                  )}
                  {customer.foot_arch_right_cm && (
                    <div className="detail-item">
                      <span className="detail-label">足のアーチ（右）</span>
                      <span className="detail-value">{customer.foot_arch_right_cm}cm</span>
                    </div>
                  )}
                  {customer.foot_arch_left_cm && (
                    <div className="detail-item">
                      <span className="detail-label">足のアーチ（左）</span>
                      <span className="detail-value">{customer.foot_arch_left_cm}cm</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 健康情報 */}
            {customer.medical_conditions && customer.medical_conditions.length > 0 && (
              <div className="detail-section">
                <h2 className="section-title">持病・症状</h2>
                <div className="tags">
                  {customer.medical_conditions.map((condition, index) => (
                    <span key={index} className="tag">{condition}</span>
                  ))}
                </div>
              </div>
            )}

            {/* メタ情報 */}
            <div className="detail-section">
              <h2 className="section-title">登録情報</h2>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">登録日時</span>
                  <span className="detail-value">
                    {new Date(customer.created_at).toLocaleString('ja-JP')}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">更新日時</span>
                  <span className="detail-value">
                    {new Date(customer.updated_at).toLocaleString('ja-JP')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="data-list">
            {orders.length === 0 ? (
              <div className="empty-state">
                <p>発注履歴がありません</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>外部発注ID</th>
                    <th>タイトル</th>
                    <th>ステータス</th>
                    <th>発注日</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td className="mono-text">{order.external_order_id}</td>
                      <td>{order.title || '-'}</td>
                      <td>
                        <span className="badge badge-info">{order.status || '不明'}</span>
                      </td>
                      <td>
                        {order.ordered_at
                          ? new Date(order.ordered_at).toLocaleDateString('ja-JP')
                          : '-'}
                      </td>
                      <td>
                        <button
                          className="btn-link"
                          onClick={() => openExternalSystem(getOrderDetailUrl(order.external_order_id))}
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} />
                          外部システムで開く
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'measurements' && (
          <div className="data-list">
            {measurements.length === 0 ? (
              <div className="empty-state">
                <p>測定データがありません</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>外部測定ID</th>
                    <th>測定日</th>
                    <th>登録日</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map(measurement => (
                    <tr key={measurement.id}>
                      <td className="mono-text">{measurement.external_measurement_id}</td>
                      <td>
                        {measurement.measured_at 
                          ? new Date(measurement.measured_at).toLocaleDateString('ja-JP')
                          : '-'}
                      </td>
                      <td>
                        {new Date(measurement.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td>
                        <button
                          className="btn-link"
                          onClick={() => openExternalSystem(getMeasurementDetailUrl(measurement.external_measurement_id))}
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} />
                          外部システムで開く
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      </div>
    </AppLayout>
  )
}

