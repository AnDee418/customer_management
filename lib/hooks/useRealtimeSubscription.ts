/**
 * Supabase Realtime Subscription Hook
 * リアルタイム更新のためのWebSocket接続管理
 *
 * 使用方法:
 * const { data, loading, error } = useRealtimeSubscription({
 *   table: 'customers',
 *   event: '*', // 'INSERT' | 'UPDATE' | 'DELETE' | '*'
 *   filter: 'id=eq.123', // オプション
 *   onInsert: (payload) => {},
 *   onUpdate: (payload) => {},
 *   onDelete: (payload) => {},
 * })
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/lib/supabase/client-provider'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type PostgresChangesEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface UseRealtimeSubscriptionOptions<T extends Record<string, any> = any> {
  table: string
  event?: PostgresChangesEvent
  filter?: string
  schema?: string
  onInsert?: (payload: RealtimePostgresChangesPayload<T>) => void
  onUpdate?: (payload: RealtimePostgresChangesPayload<T>) => void
  onDelete?: (payload: RealtimePostgresChangesPayload<T>) => void
  enabled?: boolean
}

interface UseRealtimeSubscriptionReturn {
  isSubscribed: boolean
  error: string | null
}

export function useRealtimeSubscription<T extends Record<string, any> = any>(
  options: UseRealtimeSubscriptionOptions<T>
): UseRealtimeSubscriptionReturn {
  const { supabase, isLoading } = useSupabase()
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const {
    table,
    event = '*',
    filter,
    schema = 'public',
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
  } = options

  // コールバック関数をrefで管理（依存配列の問題を回避）
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete })

  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete }
  }, [onInsert, onUpdate, onDelete])

  // クリーンアップ関数
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase?.removeChannel(channelRef.current)
      channelRef.current = null
      setIsSubscribed(false)
    }
  }, [supabase])

  useEffect(() => {
    // Supabaseクライアントが準備できていない、または無効化されている場合は何もしない
    if (isLoading || !supabase || !enabled) {
      return
    }

    // チャンネル名を生成（ユニーク性を保つ）
    const channelName = `realtime:${table}:${event}${filter ? `:${filter}` : ''}`

    try {
      // チャンネルを作成
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event,
            schema,
            table,
            filter,
          },
          (payload: RealtimePostgresChangesPayload<T>) => {
            // 開発環境でのみ詳細ログを出力
            if (process.env.NODE_ENV === 'development') {
              console.log('[Realtime] Change received:', {
                table,
                event: payload.eventType,
                timestamp: new Date().toISOString(),
              })
            }

            // イベントタイプに応じてコールバックを実行
            switch (payload.eventType) {
              case 'INSERT':
                callbacksRef.current.onInsert?.(payload)
                break
              case 'UPDATE':
                callbacksRef.current.onUpdate?.(payload)
                break
              case 'DELETE':
                callbacksRef.current.onDelete?.(payload)
                break
            }
          }
        )
        .subscribe((status) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('[Realtime] Subscription status:', status, 'for table:', table)
          }

          if (status === 'SUBSCRIBED') {
            setIsSubscribed(true)
            setError(null)
            if (process.env.NODE_ENV === 'development') {
              console.log('[Realtime] Successfully subscribed to:', table)
            }
          } else if (status === 'CHANNEL_ERROR') {
            setError('リアルタイム接続に失敗しました')
            setIsSubscribed(false)
          } else if (status === 'TIMED_OUT') {
            setError('リアルタイム接続がタイムアウトしました')
            setIsSubscribed(false)
          } else if (status === 'CLOSED') {
            setIsSubscribed(false)
          }
        })

      channelRef.current = channel
    } catch (err) {
      console.error('[Realtime] Subscription error:', err)
      setError(err instanceof Error ? err.message : 'リアルタイム購読エラー')
      setIsSubscribed(false)
    }

    // クリーンアップ
    return () => {
      cleanup()
    }
  }, [
    supabase,
    isLoading,
    table,
    event,
    filter,
    schema,
    enabled,
    cleanup,
  ])

  return {
    isSubscribed,
    error,
  }
}

/**
 * 顧客テーブル専用のリアルタイム購読フック
 */
export function useCustomersRealtime(callbacks: {
  onInsert?: (customer: any) => void
  onUpdate?: (customer: any) => void
  onDelete?: (customerId: string) => void
}) {
  return useRealtimeSubscription({
    table: 'customers',
    event: '*',
    onInsert: (payload) => {
      if (payload.new) {
        callbacks.onInsert?.(payload.new)
      }
    },
    onUpdate: (payload) => {
      if (payload.new) {
        callbacks.onUpdate?.(payload.new)
      }
    },
    onDelete: (payload) => {
      if (payload.old && 'id' in payload.old) {
        callbacks.onDelete?.(payload.old.id as string)
      }
    },
  })
}

/**
 * 特定の顧客のリアルタイム購読フック
 */
export function useCustomerRealtime(
  customerId: string | null,
  callbacks: {
    onUpdate?: (customer: any) => void
    onDelete?: () => void
  }
) {
  return useRealtimeSubscription({
    table: 'customers',
    event: '*',
    filter: customerId ? `id=eq.${customerId}` : undefined,
    enabled: !!customerId,
    onUpdate: (payload) => {
      if (payload.new) {
        callbacks.onUpdate?.(payload.new)
      }
    },
    onDelete: () => {
      callbacks.onDelete?.()
    },
  })
}
