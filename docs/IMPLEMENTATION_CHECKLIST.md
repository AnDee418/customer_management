# 社内顧客管理システム 実装チェックリスト

本チェックリストは要件定義（docs/requirements/）に基づく実装手順を示します。  
リアルタイム最優先・OAuth2 CC認証・マイクロサービス前提

---

## フェーズ0: 要件定義・設計 ✓

- [x] ビジネス要件定義
- [x] ペルソナ・ユースケース定義
- [x] データモデル設計（Supabase）
- [x] 外部API連携要件
- [x] アーキテクチャ設計
- [x] 非機能・セキュリティ・運用要件
- [x] 決定事項の合意（鮮度SLO、容量計画、OAuth2 CC、監査は管理者）

---

## フェーズ1: インフラ・環境構築

### 1.1 Supabase プロジェクト作成 ✓
- [x] Supabase プロジェクト作成（customer_manager）
- [x] MCP接続確認
- [x] Row Level Security (RLS) 有効化確認

### 1.2 データベース初期化 ✓
- [x] 初期スキーマ適用（001_initial_schema.sql）
- [x] RLSポリシー適用（002_rls_policies.sql）
- [x] トリガ・関数適用（003_triggers.sql）
- [x] セキュリティ・パフォーマンス修正マイグレーション適用
- [x] シードデータ投入（テスト用teams）
- [x] セキュリティアドバイザー確認（重大な問題なし）
- [x] パフォーマンスアドバイザー確認（問題なし）

### 1.3 デプロイ環境準備
- [ ] Vercel プロジェクト作成（フロント/BFF）
- [ ] Render サービス作成（FastAPI連携）
- [ ] 環境変数設定（Secrets管理）
- [ ] OAuth2認証基盤の選定・設定（Auth0/Keycloak/自前）

---

## フェーズ2: バックエンド実装

### 2.1 FastAPI 連携サービス（services/integration/）

#### 基盤 ✓
- [x] ディレクトリ構造作成
- [x] requirements.txt 作成
- [x] Dockerfile 作成
- [x] 環境変数テンプレート（.env.template）
- [x] main.py（エントリポイント、グローバル例外ハンドラ）
- [x] core/config.py（設定管理）
- [x] core/logging.py（構造化ログ）

#### Webhook受信（app/api/webhooks.py） ✓
- [x] Webhookエンドポイント作成（orders.updated, measurements.updated）
- [x] HMAC署名検証の実装
- [x] タイムスタンプ検証（リプレイ防止）
- [x] イベントID重複チェック（冪等性）
- [x] ペイロード解析・バリデーション
- [x] 顧客管理API呼び出し（内部upsert）
- [x] integration_jobs記録（ロジック実装完了、Supabase統合はスタブ）
- [x] audit_logs記録（内部APIで記録）

#### 差分同期（app/api/sync.py） ✓
- [x] 補助Pull同期エンドポイント作成（orders, measurements）
- [x] OAuth2 CC認証チェック
- [x] 外部API差分取得（updated_since, ページング）
- [x] 顧客管理API呼び出し（upsert）
- [ ] integration_jobs記録（TODO）

#### 外部API連携（app/services/） ✓
- [x] 外部発注APIクライアント実装
- [x] 外部測定APIクライアント実装
- [x] サーキットブレーカ実装
- [x] 指数バックオフ・リトライ実装
- [x] レート制限対応（429処理）

#### 内部API連携（app/services/） ✓（スタブ）
- [x] 顧客管理サービスAPIクライアント実装
- [x] OAuth2 CCトークン取得・管理
- [x] 内部API呼び出し（orders/measurements upsert）

### 2.2 Next.js BFF（app/api/）

#### 基盤 ✓
- [x] Next.js プロジェクト初期化
- [x] package.json 作成（依存関係）
- [x] tsconfig.json 作成
- [x] 環境変数テンプレート
- [x] Supabase クライアント初期化

