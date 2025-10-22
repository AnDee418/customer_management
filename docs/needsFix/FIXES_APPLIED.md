# 修正作業完了レポート (2025-10-20)

## 実施した修正

### ✅ P0 - セキュリティ（Critical/High）

#### 1. OAuth2トークン検証実装（JWT/JWKs）
**ファイル**: `lib/auth/oauth2.ts`

**修正内容**:
- `jose`ライブラリを使用したJWT検証を実装
- JWKSエンドポイントから公開鍵を取得して署名検証
- `exp`, `nbf`, `aud`, `iss`の検証を追加
- オプションでスコープチェック機能を追加
- 環境変数未設定時は開発用スタブモード（警告ログ出力）

**新規環境変数**:
```
OAUTH2_JWKS_URL=https://auth.example.com/.well-known/jwks.json
OAUTH2_ISSUER=https://auth.example.com
OAUTH2_AUDIENCE=customer-management-api
OAUTH2_REQUIRED_SCOPE=customer:read customer:write  # オプション
```

**影響範囲**:
- `/api/m2m/customers/search`
- `/api/internal/orders/upsert`
- `/api/internal/measurements/upsert`

---

#### 2. M2M: IP Allowlist・レート制限の適用
**ファイル**: `app/api/m2m/customers/search/route.ts`

**修正内容**:
- `getClientIP()` / `isIPAllowed()`によるIP Allowlist チェックを追加
- `checkRateLimit()`によるレート制限（100req/分）を適用
- 403（IP拒否）、429（レート超過）の適切な応答
- `X-RateLimit-Remaining`、`X-RateLimit-Reset`ヘッダーの追加
- 構造化ログによるセキュリティイベント記録

**セキュリティ強化**:
- 不正なIPからのアクセスをブロック
- ブルートフォース攻撃対策
- DoS攻撃の緩和

---

### ✅ P1 - データ整合性・運用

#### 3. 内部upsertにZodバリデーション追加
**ファイル**:
- `app/api/internal/orders/upsert/route.ts`
- `app/api/internal/measurements/upsert/route.ts`

**修正内容**:
- `upsertOrderSchema` / `upsertMeasurementSchema`による入力検証を追加
- 不正なペイロードに対して400エラー + 詳細エラーメッセージ
- スキーマドリフト、不正データ挿入の防止
- 構造化ログによるバリデーションエラー記録

**効果**:
- データ整合性の向上
- セキュリティリスク（oversized payload等）の軽減
- デバッグ容易性の向上

---

#### 4. .env.templateの作成
**ファイル**: `.env.template`（ルート）

**注意**: globalIgnoreによりファイル作成がブロックされたため、以下に内容を記載します。

**含まれる設定**:
- Supabase（Public/Service Role Key）
- OAuth2 Client Credentials（Token URL、JWKs URL、Issuer、Audience）
- 内部API認証
- M2M_ALLOWED_IPS、レート制限設定
- FastAPI連携サービス設定
- 外部API設定、Webhook Secret
- 環境別設定例（dev/staging/production）
- セキュリティチェックリスト

**推奨対応**:
手動で`.env.template`をプロジェクトルートに作成し、下記内容をコピーしてください。

```bash
# ======================================
# 社内顧客管理システム - 環境変数テンプレート
# ======================================

# Node環境
NODE_ENV=development
LOG_LEVEL=info

# Supabase（Public側）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase（サーバー側）
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# OAuth2 Client Credentials
OAUTH2_TOKEN_URL=https://auth.example.com/oauth/token
OAUTH2_JWKS_URL=https://auth.example.com/.well-known/jwks.json
OAUTH2_ISSUER=https://auth.example.com
OAUTH2_AUDIENCE=customer-management-api
OAUTH2_CLIENT_ID=customer-service
OAUTH2_CLIENT_SECRET=your-oauth2-client-secret
OAUTH2_REQUIRED_SCOPE=customer:read customer:write

# M2M参照API
M2M_ALLOWED_IPS=127.0.0.1
M2M_RATE_LIMIT_PER_MINUTE=100

# （その他FastAPI、外部API、Webhook設定省略）
```

---

### ✅ P2 - プライバシー・一貫性

#### 5. 監査ログのPIIマスキング拡張
**ファイル**: `lib/audit/logger.ts`

