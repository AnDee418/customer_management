"""
冪等性チェック
イベントIDベースの重複処理防止
"""
from datetime import datetime, timedelta
from typing import Optional


class IdempotencyStore:
    """
    イベントID保存ストア（簡易メモリ実装）
    本番環境ではRedis等の永続化ストアを推奨
    """

    def __init__(self, ttl_hours: int = 24):
        self._store: dict[str, datetime] = {}
        self.ttl_hours = ttl_hours

    def check_and_set(self, event_id: str) -> bool:
        """
        イベントIDが既存かチェックし、なければ保存

        Returns:
            True: 新規（処理すべき）
            False: 重複（スキップすべき）
        """
        # クリーンアップ
        self._cleanup()

        if event_id in self._store:
            return False

        self._store[event_id] = datetime.now()
        return True

    def _cleanup(self):
        """期限切れエントリ削除"""
        cutoff = datetime.now() - timedelta(hours=self.ttl_hours)
        expired = [k for k, v in self._store.items() if v < cutoff]
        for key in expired:
            del self._store[key]


# シングルトンインスタンス
idempotency_store = IdempotencyStore()

