"""
補助Pull同期エンドポイント
Webhook欠損時の補完用（手動/定期実行）
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import structlog

from ..core.oauth2 import oauth2_client
from ..services.external_api import external_api_client
from ..services.customer_api import customer_api_client

router = APIRouter()
logger = structlog.get_logger()


@router.post("/orders")
async def sync_orders(
    updated_since: Optional[str] = Query(
        None, description="更新日時フィルタ（ISO8601形式）"
    ),
    page: int = Query(1, ge=1, description="ページ番号"),
    page_size: int = Query(100, ge=1, le=500, description="ページサイズ"),
):
    """
    発注データの補助Pull同期
    Webhook欠損時の補完用
    """
    try:
        # OAuth2トークン取得（認証チェック）
        token = await oauth2_client.get_token()
        
        # 外部APIから差分取得
        orders = await external_api_client.fetch_orders(
            updated_since=updated_since,
            page=page,
            page_size=page_size,
        )
        
        # 顧客管理API経由でupsert
        processed = 0
        failed = 0
        errors = []
        
        for order in orders:
            try:
                # TODO: customer_code → customer_id 変換
                order_data = {
                    "customer_id": "TODO",
                    "external_order_id": order["external_order_id"],
                    "source_system": "ExternalOrdering",
                    "title": order.get("title"),
                    "status": order.get("status"),
                    "ordered_at": order.get("ordered_at"),
                }
                
                await customer_api_client.upsert_order(order_data)
                processed += 1
                
            except Exception as e:
                failed += 1
                errors.append({
                    "external_order_id": order.get("external_order_id"),
                    "error": str(e),
                })
                logger.error(
                    "order_sync_failed",
                    external_order_id=order.get("external_order_id"),
                    error=str(e),
                )
        
        logger.info(
            "orders_synced",
            processed=processed,
            failed=failed,
            page=page,
        )
        
        return {
            "status": "completed",
            "processed": processed,
            "failed": failed,
            "errors": errors if errors else None,
        }
        
    except Exception as e:
        logger.error("orders_sync_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/measurements")
async def sync_measurements(
    updated_since: Optional[str] = Query(
        None, description="更新日時フィルタ（ISO8601形式）"
    ),
    page: int = Query(1, ge=1, description="ページ番号"),
    page_size: int = Query(100, ge=1, le=500, description="ページサイズ"),
):
    """
    測定データの補助Pull同期
    Webhook欠損時の補完用
    """
    try:
        # OAuth2トークン取得（認証チェック）
        token = await oauth2_client.get_token()
        
        # 外部APIから差分取得
        measurements = await external_api_client.fetch_measurements(
            updated_since=updated_since,
            page=page,
            page_size=page_size,
        )
        
        # 顧客管理API経由でupsert
        processed = 0
        failed = 0
        errors = []
        
        for measurement in measurements:
            try:
                # TODO: customer_code → customer_id 変換
                # TODO: external_order_id → order_id 変換
                measurement_data = {
                    "customer_id": "TODO",
                    "order_id": None,
                    "external_measurement_id": measurement["external_measurement_id"],
                    "source_system": "ExternalMeasurement",
                    "summary": measurement.get("summary"),
                    "measured_at": measurement.get("measured_at"),
                }
                
                await customer_api_client.upsert_measurement(measurement_data)
                processed += 1
                
            except Exception as e:
                failed += 1
                errors.append({
                    "external_measurement_id": measurement.get("external_measurement_id"),
                    "error": str(e),
                })
                logger.error(
                    "measurement_sync_failed",
                    external_measurement_id=measurement.get("external_measurement_id"),
                    error=str(e),
                )
        
        logger.info(
            "measurements_synced",
            processed=processed,
            failed=failed,
            page=page,
        )
        
        return {
            "status": "completed",
            "processed": processed,
            "failed": failed,
            "errors": errors if errors else None,
        }
        
    except Exception as e:
        logger.error("measurements_sync_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

