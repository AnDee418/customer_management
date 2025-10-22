import { redirect } from 'next/navigation'

export default function Home() {
  // ダッシュボードにリダイレクト
  redirect('/dashboard')
}

