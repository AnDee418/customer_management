# マイクロサービス連携ガイド

このドキュメントでは、外部マイクロサービスから顧客管理システムにアクセスする際の認証・認可パターンを説明します。

## 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [認証パターン](#認証パターン)
3. [実装ガイド](#実装ガイド)
4. [セキュリティ考慮事項](#セキュリティ考慮事項)
5. [サンプルコード](#サンプルコード)

---

## アーキテクチャ概要

### 前提条件

- **連携サービス**: 別のSupabase Authプロジェクトを使用
- **ユースケース**: エンドユーザーが連携サービスのUIから顧客情報を参照・登録
- **要件**: シームレスなUX（毎回ログイン不要）、セキュリティ最大化

### 推奨アプローチ: BFF + ユーザーコンテキスト伝搬

```
┌─────────────┐
│ ユーザー     │
└──────┬──────┘
       │ 1. ログイン（1回のみ）
       ↓
┌─────────────────────────────┐
│ 連携サービス（別Supabase Auth）│
│  - フロントエンド（Next.js）    │
│  - バックエンド（BFF）         │
└──────┬──────────────────────┘
       │ 2. BFF経由でAPI呼び出し
       │    - OAuth2 Client Credentials（M2M認証）
       │    - X-User-Context ヘッダー（ユーザー情報伝搬）
       ↓
┌─────────────────────────────┐
│ 顧客管理システム（このシステム）│
│  - /api/m2m/* エンドポイント  │
│  - OAuth2検証 + ユーザーマッピング│
└─────────────────────────────┘
```

**メリット**:
- ✅ エンドユーザーは連携サービスに1回ログインするだけ
- ✅ セキュリティ強固（OAuth2 CC + IP Allowlist + レート制限）
- ✅ ユーザーコンテキスト保持（監査ログ、RLS適用可能）
- ✅ 別Supabase Authプロジェクトでも動作

---

## 認証パターン

### パターン1: M2M認証 + ユーザーコンテキスト伝搬（推奨）

**用途**: エンドユーザーの操作を連携サービス経由で実行

#### フロー

```
1. ユーザーが連携サービスにログイン（Supabase Auth）
2. ユーザーが「顧客検索」ボタンをクリック
3. 連携サービスのフロントエンド → 連携サービスのBFF
4. 連携サービスのBFFが以下を実行:
   a. OAuth2 Client Credentialsでアクセストークン取得
   b. 顧客管理システムのM2M APIを呼び出し
   c. X-User-Context ヘッダーでユーザー情報を伝搬
5. 顧客管理システムがレスポンス返却
6. 連携サービスがフロントエンドに表示
```

#### API呼び出し例

```http
POST https://customer-management.example.com/api/m2m/customers/search
Authorization: Bearer <OAuth2_Access_Token>
X-User-Context: {"user_id": "user_12345", "email": "user@example.com", "role": "user"}
Content-Type: application/json

{
  "query": "山田",
  "limit": 20
}
```

#### 認証フロー詳細

**Step 1: OAuth2 Client Credentialsトークン取得**

```http
POST https://customer-management.example.com/api/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=<連携サービスのクライアントID>
&client_secret=<連携サービスのシークレット>
&scope=customers:read customers:write
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "customers:read customers:write"
}
```

**Step 2: M2M API呼び出し（ユーザーコンテキスト付き）**

```typescript
// 連携サービスのBFF（Next.js API Route）
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // 1. 連携サービスのSupabase Authでユーザー認証チェック
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const authHeader = req.headers.authorization
  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )

  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 2. OAuth2 Client Credentialsトークン取得（キャッシュ推奨）
  const tokenResponse = await fetch('https://customer-management.example.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.OAUTH2_CLIENT_ID,
      client_secret: process.env.OAUTH2_CLIENT_SECRET,
      scope: 'customers:read'
    })
  })

  const { access_token } = await tokenResponse.json()

  // 3. 顧客管理システムのM2M APIを呼び出し
  const customerResponse = await fetch('https://customer-management.example.com/api/m2m/customers/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'X-User-Context': JSON.stringify({
        user_id: user.id,
        email: user.email,
        role: user.user_metadata.role || 'user'
      }),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req.body)
  })

  const customers = await customerResponse.json()
  res.status(200).json(customers)
}
```

---

## 実装ガイド

### 顧客管理システム側の実装

#### 1. OAuth2 Client Credentials エンドポイント実装

**ファイル**: `app/api/oauth2/token/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

// クライアント認証情報（環境変数から読み込み）
const OAUTH2_CLIENTS = {
  'order-service-client-id': {
    secret: process.env.ORDER_SERVICE_CLIENT_SECRET,
    scopes: ['customers:read', 'customers:write']
  },
  'measurement-service-client-id': {
    secret: process.env.MEASUREMENT_SERVICE_CLIENT_SECRET,
    scopes: ['customers:read']
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()

  const grantType = formData.get('grant_type')
  const clientId = formData.get('client_id') as string
  const clientSecret = formData.get('client_secret') as string
  const scope = formData.get('scope') as string

  // 1. grant_type検証
  if (grantType !== 'client_credentials') {
    return NextResponse.json(
      { error: 'unsupported_grant_type' },
      { status: 400 }
    )
  }

  // 2. クライアント認証
  const client = OAUTH2_CLIENTS[clientId]
  if (!client || client.secret !== clientSecret) {
    return NextResponse.json(
      { error: 'invalid_client' },
      { status: 401 }
    )
  }

  // 3. スコープ検証
  const requestedScopes = scope.split(' ')
  const allowedScopes = requestedScopes.filter(s => client.scopes.includes(s))

  if (allowedScopes.length === 0) {
    return NextResponse.json(
      { error: 'invalid_scope' },
      { status: 400 }
    )
  }

  // 4. アクセストークン生成（JWT）
  const accessToken = jwt.sign(
    {
      client_id: clientId,
      scopes: allowedScopes,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1時間
    },
    process.env.JWT_SECRET!,
    { algorithm: 'HS256' }
  )

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: allowedScopes.join(' ')
  })
}
```

#### 2. M2M API拡張（ユーザーコンテキスト対応）

**ファイル**: `app/api/m2m/customers/search/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'
import { auditLog } from '@/lib/audit/logger'

interface UserContext {
  user_id: string
  email: string
  role: 'admin' | 'manager' | 'user' | 'viewer'
}

export async function POST(request: NextRequest) {
  try {
    // 1. OAuth2トークン検証
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    let decoded: any

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!)
    } catch (err) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 2. スコープチェック
    if (!decoded.scopes.includes('customers:read')) {
      return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
    }

    // 3. ユーザーコンテキスト取得（オプション）
    let userContext: UserContext | null = null
    const userContextHeader = request.headers.get('x-user-context')

    if (userContextHeader) {
      try {
        userContext = JSON.parse(userContextHeader)

        // ユーザーマッピング: 外部user_idを内部user_idに変換
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('external_user_id', userContext.user_id)
          .single()

        if (profile) {
          userContext.user_id = profile.id // 内部IDに置き換え
          userContext.role = profile.role
        } else {
          // 新規ユーザーの場合、プロファイル自動作成（オプション）
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              external_user_id: userContext.user_id,
              email: userContext.email,
              role: userContext.role,
              display_name: userContext.email.split('@')[0]
            })
            .select()
            .single()

          if (newProfile) {
            userContext.user_id = newProfile.id
          }
        }
      } catch (err) {
        console.error('Failed to parse user context:', err)
      }
    }

    // 4. リクエストボディ解析
    const body = await request.json()
    const { query, limit = 20 } = body

    // 5. 検索実行
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let queryBuilder = supabase
      .from('customers')
      .select('id, customer_code, name, customer_type, created_at')
      .or(`name.ilike.%${query}%,customer_code.ilike.%${query}%`)
      .limit(limit)

    // ユーザーコンテキストがある場合、RLS相当のフィルタを適用
    if (userContext && userContext.role !== 'admin' && userContext.role !== 'manager') {
      queryBuilder = queryBuilder.eq('owner_user_id', userContext.user_id)
    }

    const { data: customers, error } = await queryBuilder

    if (error) {
      throw error
    }

    // 6. 監査ログ記録
    if (userContext) {
      await auditLog({
        userId: userContext.user_id,
        entity: 'customers',
        action: 'search',
        entityId: null,
        metadata: {
          query,
          result_count: customers.length,
          client_id: decoded.client_id,
          via: 'm2m_api'
        }
      })
    }

    return NextResponse.json({
      customers,
      total: customers.length
    }, {
      headers: {
        'Cache-Control': 'no-store'
      }
    })

  } catch (error) {
    console.error('M2M API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### 3. データベーススキーマ拡張

**ファイル**: `database/migrations/020_external_user_mapping.sql`

```sql
-- ユーザーマッピング用カラム追加
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS external_user_id TEXT UNIQUE;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_profiles_external_user_id
ON profiles(external_user_id);

-- コメント追加
COMMENT ON COLUMN profiles.external_user_id IS '連携サービスのユーザーID（マッピング用）';
```

---

### 連携サービス側の実装

#### フロントエンド（Next.js）

**ファイル**: `app/customers/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CustomersPage() {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)

  const searchCustomers = async () => {
    setLoading(true)

    try {
      // 自サービスのBFF経由で顧客管理システムにアクセス
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/customers/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      })

      const data = await response.json()
      setCustomers(data.customers)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="顧客名で検索"
      />
      <button onClick={searchCustomers} disabled={loading}>
        {loading ? '検索中...' : '検索'}
      </button>

      <ul>
        {customers.map((customer: any) => (
          <li key={customer.id}>
            {customer.name} ({customer.customer_code})
          </li>
        ))}
      </ul>
    </div>
  )
}
```

#### バックエンド（BFF）

**ファイル**: `app/api/customers/search/route.ts`

（前述のサンプルコードを参照）

---

## セキュリティ考慮事項

### 1. OAuth2 Client Credentials管理

```bash
# 環境変数例（連携サービス側）
OAUTH2_CLIENT_ID=order-service-client-id
OAUTH2_CLIENT_SECRET=<強力なランダム文字列>
CUSTOMER_MGMT_API_URL=https://customer-management.example.com
```

**セキュリティベストプラクティス**:
- ✅ Client Secretは32文字以上のランダム文字列
- ✅ Client Secretは環境変数で管理（コミット禁止）
- ✅ 定期的なシークレットローテーション（3ヶ月ごと推奨）
- ✅ スコープ最小化（必要な権限のみ付与）

### 2. ユーザーコンテキスト検証

```typescript
// X-User-Context ヘッダーの署名検証（オプション）
import crypto from 'crypto'

function signUserContext(userContext: UserContext, secret: string): string {
  const payload = JSON.stringify(userContext)
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return Buffer.from(JSON.stringify({
    payload: userContext,
    signature
  })).toString('base64')
}

function verifyUserContext(signedContext: string, secret: string): UserContext | null {
  try {
    const decoded = JSON.parse(Buffer.from(signedContext, 'base64').toString())
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(decoded.payload))
      .digest('hex')

    if (expectedSignature === decoded.signature) {
      return decoded.payload
    }
  } catch (err) {
    return null
  }

  return null
}
```

### 3. IP Allowlist設定

```typescript
// lib/middleware/ipAllowlist.ts（顧客管理システム側）
const ALLOWED_IPS = process.env.M2M_ALLOWED_IPS?.split(',') || []