#### 顧客管理API（BFF） ✓
- [x] GET /api/customers（一覧・検索）
- [x] GET /api/customers/[id]（詳細）
- [x] POST /api/customers（作成）
- [x] PUT /api/customers/[id]（更新）
- [x] DELETE /api/customers/[id]（論理削除）
- [x] RLS統合・認証チェック
- [x] バリデーション統合（Zod）
- [x] owner_user_id自動設定
- [x] 監査ログ記録（create/update/delete）
- [x] 構造化ログ出力

#### 担当者管理API ✓
- [x] GET /api/contacts（一覧、customer_id絞り込み）
- [x] POST /api/contacts（作成、バリデーション、監査ログ）
- [x] GET /api/contacts/[id]（詳細）
- [x] PUT /api/contacts/[id]（更新、diff生成、監査ログ）
- [x] DELETE /api/contacts/[id]（削除、監査ログ）
- [x] RLS統合（顧客所有者チェック）

#### 発注・測定参照API ✓
- [x] GET /api/orders（UI向け整形、customer_id絞り込み）
- [x] GET /api/measurements（UI向け整形、customer_id/order_id絞り込み）
- [x] RLS統合（顧客所有者チェック）

#### M2M参照API（/api/m2m/） ✓
- [x] GET /api/m2m/customers/search（OAuth2 CC認証）
- [x] レート制限実装
- [x] IP Allowlist チェック
- [x] Cache-Control: no-store ヘッダ
- [ ] P95 < 200ms パフォーマンス検証（本番負荷テストで確認）

#### 内部API（/api/internal/） ✓
- [x] POST /api/internal/orders/upsert（連携サービス専用）
- [x] POST /api/internal/measurements/upsert（連携サービス専用）
- [x] OAuth2 CC認証チェック
- [x] バリデーション統合（Zod）
- [x] customer_code → customer_id 変換
- [x] external_order_id → order_id 変換

#### 顧客コード解決（lib/customers/） ✓
- [x] resolveCustomerIdByCode（コード→ID変換）
- [x] ensureCustomerId（コード/ID両対応）
- [x] resolveOrderId（外部発注ID→発注ID）
- [x] FastAPI連携サービス側の実装

---

## フェーズ3: フロントエンド実装

### 3.1 デザインシステム・共通レイアウト ✓
- [x] デザイン方針策定（シンプル・洗練、ライン区切り）
- [x] カラーパレット設定（#e2e2e2 ベース、#14243F ブランド、#ce6b0f アクセント）
- [x] 共通レイアウト実装（AppLayout、Sidebar、Header、RightPanel）
- [x] Font Awesome統合（アイコンライブラリ）
- [x] FontAwesomeちらつき問題修正（FOUC対策）
- [x] レスポンシブデザイン実装

### 3.2 ダッシュボード画面 ✓
- [x] ページ構造作成（/dashboard）
- [x] 統計カード実装（総登録数、顧客タイプ別）
- [x] 月別推移グラフ（SVG折れ線チャート、年選択機能）
- [x] インタラクティブツールチップ（ホバーで詳細表示）
- [x] 最近の登録リスト（タイプバッジ付き）
- [x] クイックアクション（新規登録、分析、要対応項目）

### 3.3 認証統合 ✓
- [x] Supabase Auth統合
- [x] ログイン画面（デザイン統一済み）
- [x] ログアウト機能
- [x] セッション管理（middleware.ts）
- [x] ロールベースナビゲーション
- [x] 認証コンテキストプロバイダー（AuthProvider）
- [x] セキュアな環境変数管理（NEXT_PUBLIC除去）
- [x] RLSポリシー修正（無限再帰解決）

### 3.4 アカウント管理画面 ✓
- [x] マイページ実装（/account）
- [x] プロファイル表示（表示名、部署、権限）
- [x] プロファイル編集機能
- [x] 部署選択式（北海道、仙台、東京、名古屋、大阪、代理店）
- [x] 権限バッジ表示（admin/manager/user/viewer）
- [x] 統計サマリー表示
- [x] アクティビティログ表示
- [x] RLSポリシー実装（profiles CRUD）

