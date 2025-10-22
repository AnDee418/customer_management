# 07. フロントエンド設計ルール

## 最重要原則：グローバルレイアウトの尊重

**絶対に守るべきルール：全ページは `AppLayout` コンポーネント内に配置すること**

---

## レイアウト階層構造

### 1. グローバルレイアウト（全ページ共通）

```
app/layout.tsx (Root Layout)
└── SupabaseProvider
    └── AuthProvider
        └── {children} ← 各ページがここに挿入される
```

### 2. アプリケーションレイアウト（認証後の全ページ）

```tsx
import AppLayout from '@/components/layout/AppLayout'

export default function PageComponent() {
  return (
    <AppLayout>
      <div className="page-content">
        {/* ページ固有のコンテンツ */}
      </div>
    </AppLayout>
  )
}
```

**構造：**
```
AppLayout
├── Header (上部固定、全ページ共通)
├── Sidebar (左側固定、全ページ共通)
├── content-area (メインコンテンツエリア)
│   └── page-content (各ページのコンテンツ)
└── RightPanel (右側、トグル可能)
```

---

## 🚨 禁止事項（Critical）

### ❌ やってはいけないこと

1. **ページごとに独自のヘッダー/サイドバーを作成する**
   ```tsx
   // ❌ 間違い
   export default function CustomersPage() {
     return (
       <div className="my-page">
         <header>...</header>  {/* 独自ヘッダー */}
         <nav>...</nav>        {/* 独自サイドバー */}
         <main>...</main>
       </div>
     )
   }
   ```

2. **AppLayoutをラップせずにページコンテンツを返す**
   ```tsx
   // ❌ 間違い
   export default function CustomersPage() {
     return (
       <div className="customers-page">
         {/* コンテンツ */}
       </div>
     )
   }
   ```

3. **ページに独自の全画面レイアウトを適用する**
   ```css
   /* ❌ 間違い */
   .my-page {
     min-height: 100vh;
     padding: 2rem;
     /* これはAppLayoutが既に提供している */
   }
   ```

---

## ✅ 正しい実装パターン

### パターン1: 基本的なページ

```tsx
'use client'

import AppLayout from '@/components/layout/AppLayout'
import './page.css'

export default function MyPage() {
  return (
    <AppLayout>
      <div className="page-content">
        <h1>ページタイトル</h1>
        <p>コンテンツ...</p>
      </div>
    </AppLayout>
  )
}
```

### パターン2: 右パネル付きページ

```tsx
'use client'

import AppLayout from '@/components/layout/AppLayout'
import './page.css'

export default function DashboardPage() {
  return (
    <AppLayout
      showRightPanel={true}
      rightPanelContent={
        <div>
          <h4>クイックアクション</h4>
          {/* 右パネルのコンテンツ */}
        </div>
      }
    >
      <div className="page-content">
        <h1>ダッシュボード</h1>
        {/* メインコンテンツ */}
      </div>
    </AppLayout>
  )
}
```

### パターン3: ローディング状態

```tsx
'use client'

import AppLayout from '@/components/layout/AppLayout'
import './page.css'

export default function MyPage() {
  const [loading, setLoading] = useState(true)

  if (loading) {
    return (
      <AppLayout>
        <div className="page-content">
          <div className="loading-state">
            <p>読み込み中...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="page-content">
        {/* 通常のコンテンツ */}
      </div>
    </AppLayout>
  )
}
```

---

## CSS設計ルール

### 1. スクロール動作の理解

**重要**: サイドバーとヘッダーは固定、コンテンツエリアのみがスクロールします。

```
AppLayout (height: 100vh, overflow: hidden)
├── Sidebar (height: 100vh, 固定)
├── app-main (flex: 1, overflow: hidden)
    ├── Header (height: 64px, flex-shrink: 0, 固定)
    └── content-area (flex: 1, overflow-y: auto, スクロール可能)
        └── page-content (ページコンテンツ)
```

