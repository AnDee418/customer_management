"""
顧客管理APIクライアント
内部API呼び出し（orders/measurements upsert）
"""
import httpx
from typing import Any, Dict
from ..core.config import settings
from ..core.oauth2 import oauth2_client
from ..core.logging import logger


class CustomerAPIClient:
    def __init__(self):
        self.base_url = settings.customer_api_base_url

    async def upsert_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """発注データupsert"""
        token = await oauth2_client.get_token()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/internal/orders/upsert",
                json=order_data,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store",
                },
                timeout=30.0,
            )
            response.raise_for_status()
            logger.info(
                "order_upserted",
                external_order_id=order_data.get("external_order_id"),
                status_code=response.status_code,
            )
            return response.json()

    async def upsert_measurement(
        self, measurement_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """測定データupsert"""
        token = await oauth2_client.get_token()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/internal/measurements/upsert",
                json=measurement_data,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store",
                },
                timeout=30.0,
            )
            response.raise_for_status()
            logger.info(
                "measurement_upserted",
                external_measurement_id=measurement_data.get(
                    "external_measurement_id"
                ),
                status_code=response.status_code,
            )
            return response.json()


# シングルトンインスタンス
customer_api_client = CustomerAPIClient()

