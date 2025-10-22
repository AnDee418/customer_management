import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      return NextResponse.json(
        { error: 'ログアウトに失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout API error:', error)
    return NextResponse.json(
      { error: 'ログアウト処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

