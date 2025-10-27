# 顧客管理システム API仕様書（外部システム連携用）

**バージョン**: v1.0
**最終更新**: 2025-10-27
**対象読者**: 外部システム開発者

---

## 目次

1. [概要](#概要)
2. [認証方法](#認証方法)
3. [ユーザーコンテキストの送信](#ユーザーコンテキストの送信)
4. [APIエンドポイント](#apiエンドポイント)
5. [エラーコード](#エラーコード)
6. [レート制限とIP制限](#レート制限とip制限)
7. [セキュリティベストプラクティス](#セキュリティベストプラクティス)
8. [実装サンプルコード](#実装サンプルコード)
9. [トラブルシューティング](#トラブルシューティング)
10. [FAQ](#faq)

---

## 概要

### このAPIについて

顧客管理システムのM2M（Machine-to-Machine）APIは、外部マイクロサービスから顧客データへ安全にアクセスするためのインターフェースです。

### 主な特徴

- **OAuth2 Client Credentials認証**: 業界標準の認証方式
- **ユーザーコンテキスト伝搬**: エンドユーザー情報の追跡が可能
- **レート制限**: システム保護のための制限あり
- **監査ログ**: すべての操作が記録されます

### 利用シーン

- 発注システムから顧客情報を検索・参照
- 測定システムから顧客情報を登録・更新
- その他マイクロサービスからの顧客データアクセス

### ベースURL

```
本番環境: https://customer-management.example.com
開発環境: https://customer-management-dev.example.com
```

---

## 認証方法

### OAuth2 Client Credentials Flow

すべてのM2M APIリクエストには、OAuth2アクセストークンが必要です。

#### ステップ1: クライアント認証情報の取得

システム管理者から以下の情報を受け取ってください：

- `CLIENT_ID`: クライアントID（例: `order-service-client-id`）
- `CLIENT_SECRET`: クライアントシークレット（32文字以上のランダム文字列）

⚠️ **重要**: `CLIENT_SECRET`は絶対に公開しないでください。環境変数で管理してください。

#### ステップ2: アクセストークンの取得

```http
POST /api/oauth2/token HTTP/1.1
Host: customer-management.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&scope=customers:read customers:write
```

**リクエストパラメータ**:

| パラメータ | 必須 | 説明 |
|----------|------|------|
| `grant_type` | ✅ | 固定値: `client_credentials` |
| `client_id` | ✅ | 発行されたクライアントID |
| `client_secret` | ✅ | 発行されたクライアントシークレット |
| `scope` | 任意 | スペース区切りのスコープ（省略時は全スコープ付与） |

**利用可能なスコープ**:

| スコープ | 説明 |
|---------|------|
| `customers:read` | 顧客データの検索・参照 |
| `customers:write` | 顧客データの作成・更新 |

**レスポンス例（成功）**:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "customers:read customers:write"
}
```

**レスポンス例（エラー）**:

```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed"
}
```

#### ステップ3: アクセストークンの使用

取得したアクセストークンを、すべてのAPIリクエストの`Authorization`ヘッダーに含めます。

```http
GET /api/m2m/customers/search?q=山田 HTTP/1.1
Host: customer-management.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### トークンの有効期限

- **有効期限**: 1時間（3600秒）
- **推奨**: トークンをキャッシュして再利用してください
- **期限切れ時**: 401エラーが返されるので、新しいトークンを取得してください

---

## ユーザーコンテキストの送信

### ユーザーコンテキストとは

エンドユーザーが外部システムのUIを操作して顧客データにアクセスする場合、そのユーザー情報を顧客管理システムに伝える必要があります。

### X-User-Contextヘッダー

ユーザー情報を`X-User-Context`ヘッダーに**JSON形式**で含めます。

```http
GET /api/m2m/customers/search?q=山田 HTTP/1.1
Host: customer-management.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-User-Context: {"user_id":"external-user-123","email":"user@example.com","role":"user"}
```

### X-User-Context の構造

```typescript
{
  "user_id": string,      // 必須: 外部システムのユーザーID
  "email": string,        // 必須: ユーザーのメールアドレス
  "role": string,         // 必須: ユーザーロール（admin/manager/user/viewer/agency）
  "display_name": string, // 任意: 表示名
  "team_id": string       // 任意: 所属チームID
}
```

**ロール一覧**:

| ロール | 説明 | データアクセス範囲 |
|--------|------|------------------|
| `admin` | 管理者 | すべての顧客データ |
| `manager` | マネージャー | すべての顧客データ |
| `user` | 一般ユーザー | 自分が作成した顧客データのみ |
| `viewer` | 閲覧者 | 自分が作成した顧客データのみ（読取専用） |
| `agency` | 代理店 | 自分が作成した顧客データのみ |

### 自動ユーザープロビジョニング

初回アクセス時、顧客管理システムは外部ユーザーIDを自動的に内部システムにマッピングします。

**フロー**:
1. 外部システムから`X-User-Context`ヘッダー付きリクエスト受信
2. 外部ユーザーIDで顧客管理システムのユーザーを検索
3. 存在しない場合、新規ユーザーを自動作成
4. 内部ユーザーIDにマッピングして処理

⚠️ **注意**: 顧客作成API（POST）は`X-User-Context`が**必須**です。

---

## APIエンドポイント

### 1. 顧客検索API

既存の顧客データを検索します。

#### エンドポイント

```
GET /api/m2m/customers/search
```

#### 必要なスコープ

`customers:read`

#### クエリパラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|----------|------|-----------|------|
| `q` | 任意 | - | 検索キーワード（顧客名、コード） |
| `limit` | 任意 | 50 | 取得件数（最大100） |

#### リクエスト例

```http
GET /api/m2m/customers/search?q=山田&limit=20 HTTP/1.1
Host: customer-management.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-User-Context: {"user_id":"external-user-123","email":"user@example.com","role":"user"}
```

#### レスポンス例（成功）

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "山田太郎",
    "code": "C00001",
    "created_at": "2025-01-15T10:30:00Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "山田花子",
    "code": "C00002",
    "created_at": "2025-01-16T14:20:00Z"
  }
]
```

#### レスポンスフィールド

| フィールド | 型 | 説明 |
|----------|-----|------|
| `id` | UUID | 顧客ID |
| `name` | string | 顧客名 |
| `code` | string | 顧客コード |
| `created_at` | datetime | 作成日時（ISO 8601形式） |

#### エラーレスポンス例

```json
{
  "error": "invalid_token",
  "error_description": "Token verification failed"
}
```

#### レート制限

- **制限**: 100リクエスト/分/IPアドレス
- **超過時**: HTTPステータス429（Too Many Requests）

---

### 2. 顧客作成API

新規顧客データを作成します。

#### エンドポイント

```
POST /api/m2m/customers
```

#### 必要なスコープ

`customers:write`

#### 必須ヘッダー

- `Authorization`: Bearer トークン
- `X-User-Context`: ユーザー情報（**必須**）
- `Content-Type`: application/json

#### リクエストボディ

```json
{
  "name": "山田太郎",
  "name_kana": "ヤマダタロウ",
  "customer_type": "顧客",
  "email": "yamada@example.com",
  "phone": "090-1234-5678",
  "postal_code": "100-0001",
  "prefecture": "東京都",
  "city": "千代田区",
  "address_line1": "千代田1-1-1",
  "address_line2": "○○ビル3F",
  "birth_date": "1990-01-01",
  "gender": "male",
  "notes": "備考欄"
}
```

#### リクエストフィールド

| フィールド | 型 | 必須 | 説明 |
|----------|-----|------|------|
| `customer_code` | string | 任意 | 顧客コード（省略時は自動生成） |
| `name` | string | ✅ | 顧客名（1-200文字） |
| `name_kana` | string | 任意 | 顧客名カナ（最大200文字） |
| `customer_type` | string | ✅ | 顧客タイプ（後述） |
| `email` | string | 任意 | メールアドレス |
| `phone` | string | 任意 | 電話番号（最大20文字） |
| `postal_code` | string | 任意 | 郵便番号（最大10文字） |
| `prefecture` | string | 任意 | 都道府県（最大10文字） |
| `city` | string | 任意 | 市区町村（最大100文字） |
| `address_line1` | string | 任意 | 住所1（最大200文字） |
| `address_line2` | string | 任意 | 住所2（最大200文字） |
| `birth_date` | string | 任意 | 生年月日（YYYY-MM-DD形式） |
| `gender` | string | 任意 | 性別（male/female/other） |
| `notes` | string | 任意 | 備考 |

**customer_type の値**:

- `顧客`
- `スタッフ`
- `サポート`
- `社員`
- `代理店`
- `その他`

#### リクエスト例

```http
POST /api/m2m/customers HTTP/1.1
Host: customer-management.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-User-Context: {"user_id":"external-user-123","email":"user@example.com","role":"user"}
Content-Type: application/json

{
  "name": "山田太郎",
  "customer_type": "顧客",
  "email": "yamada@example.com",
  "phone": "090-1234-5678"
}
```

#### レスポンス例（成功）

```json
{
  "customer": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_code": "C00123",
    "name": "山田太郎",
    "customer_type": "顧客",
    "created_at": "2025-10-27T12:00:00Z",
    "updated_at": "2025-10-27T12:00:00Z"
  }
}
```

#### エラーレスポンス例

**バリデーションエラー**:
```json
{
  "error": "Validation error",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "number",
      "path": ["name"],
      "message": "Expected string, received number"
    }
  ]
}
```

**重複エラー**:
```json
{
  "error": "Customer with this code already exists"
}
```

**ユーザーコンテキスト不足**:
```json
{
  "error": "X-User-Context header is required for creating customers"
}
```

#### レート制限

- **制限**: 20リクエスト/分/IPアドレス
- **超過時**: HTTPステータス429（Too Many Requests）

---

## エラーコード

### HTTPステータスコード

| コード | 説明 | 対応方法 |
|-------|------|---------|
| 200 | 成功 | - |
| 201 | 作成成功 | - |
| 400 | リクエストエラー | リクエスト内容を確認してください |
| 401 | 認証エラー | トークンを確認してください |
| 403 | 権限不足 | スコープまたはIP制限を確認してください |
| 404 | リソースが見つからない | リクエストURLを確認してください |
| 409 | 競合（重複） | 顧客コードが既に存在します |
| 429 | レート制限超過 | しばらく待ってから再試行してください |
| 500 | サーバーエラー | システム管理者に連絡してください |

### OAuth2エラーコード

| エラーコード | 説明 | 対応方法 |
|------------|------|---------|
| `invalid_request` | リクエストパラメータ不足 | 必須パラメータを確認してください |
| `invalid_client` | クライアント認証失敗 | CLIENT_IDとCLIENT_SECRETを確認してください |
| `invalid_grant` | グラントタイプ無効 | grant_type=client_credentialsを使用してください |
| `invalid_scope` | スコープ無効 | 許可されたスコープを確認してください |
| `unauthorized_client` | 認可されていないクライアント | システム管理者に連絡してください |
| `unsupported_grant_type` | サポートされていないグラントタイプ | client_credentialsのみサポートしています |
| `server_error` | サーバーエラー | システム管理者に連絡してください |

### APIエラーコード

| エラーコード | 説明 | 対応方法 |
|------------|------|---------|
| `invalid_token` | トークンが無効または期限切れ | 新しいトークンを取得してください |
| `insufficient_scope` | スコープ不足 | 必要なスコープを持つトークンを取得してください |
| `validation_error` | バリデーションエラー | detailsフィールドで詳細を確認してください |

---

## レート制限とIP制限

### レート制限

APIコールの頻度には制限があります。

| エンドポイント | 制限 |
|--------------|-----|
| OAuth2トークン取得 | 10リクエスト/分/クライアント |
| 顧客検索API | 100リクエスト/分/IPアドレス |
| 顧客作成API | 20リクエスト/分/IPアドレス |

### レスポンスヘッダー

レート制限に関する情報はレスポンスヘッダーで確認できます。

```http
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698412800
```

| ヘッダー | 説明 |
|---------|------|
| `X-RateLimit-Remaining` | 残りリクエスト数 |
| `X-RateLimit-Reset` | リセット時刻（UNIXタイムスタンプ） |

### レート制限超過時

```json
{
  "error": "Too many requests",
  "resetAt": 1698412800
}
```

**対応方法**:
1. `resetAt`の時刻まで待つ
2. エクスポネンシャルバックオフで再試行
3. リクエストをバッチ化して回数を削減

### IP制限

セキュリティのため、特定のIPアドレスからのみアクセス可能です。

**アクセス可能なIP追加方法**:
システム管理者に以下の情報を伝えてください：
- 外部システムの固定IPアドレスまたはCIDR範囲
- 用途（発注システム、測定システムなど）

---

## セキュリティベストプラクティス

### 1. クライアントシークレットの管理

✅ **推奨**:
- 環境変数で管理
- シークレット管理サービスを使用（AWS Secrets Manager、HashiCorp Vaultなど）
- 定期的なローテーション（3ヶ月ごと推奨）

❌ **禁止**:
- ソースコードにハードコーディング
- Gitリポジトリにコミット
- ログに出力

### 2. アクセストークンの管理

✅ **推奨**:
- メモリ内でキャッシュ
- 有効期限の管理（期限切れ前に更新）
- HTTPS通信のみ

❌ **禁止**:
- ローカルストレージに保存（Webブラウザの場合）
- ログに出力
- URLパラメータで送信

### 3. ユーザーコンテキストの検証

✅ **推奨**:
- 外部システム側でユーザー認証を実施してから送信
- ユーザーIDとメールアドレスの一致を確認
- 適切なロールを設定

❌ **禁止**:
- 未認証ユーザーの情報を送信
- 管理者ロールの不正使用
- 架空のユーザー情報を送信

### 4. エラーハンドリング

✅ **推奨**:
- すべてのエラーケースをハンドリング
- エクスポネンシャルバックオフで再試行
- ユーザーに分かりやすいエラーメッセージ

### 5. 監査ログ

すべてのAPI操作は監査ログに記録されます。

**記録される情報**:
- 操作日時
- クライアントID
- 外部ユーザーID
- 操作内容（検索、作成など）
- 操作結果

---

## 実装サンプルコード

### TypeScript/JavaScript (Node.js)

#### トークン取得とキャッシュ

```typescript
import fetch from 'node-fetch'

interface OAuth2Token {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

class OAuth2Client {
  private baseUrl: string
  private clientId: string
  private clientSecret: string
  private cachedToken: OAuth2Token | null = null
  private tokenExpiresAt: number = 0

  constructor(baseUrl: string, clientId: string, clientSecret: string) {
    this.baseUrl = baseUrl
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  /**
   * アクセストークンを取得（キャッシュあり）
   */
  async getAccessToken(): Promise<string> {
    // キャッシュされたトークンが有効な場合は再利用
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken.access_token
    }

    // 新しいトークンを取得
    const response = await fetch(`${this.baseUrl}/api/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'customers:read customers:write'
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OAuth2 token fetch failed: ${error.error_description}`)
    }

    const token = await response.json() as OAuth2Token

    // キャッシュに保存（有効期限の1分前まで有効とする）
    this.cachedToken = token
    this.tokenExpiresAt = Date.now() + (token.expires_in * 1000)

    return token.access_token
  }
}

// 使用例
const oauth2Client = new OAuth2Client(
  'https://customer-management.example.com',
  process.env.CLIENT_ID!,
  process.env.CLIENT_SECRET!
)

async function searchCustomers(query: string, userContext: any) {
  const token = await oauth2Client.getAccessToken()

  const response = await fetch(
    `https://customer-management.example.com/api/m2m/customers/search?q=${encodeURIComponent(query)}&limit=20`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-Context': JSON.stringify(userContext)
      }
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Search failed: ${error.error}`)
  }

  return await response.json()
}

// 実行例
const userContext = {
  user_id: 'external-user-123',
  email: 'user@example.com',
  role: 'user'
}

searchCustomers('山田', userContext)
  .then(customers => console.log('検索結果:', customers))
  .catch(error => console.error('エラー:', error))
```

#### 顧客作成

```typescript
async function createCustomer(customerData: any, userContext: any) {
  const token = await oauth2Client.getAccessToken()

  const response = await fetch(
    'https://customer-management.example.com/api/m2m/customers',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-Context': JSON.stringify(userContext),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    }
  )

  if (!response.ok) {
    const error = await response.json()

    // バリデーションエラーの場合
    if (error.error === 'Validation error') {
      console.error('バリデーションエラー:', error.details)
    }

    throw new Error(`Customer creation failed: ${error.error}`)
  }

  return await response.json()
}

// 実行例
const customerData = {
  name: '山田太郎',
  customer_type: '顧客',
  email: 'yamada@example.com',
  phone: '090-1234-5678'
}

createCustomer(customerData, userContext)
  .then(result => console.log('作成成功:', result.customer))
  .catch(error => console.error('エラー:', error))
```

#### エクスポネンシャルバックオフ付き再試行

```typescript
async function fetchWithRetry<T>(
  fetchFn: () => Promise<Response>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchFn()

      // レート制限の場合は待機してリトライ
      if (response.status === 429) {
        const resetAt = parseInt(response.headers.get('X-RateLimit-Reset') || '0')
        const waitTime = Math.max(resetAt * 1000 - Date.now(), 1000)

        console.log(`レート制限超過。${waitTime}ms待機します...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }

      // 5xxエラーの場合はエクスポネンシャルバックオフでリトライ
      if (response.status >= 500) {
        const backoffTime = Math.pow(2, attempt) * 1000
        console.log(`サーバーエラー。${backoffTime}ms待機してリトライします...`)
        await new Promise(resolve => setTimeout(resolve, backoffTime))
        continue
      }

      // その他のエラーはリトライしない
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      return await response.json() as T
    } catch (error) {
      lastError = error as Error

      // 最後の試行でなければリトライ
      if (attempt < maxRetries - 1) {
        const backoffTime = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, backoffTime))
      }
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

// 使用例
const customers = await fetchWithRetry<any[]>(
  () => fetch(
    'https://customer-management.example.com/api/m2m/customers/search?q=山田',
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-Context': JSON.stringify(userContext)
      }
    }
  )
)
```

---

### Python

```python
import os
import time
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