**修正内容**:
- `SENSITIVE_FIELDS`に`email`, `phone`, `address`, `credit_card`, `ssn`, `tax_id`を追加
- 正規表現ベースのPII検出機能を実装
  - Email: `***EMAIL***`
  - 電話番号: `***PHONE***`
  - クレジットカード番号（簡易）: `***CARD***`
- 文字列値内のPIIパターンも自動マスキング

**プライバシー強化**:
- キー名だけでなく値の内容からもPIIを検出
- 監査ログのコンプライアンス向上
- 誤ったPII露出リスクの低減

---

## 残TODO（次フェーズ）

### P0-3: Service-role Key露出の削減
**優先度**: High（ステージング前推奨）

**推奨対応**:
1. Postgres RPC関数を作成（`security definer`）
2. 内部routes（`/api/m2m/*`, `/api/internal/*`）でRPC呼び出しに切り替え
3. Service roleキーの直接使用を最小化

**例**:
```sql
create or replace function public.upsert_order_internal(
  p_customer_id uuid,
  p_external_order_id text,
  p_source_system text,
  p_title text,
  p_status text,
  p_ordered_at timestamptz
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
  insert into orders (customer_id, external_order_id, source_system, title, status, ordered_at)
  values (p_customer_id, p_external_order_id, p_source_system, p_title, p_status, p_ordered_at)
  on conflict (external_order_id, source_system)
  do update set
    title = excluded.title,
    status = excluded.status,
    ordered_at = excluded.ordered_at,
    updated_at = now()
  returning to_jsonb(orders.*) into result;
  
  return result;
end;
$$;
```

---

### P1: integration_jobs 記録実装
**優先度**: Medium（ステージング環境で検証推奨）

**推奨対応**:
- Webhook受信時に`integration_jobs`テーブルにレコードを挿入
- ステータス遷移: `queued` → `running` → `succeeded/failed`
- `attempts`, `last_error`を記録
- 後続フェーズでUI側で再試行機能を実装

---

### P2: M2M PIIフィールド最小化
**優先度**: Medium

**推奨対応**:
- `/api/m2m/customers/search`のレスポンスから`contact`, `address`を削除
- デフォルトフィールド: `id`, `name`, `code`, `created_at`
- オプションで`fields`パラメータを追加（allowlist制御）

---

### P3: Rate Limit外部化（本番環境）
**優先度**: Low→Medium（本番前）

**推奨対応**:
- Upstash RedisまたはVercel KVを使用
- マルチインスタンス間で一貫したレート制限
- 開発環境はメモリストア継続

---

## 検証項目

### セキュリティ検証
- [ ] 無効なJWTトークンで M2M API → 401応答
- [ ] 許可されていないIPから M2M API → 403応答
- [ ] レート制限超過で M2M API → 429応答
- [ ] 不正なペイロードで内部upsert → 400応答 + 詳細エラー

### 機能検証
- [ ] 有効なトークンで M2M API → 200応答
- [ ] 監査ログにPIIが`***MASKED***`で記録されることを確認
- [ ] X-RateLimit-Remainingヘッダーがレスポンスに含まれることを確認

### 環境設定検証
- [ ] `.env`に新規環境変数を追加
- [ ] 開発環境でOAuth2スタブモード動作を確認（警告ログ出力）
- [ ] ステージング環境で実際のJWT検証が動作することを確認

---

## まとめ

### 完了した修正（5項目）
✅ OAuth2トークン検証（JWT/JWKs）  
✅ M2M: IP Allowlist・レート制限  
✅ 内部upsertバリデーション  
✅ .env.template作成（内容記載済み）  
✅ 監査ログPIIマスキング拡張  

### セキュリティ向上
- M2M/内部APIの認証が実質的に機能（JWTベース）
- IP制限・レート制限によるDoS/ブルートフォース対策
- バリデーションによるインジェクション対策
- PIIマスキングによるプライバシー保護

### 次ステップ
1. `.env`ファイルに新規環境変数を追加
2. ステージング環境でセキュリティ検証を実施
3. P0-3（Service-role Key削減）をRPC化で対応
4. 本番デプロイ前にP3（Rate Limit外部化）を実施

---

最終更新: 2025-10-20  
修正バージョン: v0.9

