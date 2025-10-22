'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faChartLine, 
  faUsers, 
  faChartPie,
  faFileAlt, 
  faCog,
  faBuilding,
  faChevronLeft,
  faChevronRight,
  faUser,
  faSignOutAlt,
  faIdCard
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/lib/auth/auth-context'
import './Sidebar.css'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

interface MenuItem {
  id: string
  label: string
  icon: any
  href: string
  badge?: number
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'ダッシュボード', icon: faChartLine, href: '/dashboard' },
  { id: 'customers', label: '顧客管理', icon: faUsers, href: '/customers' },
  { id: 'analytics', label: '顧客分析', icon: faChartPie, href: '/analytics' },
  { id: 'audit', label: 'ログ監査', icon: faFileAlt, href: '/audit' },
  { id: 'account', label: 'マイページ', icon: faIdCard, href: '/account' },
  { id: 'settings', label: '設定', icon: faCog, href: '/settings' },
]

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* ブランドエリア（ヘッダーと同じ高さ） */}
      <div className="sidebar-brand">
        <div className="brand">
          <FontAwesomeIcon icon={faBuilding} className="brand-icon" />
          {!isCollapsed && <span className="brand-name">顧客管理</span>}
        </div>
      </div>

      {/* トグルボタン */}
      <div className="sidebar-toggle-container">
        <button 
          className="sidebar-toggle-btn"
          onClick={onToggle}
          aria-label={isCollapsed ? '展開' : '折りたたむ'}
        >
          <FontAwesomeIcon icon={isCollapsed ? faChevronRight : faChevronLeft} />
        </button>
      </div>

      {/* ナビゲーションメニュー */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <FontAwesomeIcon icon={item.icon} className="nav-icon" />
              {!isCollapsed && (
                <>
                  <span className="nav-label">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* フッター（ユーザー情報など） */}
      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <FontAwesomeIcon icon={faUser} />
            </div>
            <div className="user-details">
              <div className="user-name">{user?.email?.split('@')[0] || 'ユーザー'}</div>
              <div className="user-role">{user?.email || ''}</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut()
              router.push('/login')
            }}
            className="logout-button"
            title="ログアウト"
          >
            <FontAwesomeIcon icon={faSignOutAlt} />
          </button>
        </div>
      )}
    </aside>
  )
}