class OAuth2Client:
    """OAuth2 Client Credentials認証クライアント"""

    def __init__(self, base_url: str, client_id: str, client_secret: str):
        self.base_url = base_url
        self.client_id = client_id
        self.client_secret = client_secret
        self.cached_token: Optional[Dict[str, Any]] = None
        self.token_expires_at: Optional[datetime] = None

    def get_access_token(self) -> str:
        """アクセストークンを取得（キャッシュあり）"""
        # キャッシュされたトークンが有効な場合は再利用
        if self.cached_token and self.token_expires_at:
            if datetime.now() < self.token_expires_at - timedelta(seconds=60):
                return self.cached_token['access_token']

        # 新しいトークンを取得
        response = requests.post(
            f'{self.base_url}/api/oauth2/token',
            data={
                'grant_type': 'client_credentials',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'scope': 'customers:read customers:write'
            }
        )

        if not response.ok:
            error = response.json()
            raise Exception(f"OAuth2 token fetch failed: {error.get('error_description')}")

        token = response.json()

        # キャッシュに保存
        self.cached_token = token
        self.token_expires_at = datetime.now() + timedelta(seconds=token['expires_in'])

        return token['access_token']


class CustomerManagementClient:
    """顧客管理システム APIクライアント"""

    def __init__(self, base_url: str, client_id: str, client_secret: str):
        self.base_url = base_url
        self.oauth2_client = OAuth2Client(base_url, client_id, client_secret)

    def search_customers(self, query: str, user_context: Dict[str, Any], limit: int = 20):
        """顧客を検索"""
        token = self.oauth2_client.get_access_token()

        response = requests.get(
            f'{self.base_url}/api/m2m/customers/search',
            params={'q': query, 'limit': limit},
            headers={
                'Authorization': f'Bearer {token}',
                'X-User-Context': json.dumps(user_context)
            }
        )

        if not response.ok:
            error = response.json()
            raise Exception(f"Search failed: {error.get('error')}")

        return response.json()

    def create_customer(self, customer_data: Dict[str, Any], user_context: Dict[str, Any]):
        """顧客を作成"""
        token = self.oauth2_client.get_access_token()

        response = requests.post(
            f'{self.base_url}/api/m2m/customers',
            headers={
                'Authorization': f'Bearer {token}',
                'X-User-Context': json.dumps(user_context),
                'Content-Type': 'application/json'
            },
            json=customer_data
        )

        if not response.ok:
            error = response.json()

            # バリデーションエラーの場合
            if error.get('error') == 'Validation error':
                print('バリデーションエラー:', error.get('details'))

            raise Exception(f"Customer creation failed: {error.get('error')}")

        return response.json()


