'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faSave,
  faTimes,
  faSearch
} from '@fortawesome/free-solid-svg-icons'
import { searchAddressByPostalCode, formatPostalCode } from '@/lib/utils/postalCode'
import { normalizeKana, normalizeNumericInput, normalizeText } from '@/lib/utils/textNormalization'
import '../../customers.css'
import '../../new/new.css'

type CustomerType = '顧客' | 'スタッフ' | 'サポート' | '社員' | '代理店' | 'その他'
type Gender = '男性' | '女性' | 'その他' | '未回答'

interface CustomerFormData {
  name: string
  name_kana: string
  code: string
  type: CustomerType
  gender: Gender | ''
  contact: string
  postal_code: string
  prefecture: string
  city: string
  address_line1: string
  address_line2: string
  age: string
  weight_kg: string
  usual_shoe_size: string
  foot_length_right_cm: string
  foot_length_left_cm: string
  foot_width_right_cm: string
  foot_width_left_cm: string
  foot_arch_right_cm: string
  foot_arch_left_cm: string
  medical_conditions: string[]
  other_conditions: string
}

const medicalConditionsByCategory = {
  '肩・首': ['肩凝り', '首痛', '寝違え', '四十肩・五十肩'],
  '背中': ['背中の痛み', '猫背', '側弯症'],
  '腰': ['腰痛', '椎間板ヘルニア', 'ぎっくり腰'],
  '膝・足': ['膝痛', '半月板損傷', '外反母趾', '足底筋膜炎', '扁平足', '巻き爪', 'O脚・X脚']
}