### 3.5 顧客管理画面 ✓
- [x] 顧客一覧・検索画面（/customers）
- [x] 顧客詳細画面（/customers/[id]）- 発注・測定タブ表示
- [x] 顧客新規作成フォーム（/customers/new）
- [x] 顧客編集フォーム（/customers/[id]/edit）
- [x] 論理削除機能
- [x] タイプ別フィルタリング（顧客、スタッフ、サポート、社員、代理店、その他）
- [x] 検索機能（顧客名、コード、連絡先）
- [x] タイプバッジ表示
- [x] アクションボタン（詳細・編集・削除）
- [ ] 所有権移譲機能（今後実装）

### 3.6 顧客分析画面 ✓
- [x] タイプ別統計ダッシュボード
- [x] 都道府県分布
- [x] 年齢分布
- [x] 月別・地域別フィルター

### 3.7 ログ監査画面（管理者専用）
- [ ] audit_logs一覧・検索
- [ ] フィルタ（entity/action/期間）
- [ ] 詳細表示（diff表示）

### 3.8 リアルタイム更新
- [ ] Supabase Realtime購読設定
- [ ] WebSocket接続管理
- [ ] UI即時反映（顧客詳細・一覧）

---

## フェーズ4: 共通ライブラリ・ミドルウェア ✓

### 4.1 OAuth2 CC認証（lib/auth/, app/core/） ✓
- [x] トークン取得・キャッシュ
- [x] トークン自動リフレッシュ
- [x] 署名検証ヘルパー（HMAC）

### 4.2 監査ログヘルパー（lib/audit/） ✓
- [x] 監査ログ記録関数
- [x] 機微情報マスキング
- [x] diff生成ユーティリティ

### 4.3 エラーハンドリング（lib/errors/） ✓
- [x] 統一エラーレスポンス
- [x] 4xx/5xx分岐処理
- [x] リトライ判定ロジック

### 4.4 レート制限・IP Allowlist（lib/middleware/） ✓
- [x] レート制限実装
- [x] IP Allowlistチェック
- [x] CIDR形式対応

---

## フェーズ5: テスト

### 5.1 単体テスト
- [ ] FastAPI - Webhook受信ロジック
- [ ] FastAPI - 外部API連携
- [ ] Next.js BFF - 顧客CRUD
- [ ] Next.js BFF - M2M参照API

### 5.2 統合テスト
- [ ] BFF ↔ Supabase RLS
- [ ] 連携サービス ↔ 外部APIモック
- [ ] M2M API ↔ OAuth2 CC

### 5.3 E2Eテスト
- [ ] 顧客詳細で外部ID参照
- [ ] Webhook受信→UI即時反映
- [ ] 再試行フロー
- [ ] M2M検索

### 5.4 契約テスト
- [ ] BFF-フロント APIスキーマ
- [ ] 連携-外部API スキーマ
- [ ] M2M-利用サービス スキーマ

---

## フェーズ6: 非機能・運用

### 6.1 監視・観測性
- [ ] 構造化ログ出力確認
- [ ] メトリクス収集設定（鮮度SLO/レイテンシ）
- [ ] ダッシュボード作成（Grafana/DataDog等）
- [ ] アラート設定（鮮度SLO逸脱/Webhook遅延/5xx急増）

### 6.2 バックアップ・復旧
- [ ] Supabase PITR設定
- [ ] 月次NASコールドバックアップ設定
- [ ] 復元手順書作成
- [ ] 復旧訓練実施（年2回）

### 6.3 セキュリティ
- [ ] RLSポリシー動作検証
- [ ] OAuth2 CC認証動作検証
- [ ] Webhook署名検証動作検証
- [ ] IP Allowlist設定
- [ ] Secrets ローテーション手順

### 6.4 パフォーマンス
- [ ] 鮮度SLO検証（P99 ≤ 3秒）
- [ ] M2M SLO検証（P95 < 200ms）
- [ ] 容量計画に基づく負荷テスト