# 使用例
import json

client = CustomerManagementClient(
    base_url='https://customer-management.example.com',
    client_id=os.environ['CLIENT_ID'],
    client_secret=os.environ['CLIENT_SECRET']
)

user_context = {
    'user_id': 'external-user-123',
    'email': 'user@example.com',
    'role': 'user'
}

# 顧客検索
customers = client.search_customers('山田', user_context)
print('検索結果:', customers)

# 顧客作成
customer_data = {
    'name': '山田太郎',
    'customer_type': '顧客',
    'email': 'yamada@example.com',
    'phone': '090-1234-5678'
}

result = client.create_customer(customer_data, user_context)
print('作成成功:', result['customer'])
```

---

### cURL

#### トークン取得

```bash
curl -X POST https://customer-management.example.com/api/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=customers:read customers:write"
```

#### 顧客検索

```bash
curl -X GET "https://customer-management.example.com/api/m2m/customers/search?q=山田&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-User-Context: {\"user_id\":\"external-user-123\",\"email\":\"user@example.com\",\"role\":\"user\"}"
```

#### 顧客作成

```bash
curl -X POST https://customer-management.example.com/api/m2m/customers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-User-Context: {\"user_id\":\"external-user-123\",\"email\":\"user@example.com\",\"role\":\"user\"}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "山田太郎",
    "customer_type": "顧客",
    "email": "yamada@example.com",
    "phone": "090-1234-5678"
  }'
