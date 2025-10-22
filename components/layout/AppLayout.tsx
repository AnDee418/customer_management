'use client'

import { ReactNode, useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import RightPanel from './RightPanel'
import './AppLayout.css'

interface AppLayoutProps {
  children: ReactNode
  showRightPanel?: boolean
  rightPanelContent?: ReactNode
}

export default function AppLayout({ 
  children, 
  showRightPanel = false,
  rightPanelContent 
}: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(showRightPanel)

  return (
    <div className="app-layout">
      {/* サイドバー（最も左、全高） */}
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      
      {/* メインエリア（ヘッダー・コンテンツ・パネル） */}
      <div className="app-main">
        {/* ヘッダー */}
        <Header 
          onRightPanelToggle={() => setIsRightPanelOpen(!isRightPanelOpen)}
          showRightPanelToggle={!!rightPanelContent}
          isRightPanelOpen={isRightPanelOpen}
        />
        
        {/* コンテンツとライトパネルのラッパー */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* コンテンツエリア */}
          <main className="content-area">
            {children}
          </main>

          {/* ライトパネル */}
          {rightPanelContent && isRightPanelOpen && (
            <RightPanel 
              isOpen={isRightPanelOpen}
              onClose={() => setIsRightPanelOpen(false)}
            >
              {rightPanelContent}
            </RightPanel>
          )}
        </div>
      </div>
    </div>
  )
}

