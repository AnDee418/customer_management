# Render デプロイガイド - FastAPI Integration Service

## 概要

このガイドでは、FastAPI Integration Service（外部API連携サービス）をRenderにデプロイする手順を説明します。

## 前提条件

- ✅ Renderアカウントを作成済み
- ✅ GitHubリポジトリに `customer_management` プロジェクトがプッシュ済み
- ✅ VercelにNext.js BFFがデプロイ済み（`customer_api_base_url` として使用）
- ✅ Supabaseプロジェクトが稼働中

## デプロイ手順

### ステップ1: Renderで新しいWeb Serviceを作成

1. **Renderダッシュボードにアクセス**
   - https://dashboard.render.com にログイン

2. **新しいWeb Serviceを作成**
   - 「New +」ボタンをクリック
   - 「Web Service」を選択

3. **リポジトリを接続**
   - GitHubアカウントを接続（初回のみ）
   - `customer_management` リポジトリを選択
   - 「Connect」をクリック

### ステップ2: サービス設定

#### 基本設定

| 項目 | 設定値 |
|------|--------|
| **Name** | `customer-mgmt-integration` （任意の名前） |
| **Region** | `Singapore` または `Oregon`（日本に近いリージョン） |
| **Branch** | `main` または `master` |
| **Root Directory** | `services/integration` ⭐重要 |
| **Runtime** | `Docker` |

#### ビルド設定

| 項目 | 設定値 |
|------|--------|
| **Dockerfile Path** | `services/integration/Dockerfile` |

または、Dockerを使わない場合：

| 項目 | 設定値 |
|------|--------|
| **Runtime** | `Python 3.11` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

#### プラン選択

- 開発環境: **Free** プラン（制限あり、スリープあり）
- 本番環境: **Starter** プラン（月$7〜、常時稼働）

### ステップ3: 環境変数設定

「Environment Variables」セクションで以下を設定：

#### 必須の環境変数

```bash
# Supabase設定
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 顧客管理サービス内部API（VercelのURL）
customer_api_base_url=https://your-app.vercel.app

# Webhook署名検証
webhook_secret=your-webhook-secret-key-here

# 基本設定
DEBUG=false
LOG_LEVEL=INFO
ALLOWED_ORIGINS=["https://your-app.vercel.app"]
```

#### オプション（外部API連携を使用する場合）

```bash
# 外部API設定
external_ordering_api_url=https://external-ordering-api.example.com
external_measurement_api_url=https://external-measurement-api.example.com
external_api_key=your-external-api-key-here

# OAuth2認証（今後実装予定）
oauth2_token_url=
oauth2_client_id=
oauth2_client_secret=
```

#### 環境変数の追加方法

1. 「Add Environment Variable」をクリック
2. Key（変数名）と Value（値）を入力
3. すべての変数を追加

**セキュリティ重要**:
- `SUPABASE_SERVICE_ROLE_KEY` は秘密情報です。漏洩しないように注意
- `webhook_secret` も外部と共有する秘密鍵です

### ステップ4: デプロイ実行

1. すべての設定を確認
2. 「Create Web Service」をクリック
3. 自動的にビルド・デプロイが開始されます

### ステップ5: デプロイ確認

#### ログ確認

Renderダッシュボードの「Logs」タブでビルド状況を確認：

```
Building...
Successfully built image
Starting service...
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

#### ヘルスチェック

デプロイ完了後、以下のURLにアクセスしてヘルスチェック：

```
https://customer-mgmt-integration.onrender.com/health
```

期待されるレスポンス：
```json
{
  "status": "healthy",
  "service": "integration"
}
```

#### エンドポイント確認

以下のエンドポイントが利用可能か確認：

- `GET /health` - ヘルスチェック
- `POST /webhooks/orders` - 発注Webhook受信
- `POST /webhooks/measurements` - 測定Webhook受信
- `POST /sync/orders` - 発注データ差分同期
- `POST /sync/measurements` - 測定データ差分同期

## Webhook URLの設定

RenderにデプロイしたURLを外部システムに設定します：

### 外部発注システム

```
Webhook URL: https://customer-mgmt-integration.onrender.com/webhooks/orders
Method: POST
Headers:
  - Content-Type: application/json
  - X-Signature: <HMAC SHA256署名>
```

### 外部測定システム

```
Webhook URL: https://customer-mgmt-integration.onrender.com/webhooks/measurements
Method: POST
Headers:
  - Content-Type: application/json
  - X-Signature: <HMAC SHA256署名>
