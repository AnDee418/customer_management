# 監視・観測性セットアップ (Phase 6.1)

## 概要

顧客管理システムの監視・観測性の基礎設定を完了しました。本ドキュメントでは、現在の監視設定、ログ収集、およびメトリクス取得の状況を記載します。

**最終更新**: 2025-10-27
**バージョン**: v0.17

## デプロイメント状況

### Vercel (Next.js フロントエンド/BFF)

**ステータス**: ✅ READY

- **プロジェクト名**: customer-management
- **プロジェクトID**: prj_9jJ61Ry4GD1z3l0r4UkUR7fNFiiP
- **チームID**: team_F4GwZJxreMRJjQhNhr3x8oIi
- **最新デプロイID**: dpl_J65j1CFwjt8uf6kcM9obWdjnYyEj
- **デプロイ完了日時**: 2025-10-27T02:16:24Z
- **リージョン**: iad1 (Washington D.C., USA)
- **URL**:
  - Production: https://customer-management-nine-phi.vercel.app
  - Branch (master): https://customer-management-git-master-hidekazus-projects-3e9231cd.vercel.app

**最近の修正**:
- TypeScript型エラー修正 (Supabase Realtime)
- セキュリティヘッダー実装 (CSP, X-Frame-Options, etc.)

### Render (FastAPI 統合サービス)

**ステータス**: ✅ Live

- **サービス名**: customer-mgmt-integration
- **サービスID**: srv-d3tgio75r7bs73eq1a90
- **ワークスペース**: Design's workspace (tea-d0i1haemcj7s739js060)
- **リージョン**: Singapore
- **URL**: https://customer-mgmt-integration.onrender.com
- **プラン**: Starter
- **インスタンス数**: 1
- **ポート**: 10000 (TCP)
- **自動デプロイ**: 有効 (master ブランチ)

**最新デプロイ**:
- ビルド成功: 2025-10-24T05:59:07Z
- サービス起動: 2025-10-24T05:59:42Z
- Uvicorn稼働中: http://0.0.0.0:10000

## 構造化ログ実装

### Next.js (フロントエンド/BFF)

**実装場所**: `lib/audit/logger.ts`

**機能**:
- **機微情報マスキング**:
  - フィールド名ベース (password, token, email, etc.)
  - PII検出パターン (Email, 電話番号, クレジットカード)
  - UUID/タイムスタンプの誤検出防止
- **diff生成**: before/after比較
- **JSON形式出力**: タイムスタンプ、ログレベル、メッセージ、メタデータ
- **監査ログ記録**: Supabase audit_logs テーブルへの記録

**使用例**:
```typescript
// 構造化ログ
structuredLog('info', 'Customer created', { customer_id: data.id, actor: user.id })

// 監査ログ
await logAudit({
  actor_user_id: user.id,
  entity: 'customers',
  entity_id: data.id,
  action: 'create',
  diff: { after: data },
})
```

**適用箇所**:
- `app/api/customers/route.ts`
- `app/api/contacts/route.ts`
- その他API routeハンドラー

### FastAPI (統合サービス)

**実装場所**: `services/integration/app/core/logging.py`

**機能**:
- **structlog使用**: Python構造化ログライブラリ
- **JSON出力**: 機械解析可能な形式
- **タイムスタンプ**: ISO 8601形式
- **ログレベル制御**: 環境変数 LOG_LEVEL
- **コンテキスト情報**: path, method, error詳細

**設定**:
```python
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    ...
)
```

**使用例**:
```python
# グローバル例外ハンドラー (app/main.py)
logger.error(
    "unhandled_exception",
    path=request.url.path,
    method=request.method,
    error=str(exc),
    exc_info=True,
)
```

## ログ収集・集約

### Vercel

**機能**:
- **ビルドログ**: Vercel MCP経由で取得可能
- **ランタイムログ**: Vercelダッシュボード経由
- **関数ログ**: Next.js API Route実行ログ

