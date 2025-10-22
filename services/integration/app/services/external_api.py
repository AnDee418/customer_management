"""
外部APIクライアント
サーキットブレーカ、指数バックオフ、レート制限対応
"""
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio

from ..core.config import get_settings
from ..core.logging import logger

settings = get_settings()


class CircuitBreaker:
    """簡易サーキットブレーカ"""

    def __init__(self, failure_threshold: int = 5, timeout_seconds: int = 60):
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "closed"  # closed, open, half_open

    def call_succeeded(self):
        """成功時"""
        self.failure_count = 0
        self.state = "closed"

    def call_failed(self):
        """失敗時"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()

        if self.failure_count >= self.failure_threshold:
            self.state = "open"
            logger.warning(
                "circuit_breaker_opened",
                failure_count=self.failure_count,
            )

    def can_attempt(self) -> bool:
        """リクエスト可能か"""
        if self.state == "closed":
            return True

        if self.state == "open":
            # タイムアウト経過で半開状態へ
            if (
                self.last_failure_time
                and (datetime.now() - self.last_failure_time).seconds
                > self.timeout_seconds
            ):
                self.state = "half_open"
                logger.info("circuit_breaker_half_open")
                return True
            return False

        # half_open
        return True


class ExternalAPIClient:
    """外部APIクライアント（発注・測定）"""

    def __init__(self):
        self.ordering_base_url = settings.external_ordering_api_url
        self.measurement_base_url = settings.external_measurement_api_url
        self.api_key = settings.external_api_key
        self.circuit_breaker = CircuitBreaker()

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        max_attempts: int = 3,
        **kwargs,
    ) -> httpx.Response:
        """指数バックオフ付きリトライ"""
        for attempt in range(1, max_attempts + 1):
            try:
                if not self.circuit_breaker.can_attempt():
                    raise Exception("Circuit breaker is open")

                async with httpx.AsyncClient() as client:
                    response = await client.request(method, url, **kwargs)

                    # 429の場合はリトライ
                    if response.status_code == 429:
                        retry_after = int(response.headers.get("Retry-After", 5))
                        logger.warning(
                            "rate_limited",
                            url=url,
                            retry_after=retry_after,
                            attempt=attempt,
                        )
                        await asyncio.sleep(retry_after)
                        continue

                    response.raise_for_status()
                    self.circuit_breaker.call_succeeded()
                    return response

            except Exception as e:
                self.circuit_breaker.call_failed()
                logger.error(
                    "external_api_request_failed",
                    url=url,
                    attempt=attempt,
                    error=str(e),
                )

                if attempt == max_attempts:
                    raise

                # 指数バックオフ（ジッター付き）
                backoff = min(2**attempt + (attempt * 0.1), settings.BACKOFF_MAX_SECONDS)
                await asyncio.sleep(backoff)

        raise Exception(f"Max retry attempts ({max_attempts}) exceeded")

    async def fetch_orders(
        self, updated_since: Optional[str] = None, page: int = 1, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """
        発注データの差分取得（補助Pull）
        
        Args:
            updated_since: 更新日時フィルタ（ISO8601）
            page: ページ番号
            page_size: ページサイズ
        """
        params = {"page": page, "page_size": page_size}
        if updated_since:
            params["updated_since"] = updated_since

        response = await self._request_with_retry(
            "GET",
            f"{self.ordering_base_url}/orders",
            params=params,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Cache-Control": "no-store",
            },
            timeout=30.0,
        )

        data = response.json()
        logger.info(
            "external_orders_fetched",
            count=len(data.get("items", [])),
            page=page,
        )
        return data.get("items", [])

    async def fetch_measurements(
        self, updated_since: Optional[str] = None, page: int = 1, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """
        測定データの差分取得（補助Pull）
        
        Args:
            updated_since: 更新日時フィルタ（ISO8601）
            page: ページ番号
            page_size: ページサイズ
        """
        params = {"page": page, "page_size": page_size}
        if updated_since:
            params["updated_since"] = updated_since

        response = await self._request_with_retry(
            "GET",
            f"{self.measurement_base_url}/measurements",
            params=params,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Cache-Control": "no-store",
            },
            timeout=30.0,
        )

        data = response.json()
        logger.info(
            "external_measurements_fetched",
            count=len(data.get("items", [])),
            page=page,
        )
        return data.get("items", [])


# シングルトンインスタンス
external_api_client = ExternalAPIClient()

