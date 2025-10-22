import { NextResponse } from 'next/server'

/**
 * Supabase設定エンドポイント
 * クライアントサイドに必要な公開情報のみを返す
 * 
 * セキュリティ: NEXT_PUBLIC_を使わず、サーバー経由で安全に配信
 */
export async function GET() {
  // サーバーサイドの環境変数から取得
  const config = {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  }

  // 設定が正しく読み込まれているか確認
  if (!config.url || !config.anonKey) {
    return NextResponse.json(
      { error: 'Supabase configuration is missing' },
      { status: 500 }
    )
  }

  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'public, max-age=3600', // 1時間キャッシュ
    },
  })
}


