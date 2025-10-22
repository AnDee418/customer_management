"""
OAuth2 Client Credentials認証
内部API呼び出し用トークン取得
"""
import httpx
from datetime import datetime, timedelta
from typing import Optional
from .config import settings


class OAuth2Client:
    def __init__(self):
        self._token: Optional[str] = None
        self._expires_at: Optional[datetime] = None

    async def get_token(self) -> str:
        """トークン取得（キャッシュ有効時はキャッシュから返す）"""
        if self._token and self._expires_at and self._expires_at > datetime.now():
            return self._token

        async with httpx.AsyncClient() as client:
            response = await client.post(
                settings.oauth2_token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.oauth2_client_id,
                    "client_secret": settings.oauth2_client_secret,
                },
                headers={"Cache-Control": "no-store"},
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

            self._token = data["access_token"]
            # 有効期限の90%で更新
            self._expires_at = datetime.now() + timedelta(
                seconds=data["expires_in"] * 0.9
            )

            return self._token


# シングルトンインスタンス
oauth2_client = OAuth2Client()

