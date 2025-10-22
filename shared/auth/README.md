# 共通認証ライブラリ

OAuth2 Client Credentials認証の共通実装

## Python実装（FastAPI用）

```python
# shared/auth/oauth2_client.py
import httpx
from datetime import datetime, timedelta
from typing import Optional

class OAuth2Client:
    def __init__(self, token_url: str, client_id: str, client_secret: str):
        self.token_url = token_url
        self.client_id = client_id
        self.client_secret = client_secret
        self._token: Optional[str] = None
        self._expires_at: Optional[datetime] = None

    async def get_token(self) -> str:
        if self._token and self._expires_at and self._expires_at > datetime.now():
            return self._token

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Cache-Control": "no-store"},
            )
            response.raise_for_status()
            data = response.json()
            
            self._token = data["access_token"]
            self._expires_at = datetime.now() + timedelta(seconds=data["expires_in"] * 0.9)
            
            return self._token
```

## TypeScript実装

`lib/auth/oauth2.ts` を参照