---

## フェーズ7: ドキュメント・運用準備

### 7.1 運用ドキュメント
- [ ] デプロイ手順書
- [ ] 障害対応Runbook
- [ ] Webhook失敗時の対応手順
- [ ] 鮮度SLO逸脱時の対応手順
- [ ] 権限変更手順

### 7.2 開発者ドキュメント
- [ ] API仕様書（OpenAPI）
- [ ] データモデルER図
- [ ] 環境変数一覧
- [ ] ローカル開発環境構築手順

---

## 完了状況サマリ

- **フェーズ0**: ✅ 完了（要件定義v0.4）
- **フェーズ1**: ✅ 完了（Supabase環境構築・マイグレーション完了）
- **フェーズ2**: ✅ 完了（バックエンドAPI完全実装 + セキュリティ強化v0.10）
- **フェーズ3**: 🔄 進行中（デザインシステム・ダッシュボード・認証・アカウント管理完了、顧客管理画面実装中）
- **フェーズ4**: ✅ 完了（共通ライブラリ・認証・監査・エラーハンドリング）
- **フェーズ5**: ⏳ 未着手
- **フェーズ6**: ⏳ 未着手
- **フェーズ7**: ⏳ 未着手

---

## 次の優先タスク（推奨順）

1. ✅ ~~Supabase環境構築~~（完了）
2. ✅ ~~Next.js BFF骨組み~~（完了）
3. ✅ ~~共通ライブラリ~~（完了）
4. ✅ ~~FastAPI実装詳細~~（完了）
5. ✅ ~~BFF実装詳細~~（完了）
6. ✅ ~~担当者管理API~~（完了）
7. ✅ ~~UI向けAPI~~（完了）
8. ✅ ~~customer_code解決~~（完了）
9. ✅ ~~デザインシステム・共通レイアウト~~（完了）
10. ✅ ~~ダッシュボード画面~~（完了）
11. ✅ ~~認証統合~~（完了：Supabase Auth + ログイン画面 + セキュア環境変数）
12. ✅ ~~アカウント管理画面~~（完了：マイページ + プロファイル編集）
13. **顧客管理画面**: 一覧・詳細・CRUD機能
14. **顧客分析画面**: 統計ダッシュボード
15. **ログ監査画面**: 管理者専用監査ログ閲覧
16. **integration_jobs**: 再試行管理機能実装（オプション）
17. **デプロイ環境準備**: Vercel/Render設定

## 実装メモ

### フェーズ1完了（2025-10-17）
- 8つのテーブルを作成（teams, customers, contacts, orders, measurements, integration_jobs, audit_logs, profiles）
- RLSポリシーをすべてのテーブルに適用（所有者ベース＋管理者例外）
- トリガ・関数を実装（search_vector自動更新、updated_at自動更新）
- セキュリティ問題を修正：
  - 全テーブルにRLS有効化
  - 関数のsearch_path固定（security definer）
  - auth.uid()を(select auth.uid())に最適化
  - 複数permissiveポリシーを統合
- テストチーム3件を投入
- 残存警告: pg_trgm拡張がpublicスキーマ（既存環境のため許容）、未使用インデックス（データ未投入のため許容）

---

### フェーズ2+4完了（2025-10-20）
#### バックエンド基盤
- Next.js BFF骨組み完成（package.json, tsconfig, Supabaseクライアント）
- FastAPI連携サービス骨組み完成（requirements.txt, Dockerfile, 設定管理）

#### 共通ライブラリ
- OAuth2 CC認証ライブラリ（TypeScript/Python）
- HMAC署名検証ライブラリ（Python）
- 監査ログヘルパー（機微情報マスキング、diff生成）
- エラーハンドリング（統一レスポンス、リトライ判定）
- レート制限・IP Allowlist実装
- バリデーションスキーマ（Zod）