export default function EditCustomerPage() {
  const router = useRouter()
  const params = useParams()
  const customerId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    name_kana: '',
    code: '',
    type: '顧客',
    gender: '',
    contact: '',
    postal_code: '',
    prefecture: '',
    city: '',
    address_line1: '',
    address_line2: '',
    age: '',
    weight_kg: '',
    usual_shoe_size: '',
    foot_length_right_cm: '',
    foot_length_left_cm: '',
    foot_width_right_cm: '',
    foot_width_left_cm: '',
    foot_arch_right_cm: '',
    foot_arch_left_cm: '',
    medical_conditions: [],
    other_conditions: ''
  })

  useEffect(() => {
    if (customerId) {
      fetchCustomer()
    }
  }, [customerId])

  const fetchCustomer = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/customers/${customerId}`, {
        headers: { 'Cache-Control': 'no-store' }
      })

      if (!response.ok) {
        throw new Error('顧客情報の取得に失敗しました')
      }

      const data = await response.json()
      
      // データをフォームにセット
      // medical_conditionsから「その他: 」で始まる項目を分離
      const conditions = data.medical_conditions || []
      const otherCondition = conditions.find((c: string) => c.startsWith('その他: '))
      const regularConditions = conditions.filter((c: string) => !c.startsWith('その他: '))

      setFormData({
        name: data.name || '',
        name_kana: data.name_kana || '',
        code: data.code || '',
        type: data.type || '顧客',
        gender: data.gender || '',
        contact: data.contact || '',
        postal_code: data.postal_code || '',
        prefecture: data.prefecture || '',
        city: data.city || '',
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        age: data.age?.toString() || '',
        weight_kg: data.weight_kg?.toString() || '',
        usual_shoe_size: data.usual_shoe_size || '',
        foot_length_right_cm: data.foot_length_right_cm?.toString() || '',
        foot_length_left_cm: data.foot_length_left_cm?.toString() || '',
        foot_width_right_cm: data.foot_width_right_cm?.toString() || '',
        foot_width_left_cm: data.foot_width_left_cm?.toString() || '',
        foot_arch_right_cm: data.foot_arch_right_cm?.toString() || '',
        foot_arch_left_cm: data.foot_arch_left_cm?.toString() || '',
        medical_conditions: regularConditions,
        other_conditions: otherCondition ? otherCondition.replace('その他: ', '') : ''
      })
    } catch (error) {
      console.error('Error fetching customer:', error)
      alert('顧客情報の取得に失敗しました')
      router.push('/customers')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchAddress = async () => {
    if (!formData.postal_code) {
      alert('郵便番号を入力してください')
      return
    }

    setSearchingAddress(true)
    try {
      const result = await searchAddressByPostalCode(formData.postal_code)
      if (result) {
        setFormData({
          ...formData,
          postal_code: formatPostalCode(formData.postal_code),
          prefecture: result.prefecture,
          city: result.city + result.town,
        })
      } else {
        alert('郵便番号が見つかりませんでした')
      }
    } catch (error) {
      console.error('住所検索エラー:', error)
      alert('住所の検索に失敗しました')
    } finally {
      setSearchingAddress(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 必須項目チェック
    if (!formData.name || !formData.contact) {
      alert('名前、連絡先は必須です')
      return
    }

    setSaving(true)

    try {
      const payload = {
        name: formData.name,
        name_kana: formData.name_kana || null,
        type: formData.type,
        gender: formData.gender || null,
        contact: formData.contact,
        postal_code: formData.postal_code || null,
        prefecture: formData.prefecture || null,
        city: formData.city || null,
        address_line1: formData.address_line1 || null,
        address_line2: formData.address_line2 || null,
        age: formData.age ? parseInt(formData.age) : null,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        usual_shoe_size: formData.usual_shoe_size || null,
        foot_length_right_cm: formData.foot_length_right_cm ? parseFloat(formData.foot_length_right_cm) : null,
        foot_length_left_cm: formData.foot_length_left_cm ? parseFloat(formData.foot_length_left_cm) : null,
        foot_width_right_cm: formData.foot_width_right_cm || null,
        foot_width_left_cm: formData.foot_width_left_cm || null,
        foot_arch_right_cm: formData.foot_arch_right_cm ? parseFloat(formData.foot_arch_right_cm) : null,
        foot_arch_left_cm: formData.foot_arch_left_cm ? parseFloat(formData.foot_arch_left_cm) : null,
        medical_conditions: (() => {
          const conditions = [...formData.medical_conditions]
          if (formData.other_conditions.trim()) {
            conditions.push(`その他: ${formData.other_conditions.trim()}`)
          }
          return conditions.length > 0 ? conditions : null
        })()
      }

      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '更新に失敗しました')
      }

      alert('更新しました')
      router.push(`/customers/${customerId}`)
    } catch (error) {
      console.error('Error updating customer:', error)
      alert(error instanceof Error ? error.message : '更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (confirm('変更内容が失われますが、よろしいですか？')) {
      router.push(`/customers/${customerId}`)
    }
  }

  const toggleMedicalCondition = (condition: string) => {
    setFormData(prev => ({
      ...prev,
      medical_conditions: prev.medical_conditions.includes(condition)
        ? prev.medical_conditions.filter(c => c !== condition)
        : [...prev.medical_conditions, condition]
    }))
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

  return (
    <AppLayout>
      <div className="page-content">
        {/* ヘッダー */}
        <div className="page-header">
          <div className="header-title-group">
            <button 
              className="btn-icon btn-back"
              onClick={() => router.push(`/customers/${customerId}`)}
              title="戻る"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <div className="title-wrapper">
              <h1 className="page-title">顧客情報編集</h1>
              <p className="page-description">顧客情報を更新してください</p>
            </div>
          </div>
        </div>

      {/* フォーム（新規作成と同じ構造） */}
      <form onSubmit={handleSubmit} className="customer-form">
        {/* 基本情報 */}
        <div className="form-section">
          <h2 className="section-title">基本情報</h2>
          <div className="form-grid">
            <div className="form-group required">
              <label className="label">顧客名</label>
              <input
                type="text"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: 山田 太郎"
                required
              />
            </div>

            <div className="form-group">
              <label className="label">フリガナ</label>
              <input
                type="text"
                className="input"
                value={formData.name_kana}
                onChange={(e) => setFormData({ ...formData, name_kana: normalizeKana(e.target.value) })}
                placeholder="例: ヤマダ タロウ"
              />
            </div>

            <div className="form-group">
              <label className="label">顧客コード</label>
              <input
                type="text"
                className="input"
                value={formData.code}
                disabled
                style={{ background: 'var(--gray-100)', cursor: 'not-allowed' }}
              />
              <p className="help-text">顧客コードは変更できません</p>
            </div>

            <div className="form-group required">
              <label className="label">タイプ</label>
              <select
                className="input"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as CustomerType })}
                required
              >
                <option value="顧客">顧客</option>
                <option value="スタッフ">スタッフ</option>
                <option value="サポート">サポート</option>
                <option value="社員">社員</option>
                <option value="代理店">代理店</option>
                <option value="その他">その他</option>
              </select>
            </div>

            <div className="form-group">
              <label className="label">性別</label>
              <select
                className="input"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender | '' })}
              >
                <option value="">選択してください</option>
                <option value="男性">男性</option>
                <option value="女性">女性</option>
                <option value="その他">その他</option>
                <option value="未回答">未回答</option>
              </select>
            </div>

            <div className="form-group required full-width">
              <label className="label">連絡先</label>
              <input
                type="text"
                className="input"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: normalizeText(e.target.value) })}
                placeholder="例: 090-1234-5678 / example@email.com"
                required
              />
            </div>
          </div>
        </div>

        {/* 住所情報 */}
        <div className="form-section">
          <h2 className="section-title">住所情報</h2>
          <div className="form-grid">
            <div className="form-group">
              <label className="label">郵便番号</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="input"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: normalizeNumericInput(e.target.value) })}
                  placeholder="例: 123-4567"
                  maxLength={8}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSearchAddress}
                  disabled={searchingAddress || !formData.postal_code}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <FontAwesomeIcon icon={faSearch} />
                  {searchingAddress ? '検索中...' : '住所検索'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="label">都道府県</label>
              <input
                type="text"
                className="input"
                value={formData.prefecture}
                onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                placeholder="例: 東京都"
              />
            </div>

            <div className="form-group full-width">
              <label className="label">市区町村</label>
              <input
                type="text"
                className="input"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="例: 渋谷区渋谷"
              />
            </div>

            <div className="form-group full-width">
              <label className="label">番地・丁目</label>
              <input
                type="text"
                className="input"
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                placeholder="例: 1-2-3"
              />
            </div>

            <div className="form-group full-width">
              <label className="label">建物名・部屋番号</label>
              <input
                type="text"
                className="input"
                value={formData.address_line2}
                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                placeholder="例: ○○マンション 101号室"
              />
            </div>
          </div>
        </div>

        {/* 身体情報 */}
        <div className="form-section">
          <h2 className="section-title">身体情報（任意）</h2>
          <div className="form-grid">
            <div className="form-group">
              <label className="label">年齢</label>
              <input
                type="number"
                className="input"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: normalizeNumericInput(e.target.value) })}
                placeholder="例: 30"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="label">体重 (kg)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={formData.weight_kg}
                onChange={(e) => setFormData({ ...formData, weight_kg: normalizeNumericInput(e.target.value) })}
                placeholder="例: 65.5"
                min="0"
              />
            </div>

          </div>
        </div>

        {/* 靴サイズ */}
        <div className="form-section">
          <h2 className="section-title">普段の靴サイズ（任意）</h2>
          <div className="medical-conditions">
            {[22.0, 22.5, 23.0, 23.5, 24.0, 24.5, 25.0, 25.5, 26.0, 26.5, 27.0, 27.5, 28.0, 28.5, 29.0, 29.5, 30.0, 30.5, 31.0].map(size => (
              <label key={size} className="checkbox-label">
                <input
                  type="radio"
                  name="shoe_size"
                  checked={formData.usual_shoe_size === `${size}`}
                  onChange={() => setFormData({ ...formData, usual_shoe_size: `${size}` })}
                />
                <span>{size}cm</span>
              </label>
            ))}
          </div>
        </div>

        {/* 足のサイズ */}
        <div className="form-section">
          <h2 className="section-title">足のサイズ（任意）</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            position: 'relative'
          }}>
            {/* 左足 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              paddingRight: '1rem'
            }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--gray-700)',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>左足</h3>

              <div className="form-group">
                <label className="label">足の長さ (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={formData.foot_length_left_cm}
                  onChange={(e) => setFormData({ ...formData, foot_length_left_cm: normalizeNumericInput(e.target.value) })}
                  placeholder="例: 25.5"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="label">足のアーチ (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={formData.foot_arch_left_cm}
                  onChange={(e) => setFormData({ ...formData, foot_arch_left_cm: normalizeNumericInput(e.target.value) })}
                  placeholder="例: 4.5"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="label">足の幅（ワイズ）</label>
                <select
                  className="input"
                  value={formData.foot_width_left_cm}
                  onChange={(e) => setFormData({ ...formData, foot_width_left_cm: e.target.value })}
                >
                  <option value="">選択してください</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="2E">2E (EE)</option>
                  <option value="3E">3E (EEE)</option>
                  <option value="4E">4E (EEEE)</option>
                  <option value="F">F</option>
                  <option value="G">G</option>
                </select>
              </div>
            </div>

            {/* 区切り線 */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '0',
              bottom: '0',
              width: '1px',
              backgroundColor: 'var(--gray-300)',
              transform: 'translateX(-50%)'
            }} />

            {/* 右足 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              paddingLeft: '1rem'
            }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--gray-700)',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>右足</h3>

              <div className="form-group">
                <label className="label">足の長さ (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={formData.foot_length_right_cm}
                  onChange={(e) => setFormData({ ...formData, foot_length_right_cm: normalizeNumericInput(e.target.value) })}
                  placeholder="例: 25.5"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="label">足のアーチ (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={formData.foot_arch_right_cm}
                  onChange={(e) => setFormData({ ...formData, foot_arch_right_cm: normalizeNumericInput(e.target.value) })}
                  placeholder="例: 4.5"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="label">足の幅（ワイズ）</label>
                <select
                  className="input"
                  value={formData.foot_width_right_cm}
                  onChange={(e) => setFormData({ ...formData, foot_width_right_cm: e.target.value })}
                >
                  <option value="">選択してください</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="2E">2E (EE)</option>
                  <option value="3E">3E (EEE)</option>
                  <option value="4E">4E (EEEE)</option>
                  <option value="F">F</option>
                  <option value="G">G</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 健康情報 */}
        <div className="form-section">
          <h2 className="section-title">持病・症状（任意）</h2>
          {Object.entries(medicalConditionsByCategory).map(([category, conditions]) => (
            <div key={category} style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--gray-700)',
                marginBottom: '0.75rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid var(--gray-300)'
              }}>{category}</h3>
              <div className="medical-conditions">
                {conditions.map(condition => (
                  <label key={condition} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.medical_conditions.includes(condition)}
                      onChange={() => toggleMedicalCondition(condition)}
                    />
                    <span>{condition}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* その他（自由記述） */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'var(--gray-700)',
              marginBottom: '0.75rem',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid var(--gray-300)'
            }}>その他</h3>
            <textarea
              className="input textarea"
              value={formData.other_conditions}
              onChange={(e) => setFormData({ ...formData, other_conditions: e.target.value })}
              placeholder="その他の症状や気になる点があれば記入してください"
              rows={3}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* フォームアクション */}
        <div className="form-actions">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={saving}
          >
            <FontAwesomeIcon icon={faTimes} />
            キャンセル
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={saving}
          >
            <FontAwesomeIcon icon={faSave} />
            {saving ? '更新中...' : '更新する'}
          </button>
        </div>
      </form>
      </div>
    </AppLayout>
  )
}