```

---

## トラブルシューティング

### 問題1: トークン取得時に"invalid_client"エラー

**症状**:
```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed"
}
```

**原因**:
- CLIENT_IDまたはCLIENT_SECRETが間違っている
- 環境変数が正しく読み込まれていない

**解決方法**:
1. CLIENT_IDとCLIENT_SECRETをシステム管理者に確認
2. 環境変数が正しく設定されているか確認
3. リクエストボディのURLエンコードが正しいか確認

---

### 問題2: API呼び出し時に401エラー

**症状**:
```json
{
  "error": "invalid_token",
  "error_description": "Token verification failed"
}
```

**原因**:
- トークンが期限切れ
- トークンの形式が間違っている
- Authorizationヘッダーが正しくない

**解決方法**:
1. 新しいトークンを取得
2. Authorizationヘッダーが`Bearer <token>`形式か確認
3. トークンに余計な空白や改行が含まれていないか確認

---

### 問題3: API呼び出し時に403エラー

**症状**:
```json
{
  "error": "Forbidden: IP not allowed"
}
```

**原因**:
- アクセス元のIPアドレスが許可リストに登録されていない

**解決方法**:
1. システム管理者に連絡して、IPアドレスを許可リストに追加してもらう
2. 固定IPアドレスまたはIP範囲（CIDR）を伝える

---

### 問題4: 顧客作成時にバリデーションエラー

**症状**:
```json
{
  "error": "Validation error",
  "details": [
    {
      "code": "invalid_type",
      "path": ["customer_type"],
      "message": "Invalid enum value"
    }
  ]
}
```

**原因**:
- リクエストボディのフィールドの型や値が仕様と一致していない

**解決方法**:
1. `details`配列で具体的なエラー内容を確認
2. 仕様書の「リクエストフィールド」セクションを確認
3. 特に`customer_type`は指定された値のみ許可されています

---

### 問題5: レート制限超過（429エラー）

**症状**:
```json
{
  "error": "Too many requests",
  "resetAt": 1698412800
}
```

**原因**:
- API呼び出しが制限回数を超えた

**解決方法**:
1. `resetAt`の時刻まで待つ
2. リクエストをバッチ化して回数を削減
3. エクスポネンシャルバックオフで再試行を実装

---

### 問題6: X-User-Contextが必須エラー

**症状**:
```json
{
  "error": "X-User-Context header is required for creating customers"
}
```

**原因**:
- 顧客作成APIでX-User-Contextヘッダーが送信されていない

**解決方法**:
1. X-User-Contextヘッダーを追加
2. JSON形式でユーザー情報を含める
3. `user_id`、`email`、`role`フィールドが必須

---

## FAQ

### Q1: トークンはいつ更新すればいいですか？

**A**: トークンの有効期限は1時間（3600秒）です。期限切れ前に新しいトークンを取得することをお勧めします。サンプルコードでは、期限の1分前（59分経過時）に自動更新する実装例を提供しています。

---

### Q2: 複数のユーザーが同時にアクセスする場合、トークンはどう管理すればいいですか？

**A**: OAuth2 Client Credentialsトークンは「サービス間認証」用です。複数のエンドユーザーが同時にアクセスしても、同じトークンを共有できます。ユーザーの識別は`X-User-Context`ヘッダーで行います。

---

### Q3: X-User-Contextを送信しないとどうなりますか？

**A**:
- 顧客検索API: ユーザーコンテキストなしでも動作しますが、監査ログに記録されません
- 顧客作成API: エラーになります（X-User-Contextは必須）

---

### Q4: レート制限を緩和してもらえますか？

**A**: 正当な理由がある場合、システム管理者に相談してください。以下の情報を伝えてください：
- 現在のリクエスト頻度
- 必要なリクエスト頻度
- ユースケース

---

### Q5: 顧客コードは自動生成されますか？

**A**: はい。`customer_code`フィールドを省略すると、システムが自動的に生成します（例: C00001、C00002...）。独自のコード体系を使いたい場合は、明示的に指定してください。

---

### Q6: APIのバージョン管理はありますか？

**A**: 現在のバージョンはv1です。破壊的変更が必要な場合は、新しいバージョン（v2）を別エンドポイントで提供し、十分な移行期間を設けます。

---

### Q7: テスト環境はありますか？

**A**: はい。本番環境とは別に開発環境があります：
- 本番環境: `https://customer-management.example.com`
- 開発環境: `https://customer-management-dev.example.com`

