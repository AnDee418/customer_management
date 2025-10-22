# 04. 外部API連携要件（発注/測定）（ドラフト）

## 目的
- 外部システムの「発注」「測定」データについて、内製DBには外部IDと要約情報のみを保持し、詳細は外部側で参照する方式とする。
- 取り込みの重複防止、整合性維持、障害時の再試行と監査可能性を確保する。
- マイクロサービス前提で、顧客データの書き込みは顧客管理サービスのみが行う（書き込みの一元化）。

## 認証/接続（決定）
- M2M/内部API: OAuth2 Client Credentials を採用。スコープ/ロールで最小権限を付与し、トークンは短寿命・自動ローテーション。
- Webhook 署名: HMAC + Timestamp + Nonce（送信元システム仕様に準拠）。`X-Event-Id`/`X-Signature`/`X-Timestamp`
- IP Allowlist とレート制限を併用

## 連携方式（方針）
- Webhook-first: 更新は原則 Webhook でリアルタイムに受信し反映。
- 差分Pullは補助: 欠損や署名失敗時の補完に限定（定期ポーリングは最小）
- 冪等性: `Idempotency-Key`/イベントIDで重複処理を排除、同キーは一定期間再受理しない
- 順序保証: イベントの並び順保持が保証されない前提でバージョン/更新時刻で整合をとる
- レート制御: 429/5xx 時は指数バックオフ＋ジッター。上限値を設定し、突破時はキューイング
- キャッシュ: 原則不使用（障害時のみ限定的フォールバック）

## 暫定エンドポイント（例）
- Webhook（Push）:
  - POST /webhooks/orders.updated
  - POST /webhooks/measurements.updated
  - ヘッダ署名: X-Signature / X-Timestamp / X-Event-ID（例）
- 内部書き込み（顧客管理API）:
  - POST /internal/orders/upsert
  - POST /internal/measurements/upsert
  - 認証: 内部用トークン（HMAC or OAuth2 CC）、レート制限/Allowlist
- 補助Pull（必要時のみ）:
  - GET /orders?updated_since={ts}&page={n}
  - GET /measurements?updated_since={ts}&page={n}

## データマッピング（抜粋）
- 外部発注ID → orders.external_order_id（unique: external_order_id+source_system）
- 外部測定ID → measurements.external_measurement_id（unique 同上）
- source_system → 'ExternalOrdering' / 'ExternalMeasurement' などの識別子
- 顧客キーの突合: customers.code（推奨）/ 名寄せロジック / 手動紐付け（補助UI）

## エラーハンドリング
- 4xx（認可/入力）: 失敗記録＋要確認ラベル、手動対応フローへ
- 5xx/タイムアウト: 自動再試行、上限到達で failed とし通知
- 部分失敗（バルク）: 成功分は確定、失敗分のみ再試行
- 監査: すべての要求/結果を audit_logs / integration_jobs に保存（機微はマスク）

## セキュリティ
- Webhook 署名検証（HMAC、時刻許容差）、イベントIDのリプレイ防止
- PII 最小保持、ログ/メトリクスへ機微情報を出力しない
- 権限分離（読み取り専用トークン等）、最小権限のキー運用
- 内部APIは M2M 署名・Allowlist・レート制限でゼロトラスト前提

## 運用/監視
- ダッシュボード: Webhook遅延、成功率、再試行回数
- アラート: 失敗率・遅延の閾値、Webhook 署名検証失敗、内部APIの失敗率
- 手動再同期: 顧客単位/期間単位での再取得、再試行ボタン

## SLA/パフォーマンス（目安）
- Webhook到着→DB反映→UI通知までの鮮度: P99 ≤ 3秒（目標、要合意）

## 未決事項
- 認証方式の最終決定（API Key vs OAuth2）
- 外部のイベントスキーマ・署名仕様（ヘッダ名/アルゴリズム）
- 差分カーソル・ページサイズ・保持期間
- 名寄せ/手動紐付けの具体UI/運用手順
