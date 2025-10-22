"""
顧客コード解決ヘルパー
customer_code → customer_id 変換
"""
import httpx
from typing import Optional
from ..core.oauth2 import oauth2_client
from ..core.config import get_settings
from ..core.logging import logger

settings = get_settings()


async def resolve_customer_id(customer_code: str) -> Optional[str]:
    """
    顧客コードからIDを解決
    
    Args:
        customer_code: 顧客コード
        
    Returns:
        顧客ID（見つからない場合はNone）
    """
    token = await oauth2_client.get_token()
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.customer_api_base_url}/api/m2m/customers/search",
            params={"q": customer_code, "limit": 1},
            headers={
                "Authorization": f"Bearer {token}",
                "Cache-Control": "no-store",
            },
            timeout=10.0,
        )
        response.raise_for_status()
        data = response.json()
        
        if data and len(data) > 0:
            # codeが完全一致するものを探す
            for customer in data:
                if customer.get("code") == customer_code:
                    logger.info(
                        "customer_resolved",
                        customer_code=customer_code,
                        customer_id=customer["id"],
                    )
                    return customer["id"]
        
        logger.warning(
            "customer_not_found",
            customer_code=customer_code,
        )
        return None


async def ensure_customer_id(code_or_id: str) -> str:
    """
    顧客コード（またはID）から確実にIDを取得
    
    Args:
        code_or_id: 顧客コードまたはID
        
    Returns:
        顧客ID
        
    Raises:
        ValueError: 顧客が見つからない場合
    """
    # UUID形式ならそのまま返す
    import re
    uuid_pattern = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        re.IGNORECASE,
    )
    if uuid_pattern.match(code_or_id):
        return code_or_id
    
    # コードとして解決
    customer_id = await resolve_customer_id(code_or_id)
    if not customer_id:
        raise ValueError(f"Customer not found with code: {code_or_id}")
    
    return customer_id