開発環境用のCLIENT_IDとCLIENT_SECRETはシステム管理者から取得してください。

---

### Q8: 大量データの一括登録は可能ですか？

**A**: 現在のAPIは1件ずつの作成のみサポートしています。大量データの登録が必要な場合は、以下の方法を検討してください：
1. バックグラウンドジョブで複数回APIを呼び出す
2. レート制限内で並列処理を実装
3. システム管理者に一括インポート機能を相談

---

### Q9: 更新（PUT/PATCH）APIはありますか？

**A**: 現在のバージョンでは、検索（GET）と作成（POST）のみサポートしています。更新機能が必要な場合は、システム管理者に要望を伝えてください。

---

### Q10: エラーが解決できません。どこに連絡すればいいですか？

**A**: 以下の情報を用意して、システム管理者に連絡してください：
- エラーメッセージ（完全なレスポンス）
- リクエスト内容（CLIENT_SECRETは除く）
- 発生日時
- CLIENT_ID
- 外部システムのIPアドレス

---

## サポート

### 連絡先

- **システム管理者**: [システム管理者の連絡先]
- **技術サポート**: [技術サポートの連絡先]
- **ドキュメント**: https://docs.customer-management.example.com

### 更新履歴

| バージョン | 日付 | 変更内容 |
|----------|------|---------|
| v1.0 | 2025-10-27 | 初版リリース |

---

**最終更新**: 2025-10-27
**ドキュメントバージョン**: v1.0