#### 顧客管理API（完全実装）
- GET/POST /api/customers（一覧・作成）
- GET/PUT/DELETE /api/customers/[id]（詳細・更新・削除）
- 認証チェック、バリデーション、owner_user_id自動設定
- 監査ログ記録（create/update/delete、diff生成）
- 構造化ログ出力

#### M2M/内部API
- GET /api/m2m/customers/search（OAuth2 CC認証、レート制限、IP Allowlist）
- POST /api/internal/orders/upsert、measurements/upsert

#### FastAPI連携サービス（完全実装）
- Webhook受信（orders.updated、measurements.updated）
  - HMAC署名検証、タイムスタンプ検証（リプレイ防止）
  - 冪等性チェック（イベントID重複排除）
  - ペイロード解析・バリデーション
  - 顧客管理API経由でupsert
- 補助Pull同期（orders、measurements）
  - OAuth2 CC認証、外部API差分取得、ページング
- 外部APIクライアント
  - サーキットブレーカ、指数バックオフ・リトライ
  - レート制限対応（429処理）

#### バックエンドAPI追加完了（2025-10-20）
- 担当者管理API（contacts CRUD）
  - GET/POST /api/contacts（一覧・作成）
  - GET/PUT/DELETE /api/contacts/[id]（詳細・更新・削除）
  - RLS統合、バリデーション、監査ログ
- UI向け参照API
  - GET /api/orders（customer_id絞り込み）
  - GET /api/measurements（customer_id/order_id絞り込み）
- 顧客コード解決ロジック
  - resolveCustomerIdByCode、ensureCustomerId、resolveOrderId
  - 内部API・FastAPI Webhookに統合
  - UUID/コード両対応

#### 残TODO（オプション）
- integration_jobs 記録・再試行管理（手動再試行はUI経由で代替可）
- パフォーマンス検証（M2M SLO P95 < 200ms、鮮度SLO P99 ≤ 3秒）

最終更新: 2025-10-21  
バージョン: v0.12（フェーズ3進行中：認証・アカウント管理完了、顧客管理画面へ）

---

## セキュリティ強化履歴（v0.9-v0.10）

### v0.10 (2025-10-20) - 第2フェーズ
- M2M PIIフィールド最小化（デフォルトでPII除外、fieldsパラメータallowlist制御）
- エラーレスポンス統一化（errorResponse統一使用）
- integration_jobs記録実装（JobTracker、ライフサイクル管理）

### v0.11 (2025-10-21) - 認証・アカウント管理完了
- デザインシステム構築（カラーパレット、タイポグラフィ）
- 共通レイアウトコンポーネント（AppLayout、Sidebar、Header、RightPanel）
- Font Awesome統合 + FOUC対策
- ダッシュボード画面実装
  - 統計カード（総登録数、顧客タイプ別）
  - 月別推移グラフ（SVG折れ線、インタラクティブツールチップ）
  - 最近の登録リスト、クイックアクション
- customer_type ENUM追加（顧客、スタッフ、サポート、社員、代理店、その他）
- Supabase Auth統合
  - ログイン画面（デザイン統一、ユーザー視点の機能説明）
  - 認証ミドルウェア（ルート保護）
  - セキュアな環境変数管理（NEXT_PUBLIC_除去、API経由配信）
  - AuthProvider + SupabaseProvider実装
- アカウント管理（マイページ）
  - プロファイル表示・編集（表示名、部署、権限）
  - 部署選択式（北海道、仙台、東京、名古屋、大阪、代理店）
  - 権限バッジ表示（admin/manager/user/viewer）
  - 統計サマリー、アクティビティログ
- RLSポリシー修正
  - profiles無限再帰問題解決
  - audit_logs一般ユーザー閲覧対応（自分のログのみ）
  - profiles更新ポリシー追加
- 初期管理者アカウント作成手順ドキュメント化

### v0.9 (2025-10-20) - 第1フェーズ
- OAuth2トークン検証実装（JWT/JWKs、jose利用）
- M2M: IP Allowlist・レート制限適用
- 内部upsertにZodバリデーション追加
- 監査ログPIIマスキング拡張（正規表現検出）

