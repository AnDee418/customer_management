'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faBell, faQuestionCircle, faEllipsisV } from '@fortawesome/free-solid-svg-icons'
import './Header.css'

interface HeaderProps {
  onRightPanelToggle?: () => void
  showRightPanelToggle?: boolean
  isRightPanelOpen?: boolean
}

export default function Header({ onRightPanelToggle, showRightPanelToggle, isRightPanelOpen }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-content">
        {/* 検索バー */}
        <div className="search-container">
          <div className="search-wrapper">
            <FontAwesomeIcon icon={faSearch} className="search-icon" />
            <input
              type="text"
              placeholder="顧客名、コード、担当者名で検索..."
              className="search-input"
            />
            <kbd className="kbd">Ctrl+K</kbd>
          </div>
        </div>

        {/* アクション */}
        <div className="header-actions">
          {/* 通知 */}
          <button className="action-btn" title="通知">
            <FontAwesomeIcon icon={faBell} className="icon" />
            <span className="notification-badge">3</span>
          </button>

          {/* ヘルプ */}
          <button className="action-btn" title="ヘルプ">
            <FontAwesomeIcon icon={faQuestionCircle} className="icon" />
          </button>

          {/* ライトパネルトグル */}
          {showRightPanelToggle && (
            <button 
              className={`action-btn ${isRightPanelOpen ? 'active' : ''}`}
              onClick={onRightPanelToggle}
              title="パネル表示切替"
            >
              <FontAwesomeIcon icon={faEllipsisV} className="icon" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

