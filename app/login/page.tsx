'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEnvelope, faLock, faSpinner, faUsers, faChartLine, faClock } from '@fortawesome/free-solid-svg-icons'
import './login.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'ログインに失敗しました')
      }

      // ログイン成功
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      {/* 左側: ブランディングエリア */}
      <div className="login-brand-area">
        <div className="brand-content">
          <h1 className="brand-title">顧客管理システム</h1>
          <p className="brand-subtitle">Customer Management System</p>
          
          <div className="brand-features">
            <div className="feature-item">
              <FontAwesomeIcon icon={faUsers} />
              <span>顧客情報を一元管理</span>
            </div>
            <div className="feature-item">
              <FontAwesomeIcon icon={faChartLine} />
              <span>分析とレポート機能</span>
            </div>
            <div className="feature-item">
              <FontAwesomeIcon icon={faClock} />
              <span>リアルタイムで情報を共有</span>
            </div>
          </div>
        </div>
        
        <div className="brand-footer">
          <p>© 2025 Customer Management System</p>
        </div>
      </div>

      {/* 右側: ログインフォーム */}
      <div className="login-form-area">
        <div className="login-card">
          <div className="login-header">
            <h2 className="login-title">ログイン</h2>
            <p className="login-subtitle">アカウント情報を入力してください</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                メールアドレス
              </label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <FontAwesomeIcon icon={faEnvelope} />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@company.com"
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                パスワード
              </label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <FontAwesomeIcon icon={faLock} />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <span>ログイン中...</span>
                </>
              ) : (
                <span>ログイン</span>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p className="footer-text">
              パスワードをお忘れの場合は、管理者にお問い合わせください
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