export function checkIPAllowlist(request: NextRequest): boolean {
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                   request.headers.get('x-real-ip') ||
                   'unknown'

  if (ALLOWED_IPS.length === 0) {
    return true // Allowlist未設定の場合は許可
  }

  return ALLOWED_IPS.some(allowedIP => {
    if (allowedIP.includes('/')) {
      // CIDR形式（例: 203.0.113.0/24）
      return isIPInCIDR(clientIP, allowedIP)
    }
    return clientIP === allowedIP
  })
}
```

### 4. レート制限

```typescript
// lib/middleware/rateLimit.ts（顧客管理システム側）
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100リクエスト/分
  analytics: true
})

export async function checkRateLimit(clientId: string): Promise<boolean> {
  const { success } = await ratelimit.limit(clientId)
  return success
}
```

---

## サンプルコード: 完全な実装例

### 顧客登録API（M2M）

**ファイル**: `app/api/m2m/customers/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { auditLog } from '@/lib/audit/logger'

// バリデーションスキーマ
const createCustomerSchema = z.object({
  customer_code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  customer_type: z.enum(['顧客', 'スタッフ', 'サポート', '社員', '代理店', 'その他']),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    // 1. OAuth2トークン検証
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    let decoded: any

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!)
    } catch (err) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 2. スコープチェック
    if (!decoded.scopes.includes('customers:write')) {
      return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
    }

    // 3. ユーザーコンテキスト取得
    const userContextHeader = request.headers.get('x-user-context')
    if (!userContextHeader) {
      return NextResponse.json({ error: 'Missing user context' }, { status: 400 })
    }

    const userContext = JSON.parse(userContextHeader)

    // ユーザーマッピング
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('external_user_id', userContext.user_id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 4. リクエストボディ検証
    const body = await request.json()
    const validatedData = createCustomerSchema.parse(body)

    // 5. 顧客作成
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        ...validatedData,
        owner_user_id: profile.id, // 内部IDを使用
        team_id: null // 必要に応じて設定
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // 6. 監査ログ記録
    await auditLog({
      userId: profile.id,
      entity: 'customers',
      action: 'create',
      entityId: customer.id,
      metadata: {
        client_id: decoded.client_id,
        via: 'm2m_api'
      },
      newValue: customer
    })

    return NextResponse.json({
      customer
    }, {
      status: 201,
      headers: {
        'Cache-Control': 'no-store'
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('M2M API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## まとめ

### 推奨実装

1. **OAuth2 Client Credentials** でサービス間認証
2. **X-User-Context ヘッダー** でユーザー情報伝搬
3. **external_user_id マッピング** で別Supabase Authプロジェクトと連携
4. **IP Allowlist + レート制限** でセキュリティ強化

### メリット

- ✅ エンドユーザーはシームレスに利用可能（1回ログインのみ）
- ✅ セキュリティ強固（M2M認証 + ユーザーコンテキスト検証）
- ✅ 監査ログ・RLS適用可能（実ユーザー特定）
- ✅ スケーラブル（複数サービスから同時接続可能）

### 次のステップ

1. OAuth2 Client Credentialsエンドポイント実装
2. M2M API拡張（ユーザーコンテキスト対応）
3. データベーススキーマ拡張（external_user_id）
4. 連携サービス側のBFF実装
5. セキュリティテスト（OAuth2検証、IP Allowlist、レート制限）

---

**最終更新**: 2025-10-27
**バージョン**: 1.0
