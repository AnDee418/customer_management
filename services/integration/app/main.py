"""
FastAPI 連携サービス - メインエントリポイント
外部API連携（Webhook-first）、OAuth2 CC認証、リアルタイム最優先
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.api import webhooks, sync

# ログ初期化
setup_logging()
logger = structlog.get_logger()

settings = get_settings()

app = FastAPI(
    title="Customer Management Integration Service",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
)

# CORS（必要に応じて制限）
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy", "service": "integration"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """グローバル例外ハンドラ"""
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={"Cache-Control": "no-store"},
    )


# ルータ登録
app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
app.include_router(sync.router, prefix="/sync", tags=["sync"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


