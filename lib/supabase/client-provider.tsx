'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

interface SupabaseContextType {
  supabase: SupabaseClient | null
  isLoading: boolean
}

const SupabaseContext = createContext<SupabaseContextType>({
  supabase: null,
  isLoading: true,
})

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function initializeSupabase() {
      try {
        // サーバーから設定を取得
        const response = await fetch('/api/config/supabase')
        const config = await response.json()

        if (config.error) {
          console.error('Failed to load Supabase config:', config.error)
          setIsLoading(false)
          return
        }

        // Supabaseクライアントを初期化
        const client = createBrowserClient(config.url, config.anonKey, {
          cookies: {
            getAll() {
              return document.cookie.split('; ').map(cookie => {
                const [name, value] = cookie.split('=')
                return { name, value: decodeURIComponent(value) }
              })
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                const cookieOptions = []
                if (options?.maxAge) cookieOptions.push(`max-age=${options.maxAge}`)
                if (options?.path) cookieOptions.push(`path=${options.path}`)
                if (options?.domain) cookieOptions.push(`domain=${options.domain}`)
                if (options?.sameSite) cookieOptions.push(`samesite=${options.sameSite}`)
                if (options?.secure) cookieOptions.push('secure')
                
                document.cookie = `${name}=${encodeURIComponent(value)}${cookieOptions.length ? '; ' + cookieOptions.join('; ') : ''}`
              })
            },
          },
          global: {
            headers: {
              'Cache-Control': 'no-store',
            },
          },
        })

        setSupabase(client)
      } catch (error) {
        console.error('Failed to initialize Supabase:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeSupabase()
  }, [])

  return (
    <SupabaseContext.Provider value={{ supabase, isLoading }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export function useSupabase() {
  const context = useContext(SupabaseContext)
  if (context === undefined) {
    throw new Error('useSupabase must be used within SupabaseProvider')
  }
  return context
}