### 2. ページ固有のスタイルは `.page-content` 内のみ

```css
/* ✅ 正しい */
.page-content {
  /* AppLayoutのcontent-areaに収まる */
  /* height指定は不要。コンテンツ量に応じて自動で伸縮 */
}

.page-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
}
```

### 3. グローバルレイアウトのスタイルを上書きしない

```css
/* ❌ 間違い */
body {
  background: #fff; /* AppLayoutの背景を上書きしてしまう */
}

.app-layout {
  height: auto; /* グローバルレイアウトの構造を壊す */
  overflow: visible; /* スクロール動作が壊れる */
}

.content-area {
  overflow: visible; /* コンテンツエリアのスクロールが壊れる */
}
```

### 4. パディング/マージンは `content-area` が管理

```css
/* ❌ 間違い - ページ全体のパディング */
.customers-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* ✅ 正しい - コンテンツ内の余白のみ */
.page-header {
  margin-bottom: 2rem;
}

.section {
  margin-bottom: 1.5rem;
}
```

### 5. スクロール動作を妨げない

```css
/* ❌ 間違い */
.page-content {
  height: 100vh; /* 親の高さを超えてスクロールが壊れる */
  overflow: hidden; /* スクロールを無効化してしまう */
}

/* ✅ 正しい */
.page-content {
  /* height指定なし - コンテンツ量に応じて自動調整 */
  /* overflow指定なし - 親(content-area)がスクロール管理 */
}
```

---

## デザインシステム

### カラーパレット（必須使用）

```css
:root {
  --brand-primary: #14243F;   /* ブランドメインカラー */
  --brand-accent: #ce6b0f;    /* アクセントカラー */
  --base-bg: #e2e2e2;         /* 背景色 */
  --white: #ffffff;           /* 白 */
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-400: #9ca3af;
  --gray-500: #6b7280;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-800: #1f2937;
  --gray-900: #111827;
  --success: #10b981;
  --error: #ef4444;
  --warning: #f59e0b;
  --info: #3b82f6;
}
```

### ボタンスタイル（統一使用）

```css
.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--brand-primary);
  color: white;
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-danger {
  background: var(--error);
  color: white;
}
```

### アイコン（Font Awesome統一）

```tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons'

<FontAwesomeIcon icon={faPlus} />
```

---

## ページ作成チェックリスト

新しいページを作成する際は、以下を必ず確認：

- [ ] `AppLayout` でページをラップしているか
- [ ] ページコンテンツは `.page-content` クラスで囲んでいるか
- [ ] 独自のヘッダー/サイドバーを作成していないか
- [ ] カラーパレットの変数を使用しているか
- [ ] Font Awesomeアイコンを使用しているか
- [ ] ボタンは統一スタイル（`.btn`クラス）を使用しているか
- [ ] レスポンシブデザインを考慮しているか

---

## SPAとしての動作

### ページ遷移時の挙動

Next.js App Routerでは、ページ遷移時に以下が起こります：

1. **クライアントサイドルーティング**: ページ全体がリロードされない
2. **`AppLayout`の永続化**: ヘッダー/サイドバーは再レンダリングされない
3. **`{children}`の差し替え**: ページコンテンツ部分のみが置き換わる

```
初回ロード:
app/layout.tsx → AppLayout → DashboardPage

/customers へ遷移:
app/layout.tsx (変化なし)
  → AppLayout (変化なし)
    → CustomersPage (ここだけ変わる)
```

### 正しいナビゲーション

```tsx
import { useRouter } from 'next/navigation'

const router = useRouter()

// ✅ 正しい - SPAとして動作
router.push('/customers')

// ❌ 間違い - ページ全体がリロード
window.location.href = '/customers'
```

---

## 認証が不要なページ（例外）

ログインページなど、`AppLayout`が不要なページ：

```tsx
// app/login/page.tsx
'use client'

export default function LoginPage() {
  // AppLayoutなし
  return (
    <div className="login-page">
      {/* ログインフォーム */}
    </div>
  )
}
```

