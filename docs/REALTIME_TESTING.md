# リアルタイム更新機能 テストガイド

## 概要

顧客管理システムにSupabase Realtimeを使用したリアルタイム更新機能を実装しました。
この機能により、他のユーザーによる変更がWebSocket経由で即座にUIに反映されます。

## 実装内容

### 1. カスタムフック (`lib/hooks/useRealtimeSubscription.ts`)

**汎用リアルタイム購読フック:**
- `useRealtimeSubscription`: 任意のテーブルのリアルタイム変更を購読
- WebSocket接続の自動管理
- INSERT/UPDATE/DELETE イベントのコールバック処理
- エラーハンドリングと接続状態の管理

**顧客専用フック:**
- `useCustomersRealtime`: 顧客テーブル全体の変更を購読
- `useCustomerRealtime`: 特定の顧客IDの変更を購読（フィルタ付き）

### 2. 実装ページ

**顧客一覧ページ (`app/customers/page.tsx`):**
- 顧客の追加・更新・削除をリアルタイムで反映
- 接続状態インジケーター表示（緑の点 + "リアルタイム"）
- 新規顧客は一覧の先頭に自動追加
- 更新された顧客は既存のリストで自動更新
- 削除された顧客は自動的にリストから除去

**顧客詳細ページ (`app/customers/[id]/page.tsx`):**
- 特定顧客の更新をリアルタイムで反映
- 顧客が削除された場合は自動的に一覧ページへ遷移
- 接続状態インジケーター表示

## テスト手順

### 前提条件

1. Supabase Realtimeが有効化されていること
2. `customers` テーブルにRealtime設定がされていること
3. 開発サーバーが起動していること (`npm run dev`)

### テストシナリオ

#### シナリオ1: 顧客一覧でのリアルタイム更新

1. **準備:**
   - ブラウザで2つのタブを開く
   - 両方で `/customers` にアクセス
   - 両方のタブで「リアルタイム」インジケーターが表示されることを確認

2. **INSERT テスト:**
   - タブ1で「新規登録」をクリック
   - 顧客情報を入力して登録
   - タブ2で新しい顧客が自動的に一覧の先頭に表示されることを確認

3. **UPDATE テスト:**
   - タブ1で既存の顧客の「編集」をクリック
   - 名前や連絡先を変更して保存
   - タブ2で変更が自動的に反映されることを確認

4. **DELETE テスト:**
   - タブ1で顧客を削除
   - タブ2で削除された顧客が自動的にリストから消えることを確認

#### シナリオ2: 顧客詳細でのリアルタイム更新

1. **準備:**
   - ブラウザで2つのタブを開く
   - タブ1: `/customers` (一覧)
   - タブ2: `/customers/[特定のID]` (詳細)
   - タブ2で「リアルタイム」インジケーターが表示されることを確認

2. **UPDATE テスト:**
   - タブ1で該当顧客の「編集」をクリック
   - 情報を変更して保存
   - タブ2で変更が自動的に詳細画面に反映されることを確認

3. **DELETE テスト:**
   - タブ1で該当顧客を削除
   - タブ2でアラート「この顧客は削除されました」が表示される
   - 自動的に一覧ページへ遷移することを確認

#### シナリオ3: 接続エラーハンドリング

1. **ネットワーク切断:**
   - Chrome DevToolsのNetworkタブで「Offline」を選択
   - WebSocket接続が切断される
   - 再度「Online」にする
   - 自動的に再接続されることを確認

2. **コンソールログ確認:**
   - ブラウザのコンソールを開く
   - 以下のログが表示されることを確認:
     - `[Realtime] Subscription status: SUBSCRIBED`
     - `[Realtime] Change received: { table, event, new, old }`

### 期待される動作

**正常時:**
- WebSocket接続が確立される（約1-2秒以内）
- 「リアルタイム」インジケーターが緑色で表示される
- 変更が3秒以内にUIに反映される（鮮度SLO: P99 ≤ 3秒）
- コンソールに `[Realtime]` ログが出力される

**異常時:**
- 接続失敗時はインジケーターが表示されない
- エラーメッセージがコンソールに出力される
- 既存の機能（手動リロード）は引き続き動作する

## トラブルシューティング

### WebSocket接続が確立されない

**確認項目:**
1. Supabase Realtimeが有効か確認
   ```
   Supabase Dashboard → Database → Replication → Enable Realtime
   ```

2. 環境変数が正しく設定されているか確認
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_ANON_KEY=eyJxxx...
   ```

3. テーブルのRealtime設定を確認
   ```sql
   -- customersテーブルのRealtime有効化
   alter publication supabase_realtime add table customers;
   ```

### 変更が反映されない

**確認項目:**
1. ブラウザコンソールでエラーを確認
2. WebSocket接続状態を確認（DevTools → Network → WS）
3. Supabaseダッシュボードでログを確認

### パフォーマンス問題

**確認項目:**
1. 接続数が多すぎないか確認（1ページ = 1接続）
2. フィルタが適切に設定されているか確認
3. 不要な購読がないか確認

## パフォーマンス指標

**鮮度SLO:**
- P99 ≤ 3秒: データソース → DB → UI

**測定方法:**
1. タブ1で変更を実行（タイムスタンプ記録）
2. タブ2でUIが更新されたタイミングを記録
3. 差分を計算

**期待値:**
- WebSocket遅延: < 500ms
- UIレンダリング: < 100ms
- 合計: < 1秒（通常時）

## Supabase Realtime設定確認

### ダッシュボードでの確認

1. Supabase Dashboard にログイン
2. Project Settings → API
3. Realtime URL が表示されていることを確認

### SQL での確認

```sql
-- Replication publication の確認
SELECT * FROM pg_publication;

-- customersテーブルが含まれているか確認
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

### 必要に応じて追加

```sql
-- customersテーブルをRealtimeに追加
ALTER PUBLICATION supabase_realtime ADD TABLE customers;

-- 確認
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

## デバッグ用コマンド

### ブラウザコンソールでのテスト

```javascript
// Realtime接続状態を確認
console.log('Supabase Realtime channels:', window.supabase?.getChannels())

// 手動でイベントを発火（デバッグ用）
// 本番では使用しない
```

## 注意事項

1. **キャッシュ禁止**: Cache-Control: no-store ヘッダーが必須
2. **RLS適用**: Row Level Securityが適用されるため、所有者以外の変更は通知されない
3. **接続制限**: 1ページにつき1つのWebSocket接続を使用
4. **クリーンアップ**: コンポーネントのアンマウント時に自動的に購読解除

## 今後の拡張

- [ ] 発注データ (orders) のリアルタイム更新
- [ ] 測定データ (measurements) のリアルタイム更新
- [ ] プレゼンスインジケーター（他のユーザーがオンラインか表示）
- [ ] 楽観的UI更新（変更を先にUIに反映し、サーバー確認後に修正）
- [ ] リトライロジックの改善

---

最終更新: 2025-10-24
