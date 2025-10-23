'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartLine,
  faUsers,
  faChartPie,
  faFileAlt,
  faBuilding,
  faChevronLeft,
  faChevronRight,
  faUser,
  faSignOutAlt,
  faIdCard,
  faUsersGear
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
  section: 'general' | 'admin'
  requiredRole?: 'admin' | 'manager' | 'user' | 'viewer'
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'ダッシュボード', icon: faChartLine, href: '/dashboard', section: 'general' },
  { id: 'customers', label: '顧客管理', icon: faUsers, href: '/customers', section: 'general' },
  { id: 'analytics', label: '顧客分析', icon: faChartPie, href: '/analytics', section: 'general' },
  { id: 'account', label: 'マイページ', icon: faIdCard, href: '/account', section: 'general' },
]

const adminMenuItems: MenuItem[] = [
  { id: 'admin', label: '管理者コンソール', icon: faUsersGear, href: '/admin', section: 'admin', requiredRole: 'admin' },
  { id: 'audit', label: 'ログ監査', icon: faFileAlt, href: '/audit', section: 'admin', requiredRole: 'manager' },
]

// ロール階層: admin > manager > user > viewer
const roleHierarchy = {
  admin: 4,
  manager: 3,
  user: 2,
  viewer: 1,
}

function hasPermission(userRole: string | null, requiredRole?: string): boolean {
  if (!requiredRole) return true
  if (!userRole) return false

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0

  return userLevel >= requiredLevel
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [profileRole, setProfileRole] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setProfileRole(null)
      return
    }

    const controller = new AbortController()

    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/account/profile', {
          headers: { 'Cache-Control': 'no-store' },
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = await response.json()
        if (data?.role) {
          setProfileRole(data.role)
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return
        }
        console.error('Failed to load profile role', error)
      }
    }

    fetchProfile()

    return () => controller.abort()
  }, [user])

  const generalMenu = useMemo(() => menuItems, [])

  const adminMenu = useMemo(() => {
    if (!profileRole) return []

    // ユーザーのロールに基づいてメニューをフィルタリング
    return adminMenuItems.filter((item) => hasPermission(profileRole, item.requiredRole))
  }, [profileRole])

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
        {/* 一般機能セクション */}
        {!isCollapsed && <div className="nav-section-header">一般機能</div>}
        {generalMenu.map((item) => {
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

        {/* 管理機能セクション */}
        {adminMenu.length > 0 && (
          <>
            <div className="nav-divider"></div>
            {!isCollapsed && <div className="nav-section-header admin">管理機能</div>}
            <div className="nav-admin-section">
              {adminMenu.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`nav-item admin ${isActive ? 'active' : ''}`}
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
            </div>
          </>
        )}
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
