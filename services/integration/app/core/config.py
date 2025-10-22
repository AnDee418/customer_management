"""
設定管理
環境変数から設定を読み込み
"""
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """アプリケーション設定"""
    
    # 基本
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    
    # OAuth2 Client Credentials（内部API認証用）
    oauth2_token_url: str = ""
    oauth2_client_id: str = ""
    oauth2_client_secret: str = ""
    
    # 外部API
    external_ordering_api_url: str = ""
    external_measurement_api_url: str = ""
    external_api_key: str = ""
    
    # Webhook（HMAC署名検証用）
    webhook_secret: str = ""
    
    # 顧客管理サービス内部API
    customer_api_base_url: str = ""
    
    # 再試行・レート制限
    MAX_RETRY_ATTEMPTS: int = 5
    BACKOFF_MAX_SECONDS: int = 300
    RATE_LIMIT_PER_MINUTE: int = 100
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """設定シングルトン"""
    return Settings()