**MCP操作例**:
```typescript
mcp__vercel__get_deployment_build_logs({
  idOrUrl: "dpl_xxx",
  teamId: "team_xxx",
  limit: 200
})
```

### Render

**機能**:
- **アプリケーションログ**: Render MCP経由で取得可能
- **ビルドログ**: デプロイ時のビルド出力
- **システムログ**: サービス起動/停止イベント

**MCP操作例**:
```typescript
mcp__render__list_logs({
  resource: ["srv-d3tgio75r7bs73eq1a90"],
  limit: 50,
  direction: "backward",
  type: ["app"]
})
```

**ログラベル**:
- `resource`: サービスID
- `instance`: インスタンスID
- `level`: info, warn, error
- `type`: app, build, system

### Supabase

**監査ログテーブル**: `audit_logs`

**スキーマ**:
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  actor_user_id UUID REFERENCES auth.users(id),
  entity TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  diff JSONB
);
```

**アクセス制御**:
- 管理者のみ全件閲覧可能
- RLSポリシー適用

## メトリクス収集

### Vercel

**利用可能なメトリクス**:
- デプロイメント状態 (READY, ERROR, BUILDING)
- ビルド時間
- リージョン情報

**MCP操作例**:
```typescript
mcp__vercel__get_deployment({
  idOrUrl: "dpl_xxx",
  teamId: "team_xxx"
})
```

### Render

**利用可能なメトリクス** (MCP経由):
- CPU使用率 (cpu_usage, cpu_limit, cpu_target)
- メモリ使用率 (memory_usage, memory_limit, memory_target)
- HTTPリクエスト数 (http_request_count)
- HTTPレスポンスタイム (http_latency)
- 帯域幅使用量 (bandwidth_usage)
- インスタンス数 (instance_count)

**MCP操作例**:
```typescript
mcp__render__get_metrics({
  resourceId: "srv-d3tgio75r7bs73eq1a90",
  metricTypes: ["cpu_usage", "memory_usage", "http_request_count"],
  startTime: "2025-10-27T00:00:00Z",
  endTime: "2025-10-27T12:00:00Z",
  resolution: 60  // 60秒間隔
})
```

## 今後の改善計画

### Phase 6.2: アラート設定

- [ ] エラー率しきい値アラート (例: 5分間でエラー率 > 5%)
- [ ] レスポンスタイムSLO違反アラート (P95 > 200ms)
- [ ] デプロイ失敗通知
- [ ] サービスダウン通知
- [ ] 通知チャネル設定 (Email, Slack)

### Phase 6.3: ダッシュボード構築

- [ ] リアルタイムメトリクス可視化
- [ ] SLO達成率ダッシュボード
- [ ] エラー率・レイテンシートレンド
- [ ] デプロイメント履歴表示
- [ ] 監査ログ検索UI

### Phase 6.4: パフォーマンス監視強化

- [ ] Core Web Vitals計測 (LCP, FID, CLS)
- [ ] API応答時間分布
- [ ] データベースクエリパフォーマンス
- [ ] Realtime接続数・遅延
- [ ] 外部API連携レイテンシー

### Phase 6.5: ログ分析強化

- [ ] エラーパターン自動検出
- [ ] ログ保持期間管理
- [ ] ログエクスポート機能 (長期保存)
- [ ] セキュリティイベント検索

## 関連ドキュメント

- [実装チェックリスト](./IMPLEMENTATION_CHECKLIST.md)
- [セキュリティテスト結果](./SECURITY_TEST_RESULTS.md)
- [非機能要件・セキュリティ・運用](../docs/requirements/06_nonfunctional_security_ops.md)

## 参考リンク

- [Vercel Dashboard](https://vercel.com/hidekazus-projects-3e9231cd/customer-management)
- [Render Dashboard](https://dashboard.render.com/web/srv-d3tgio75r7bs73eq1a90)
- [Supabase Dashboard](https://supabase.com/dashboard)
