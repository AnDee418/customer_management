'use client'

import { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import './RightPanel.css'

interface RightPanelProps {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
}

export default function RightPanel({ children, isOpen, onClose }: RightPanelProps) {
  return (
    <>
      {/* オーバーレイ（モバイル用） */}
      {isOpen && (
        <div className="overlay" onClick={onClose} />
      )}

      {/* パネル */}
      <aside className="right-panel">
        <div className="panel-header">
          <h3 className="panel-title">詳細情報</h3>
          <button 
            className="close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="panel-content">
          {children}
        </div>
      </aside>
    </>
  )
}