**該当ページ：**
- `/login` - ログインページ
- `/signup` - サインアップページ（現在は非実装）
- `/error` - エラーページ（オプション）

---

## トラブルシューティング

### 問題：サイドバーが表示されない

**原因：** `AppLayout`でラップしていない

**解決策：**
```tsx
// ❌ 間違い
export default function Page() {
  return <div>コンテンツ</div>
}

// ✅ 正しい
export default function Page() {
  return (
    <AppLayout>
      <div className="page-content">コンテンツ</div>
    </AppLayout>
  )
}
```

### 問題：ページが二重にヘッダーを持っている

**原因：** ページ内で独自のヘッダーを作成している

**解決策：** 独自ヘッダーを削除し、`AppLayout`のヘッダーを使用

### 問題：レイアウトが崩れる

**原因：** ページで全画面レイアウトを適用している

**解決策：** ページのCSSから `min-height: 100vh` や全画面パディングを削除

### 問題：サイドバーやヘッダーがスクロールで隠れる

**原因：** `app-layout` の高さが `min-height` になっている、または `overflow: hidden` が設定されていない

**解決策：**
```css
/* components/layout/AppLayout.css */
.app-layout {
  height: 100vh; /* min-heightではなくheight */
  overflow: hidden; /* 全体のスクロールを無効化 */
}

.content-area {
  overflow-y: auto; /* コンテンツエリアのみスクロール可能 */
}
```

### 問題：ページコンテンツがスクロールしない

**原因：** ページで `overflow: hidden` や `height: 100vh` を設定している

**解決策：**
```css
/* ❌ 削除 */
.page-content {
  height: 100vh;
  overflow: hidden;
}

/* ✅ 何も指定しない */
.page-content {
  /* コンテンツ量に応じて自動調整 */
}
```

---

## レビューポイント

Pull Request時に必ずチェック：

1. **構造チェック**
   - すべてのページが `AppLayout` でラップされているか
   - `page-content` クラスを使用しているか

2. **デザインシステム遵守**
   - カラー変数を使用しているか
   - 統一ボタンスタイルを使用しているか
   - Font Awesomeアイコンを使用しているか

3. **CSS分離**
   - ページ固有のCSSは別ファイルになっているか
   - グローバルスタイルを上書きしていないか

4. **レスポンシブ**
   - モバイルビューで崩れないか
   - タブレットビューで崩れないか

---

## 参考実装

### 良い例

- `app/dashboard/page.tsx` - ダッシュボード（右パネル付き）
- `app/account/page.tsx` - アカウントページ（基本レイアウト）
- `app/customers/page.tsx` - 顧客一覧（修正後）

### 悪い例（アンチパターン）

```tsx
// ❌ 独自レイアウトを作成してしまった例
export default function BadPage() {
  return (
    <div className="full-page">
      <header className="my-header">
        {/* 独自ヘッダー */}
      </header>
      <aside className="my-sidebar">
        {/* 独自サイドバー */}
      </aside>
      <main className="my-content">
        {/* コンテンツ */}
      </main>
    </div>
  )
}
```

---

## まとめ

### 3つの鉄則

1. **全ページは `AppLayout` でラップする**
2. **ページコンテンツは `.page-content` に収める**
3. **デザインシステムの変数/クラスを使用する**

### 新規ページ作成のテンプレート

```tsx
'use client'

import AppLayout from '@/components/layout/AppLayout'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import './page.css'

export default function NewPage() {
  return (
    <AppLayout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">ページタイトル</h1>
          <button className="btn btn-primary">
            <FontAwesomeIcon icon={faPlus} />
            アクション
          </button>
        </div>

        {/* ページコンテンツ */}
      </div>
    </AppLayout>
  )
}
```

---

**最終更新**: 2025-10-21  
**バージョン**: v1.0  
**作成理由**: 顧客管理ページ実装時のレイアウト無視問題を防ぐため


