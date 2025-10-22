"""
Webhook受信エンドポイント
Webhook-first、署名検証、冪等性担保
"""
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Any, Dict
import structlog

from ..core.config import get_settings
from ..core.hmac_validator import HMACValidator
from ..core.idempotency import idempotency_store
from ..services.customer_api import customer_api_client
from ..services.resolver import ensure_customer_id
from ..services.job_tracker import job_tracker

router = APIRouter()
logger = structlog.get_logger()
settings = get_settings()

# HMAC検証インスタンス
hmac_validator = HMACValidator(settings.webhook_secret)


class OrderWebhookPayload(BaseModel):
    """発注Webhookペイロード"""
    customer_code: str = Field(..., description="顧客コード")
    external_order_id: str = Field(..., description="外部発注ID")
    title: str | None = None
    status: str | None = None
    ordered_at: str | None = None
    metadata: Dict[str, Any] | None = None


class MeasurementWebhookPayload(BaseModel):
    """測定Webhookペイロード"""
    customer_code: str = Field(..., description="顧客コード")
    external_measurement_id: str = Field(..., description="外部測定ID")
    external_order_id: str | None = None
    summary: Dict[str, Any] | None = None
    measured_at: str | None = None
    metadata: Dict[str, Any] | None = None


@router.post("/orders.updated")
async def webhook_orders_updated(
    request: Request,
    x_signature: str = Header(...),
    x_timestamp: str = Header(...),
    x_event_id: str = Header(...),
):
    """
    発注データ更新Webhook
    署名検証→冪等チェック→顧客管理API経由で反映
    """
    # 1. ボディ取得
    body_bytes = await request.body()
    
    # 2. HMAC署名検証
    is_valid, error_msg = hmac_validator.verify_signature(
        x_timestamp, body_bytes, x_signature
    )
    if not is_valid:
        logger.warning(
            "webhook_signature_invalid",
            event_id=x_event_id,
            error=error_msg,
        )
        raise HTTPException(status_code=401, detail=f"Invalid signature: {error_msg}")
    
    # 3. 冪等性チェック
    if not idempotency_store.check_and_set(x_event_id):
        logger.info(
            "webhook_duplicate",
            event_type="orders.updated",
            event_id=x_event_id,
        )
        return {"status": "duplicate", "event_id": x_event_id}
    
    # 4. ペイロード解析
    try:
        body = await request.json()
        payload = OrderWebhookPayload(**body)
    except Exception as e:
        logger.error(
            "webhook_payload_invalid",
            event_id=x_event_id,
            error=str(e),
        )
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(e)}")
    
    # 5. Integration job 作成
    job_id = await job_tracker.create_job(
        job_type="webhook_order",
        payload=payload.model_dump(),
        event_id=x_event_id,
    )
    
    # 6. 顧客管理API経由でorders反映
    try:
        # ジョブをrunningに更新
        await job_tracker.update_job_status(job_id, "running")
        
        # customer_codeからcustomer_idを解決
        customer_id = await ensure_customer_id(payload.customer_code)
        
        order_data = {
            "customer_id": customer_id,
            "external_order_id": payload.external_order_id,
            "source_system": "ExternalOrdering",
            "title": payload.title,
            "status": payload.status,
            "ordered_at": payload.ordered_at,
        }
        
        result = await customer_api_client.upsert_order(order_data)
        
        # ジョブをsucceededに更新
        await job_tracker.update_job_status(job_id, "succeeded")
        
        logger.info(
            "webhook_processed",
            event_type="orders.updated",
            event_id=x_event_id,
            job_id=job_id,
            external_order_id=payload.external_order_id,
        )
        
        return {"status": "processed", "event_id": x_event_id, "job_id": job_id, "result": result}
        
    except Exception as e:
        # ジョブをfailedに更新
        await job_tracker.update_job_status(job_id, "failed", str(e))
        logger.error(
            "webhook_processing_failed",
            event_id=x_event_id,
            job_id=job_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@router.post("/measurements.updated")
async def webhook_measurements_updated(
    request: Request,
    x_signature: str = Header(...),
    x_timestamp: str = Header(...),
    x_event_id: str = Header(...),
):
    """
    測定データ更新Webhook
    署名検証→冪等チェック→顧客管理API経由で反映
    """
    # 1. ボディ取得
    body_bytes = await request.body()
    
    # 2. HMAC署名検証
    is_valid, error_msg = hmac_validator.verify_signature(
        x_timestamp, body_bytes, x_signature
    )
    if not is_valid:
        logger.warning(
            "webhook_signature_invalid",
            event_id=x_event_id,
            error=error_msg,
        )
        raise HTTPException(status_code=401, detail=f"Invalid signature: {error_msg}")
    
    # 3. 冪等性チェック
    if not idempotency_store.check_and_set(x_event_id):
        logger.info(
            "webhook_duplicate",
            event_type="measurements.updated",
            event_id=x_event_id,
        )
        return {"status": "duplicate", "event_id": x_event_id}
    
    # 4. ペイロード解析
    try:
        body = await request.json()
        payload = MeasurementWebhookPayload(**body)
    except Exception as e:
        logger.error(
            "webhook_payload_invalid",
            event_id=x_event_id,
            error=str(e),
        )
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(e)}")
    
    # 5. Integration job 作成
    job_id = await job_tracker.create_job(
        job_type="webhook_measurement",
        payload=payload.model_dump(),
        event_id=x_event_id,
    )
    
    # 6. 顧客管理API経由でmeasurements反映
    try:
        # ジョブをrunningに更新
        await job_tracker.update_job_status(job_id, "running")
        
        # customer_codeからcustomer_idを解決
        customer_id = await ensure_customer_id(payload.customer_code)
        
        measurement_data = {
            "customer_id": customer_id,
            "external_order_id": payload.external_order_id,  # 内部APIで解決
            "order_source_system": "ExternalOrdering" if payload.external_order_id else None,
            "external_measurement_id": payload.external_measurement_id,
            "source_system": "ExternalMeasurement",
            "summary": payload.summary,
            "measured_at": payload.measured_at,
        }
        
        result = await customer_api_client.upsert_measurement(measurement_data)
        
        # ジョブをsucceededに更新
        await job_tracker.update_job_status(job_id, "succeeded")
        
        logger.info(
            "webhook_processed",
            event_type="measurements.updated",
            event_id=x_event_id,
            job_id=job_id,
            external_measurement_id=payload.external_measurement_id,
        )
        
        return {"status": "processed", "event_id": x_event_id, "job_id": job_id, "result": result}
        
    except Exception as e:
        # ジョブをfailedに更新
        await job_tracker.update_job_status(job_id, "failed", str(e))
        logger.error(
            "webhook_processing_failed",
            event_id=x_event_id,
            job_id=job_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