```

## トラブルシューティング

### ビルドが失敗する

**エラー**: `No such file or directory: requirements.txt`

**解決策**: Root Directoryが正しく設定されているか確認
```
Root Directory: services/integration
```

### 起動が失敗する

**エラー**: `ModuleNotFoundError: No module named 'app'`

**解決策**: Start Commandを確認
```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 環境変数が読み込まれない

**確認項目**:
1. 環境変数名が正確か（大文字小文字を区別）
2. すべての必須変数が設定されているか
3. Renderのダッシュボードで「Environment」タブを確認

### Webhook受信が失敗する

**確認項目**:
1. `webhook_secret` が外部システムと一致しているか
2. 外部システムが正しいURLに送信しているか
3. Renderのログで詳細なエラーメッセージを確認

## パフォーマンス・スケーリング

### 無料プランの制限

- **スリープ**: 15分間リクエストがないとスリープ
- **起動時間**: スリープ解除に30秒〜1分かかる
- **メモリ**: 512MB

### 本番環境推奨設定

- **プラン**: Starter以上（$7/月〜）
- **インスタンス数**: 2以上（冗長性のため）
- **ヘルスチェック**: 有効化
- **Auto-Deploy**: mainブランチへのプッシュで自動デプロイ

## セキュリティ設定

### IP制限（オプション）

特定のIPアドレスからのみアクセスを許可する場合：

1. Renderダッシュボードで「Settings」→「Allowed IP Addresses」
2. 外部システムのIPアドレスを追加

### HTTPS強制

Renderは自動的にHTTPSを有効化しますが、HTTPリクエストを拒否する場合：

```python
# app/main.pyに追加
@app.middleware("http")
async def enforce_https(request: Request, call_next):
    if request.url.scheme != "https" and not request.url.hostname in ["localhost", "127.0.0.1"]:
        return JSONResponse({"error": "HTTPS required"}, status_code=403)
    return await call_next(request)
```

## 監視・アラート

### ログ監視

Renderダッシュボードの「Logs」タブでリアルタイムログを確認

### アラート設定

Renderの「Notifications」で以下を設定可能：
- デプロイ失敗通知
- サービスダウン通知
- Slack/Discord連携

### カスタムメトリクス

外部監視サービス（DataDog、New Relicなど）との統合も可能

## デプロイ後のテスト

### 1. ヘルスチェック

```bash
curl https://customer-mgmt-integration.onrender.com/health
```

### 2. Webhook受信テスト

```bash
# テスト用ペイロード送信
curl -X POST https://customer-mgmt-integration.onrender.com/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Signature: <計算したHMAC署名>" \
  -d '{
    "event_id": "test-001",
    "event_type": "order.updated",
    "timestamp": "2025-10-24T12:00:00Z",
    "data": {
      "external_order_id": "ORD-TEST-001",
      "customer_code": "CUST-001",
      "title": "テスト発注",
      "status": "pending",
      "ordered_at": "2025-10-24T12:00:00Z"
    }
  }'
```

### 3. 差分同期テスト

```bash
curl -X POST https://customer-mgmt-integration.onrender.com/sync/orders \
  -H "Content-Type: application/json" \
  -d '{
    "updated_since": "2025-10-01T00:00:00Z"
  }'
```

## 環境変数一覧（チェックリスト）

デプロイ前に以下をすべて設定したか確認：

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `customer_api_base_url`（VercelのURL）
- [ ] `webhook_secret`
- [ ] `DEBUG`
- [ ] `LOG_LEVEL`
- [ ] `ALLOWED_ORIGINS`
- [ ] `external_ordering_api_url`（オプション）
- [ ] `external_measurement_api_url`（オプション）
- [ ] `external_api_key`（オプション）

## 次のステップ

1. **Vercel環境変数の更新**: VercelにRenderのURLを設定（必要に応じて）
2. **外部システムにWebhook URL登録**: 実際の外部APIシステムにRenderのURLを登録
3. **本番データでテスト**: 実際のデータでWebhook受信・処理をテスト
4. **監視設定**: ログ監視・アラート設定を完了

---

**参考リンク**:
- [Render公式ドキュメント](https://render.com/docs)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Render Pythonガイド](https://render.com/docs/deploy-fastapi)

---

最終更新: 2025-10-24
