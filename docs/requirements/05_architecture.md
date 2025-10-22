# 05. アーキテクチャとAPI境界（ドラフト）

## 構成概要
- フロントエンド: Next.js（App Router, SSR/ISR）＋ Supabase Auth クライアント
- BFF(API): Next.js Route Handlers（Node.js）。UI 近傍の集約/権限チェック
- 連携サービス: Python FastAPI。外部API連携（Webhook-first + 差分補完Pull）と再試行管理
- データ: Supabase（Postgres + Auth + Storage）。RLS/RBAC によるアクセス制御
- デプロイ: Vercel（フロント+BFF）、Render（FastAPI）。Cron は補助（欠損補完用）

## マイクロサービス前提と境界
- ソース・オブ・トゥルース: 顧客データは本サービスが唯一の書き込み主体（Owning Service）
- 他サービス: 顧客データはAPI経由で読み取り（M2M参照API）。直接DBアクセスは禁止
- 書き込みの一元化: 顧客データの変更は本サービスAPIのみ。外部連携は連携サービスが担当し、本サービスAPI経由でDBへ反映
- blast radius 最小化: サービス/資格情報/Secrets/データの分離、最小権限での接続

## API境界
- BFF（フロント寄り）
  - GET/POST/PUT/DELETE /api/customers
  - GET/POST/PUT/DELETE /api/contacts
  - GET /api/orders, GET /api/measurements（UI向けの整形を提供）
- 連携サービス（外部I/O 寄り）
  - POST /sync/orders, /sync/measurements（手動/補助的な差分実行）
  - POST /webhooks/orders.updated, /webhooks/measurements.updated（署名検証）
- M2M 参照API（読み取り専用、キャッシュ常用なし）
  - GET /m2m/customers/search?q=...&limit=...
  - 認証: OAuth2 Client Credentials（短寿命トークン/最小権限）、IP Allowlist、レート制限
  - SLO: P95 < 200ms、キャッシュ常用なし（索引/FTSと強整合読み取り）

## データフロー（概略）
1. ユーザー → フロント（Next.js）→ BFF → Supabase（CRUD/検索）
2. 外部API → Webhook → 連携サービス → 顧客管理API（内部）→ Supabase（orders/measurements 反映）
3. 欠損補完: 連携サービス → 差分Pull → 顧客管理API → Supabase
4. 他サービス → M2M参照API（読み取り専用）→ Supabase の索引/FTS

## リアルタイム配信/一貫性
- UI 反映: Supabase Realtime（DB変更イベント）/ WebSocket / SSE を利用して即時反映
- 一貫性: 読み取りは原則プライマリへ（read-your-writes）。レプリカはレイテンシ重視の用途に限定
- キャッシュ: 原則禁止。障害時のみ限定的フォールバック（短期・明示フラグ）
- HTTP 応答ヘッダ: `Cache-Control: no-store` を既定

## 回復性/制御
- バックプレッシャ: キュー長/同時実行上限に応じて取り込み速度を制御
- サーキットブレーカ: 外部5xxやタイムアウト増加時は一時遮断し指数バックオフ
- リトライ: 冪等キー付きで安全に再試行、上限到達で要確認

## デプロイ/環境/復旧
- 環境: dev / stg / prod。DB スキーマはマイグレーションで同期
- Secrets: 環境ごとに分離、最小権限、ローテーション
- 復旧: Postgres PITR/スナップショット。演習/Runbook を整備

## 観測性/ログ
- 構造化ログ: request_id, user_id, entity, action, duration, status
- メトリクス: 同期成功率、レイテンシ、Webhook遅延、M2M SLO、UI鮮度（source→UI）
- ログ・メトリクスは機微情報をマスク

## エラー処理/冪等
- 外部イベントは event_id/idempotency key で重複排除
- 4xx は失敗記録＋要確認。5xx/ネットワークは自動再試行

## セキュリティ/権限
- Supabase RLS: 所有者のみ閲覧（owner_user_id）＋管理者例外、必要に応じチーム共有
- 監査: audit_logs に create/update/delete/sync/retry を保存（管理者が閲覧）
- M2M は OAuth2 CC に統一、レート制限/Allowlist でゼロトラスト前提

## 開発規約/ディレクトリ（方針）
- 画面/機能ごとにフォルダ分割（UI, hooks, api 等）
- 長いコードは関数へ分割して別ファイル化、スタイルは極力別ファイル管理
- 共通 UI は可読性を最優先。配色は rainbowGradient の5色を基調にしつつコントラストを担保

## テスト戦略（要約）
- 単体テスト（BFF/FastAPI のロジック）
- 統合テスト（BFF ↔ Supabase, 連携 ↔ 外部APIモック, M2M ↔ 索引/FTS）
- E2E（主要シナリオ: 顧客詳細で外部ID参照、再試行、M2M検索、リアルタイム反映）
- 契約テスト（BFF-フロント、連携-外部API、M2M-利用サービス）
