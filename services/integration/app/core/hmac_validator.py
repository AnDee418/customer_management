"""
HMAC署名検証
Webhook受信時の署名検証
"""
import hmac
import hashlib
from datetime import datetime, timezone
from typing import Optional


class HMACValidator:
    def __init__(self, secret: str):
        self.secret = secret.encode()

    def generate_signature(self, timestamp: str, body: bytes) -> str:
        """HMAC-SHA256署名生成"""
        message = f"{timestamp}.{body.decode()}"
        signature = hmac.new(
            self.secret, message.encode(), hashlib.sha256
        ).hexdigest()
        return signature

    def verify_signature(
        self,
        timestamp: str,
        body: bytes,
        received_signature: str,
        max_age_seconds: int = 300,
    ) -> tuple[bool, Optional[str]]:
        """
        HMAC署名検証

        Returns:
            (is_valid, error_message)
        """
        # タイムスタンプ検証（リプレイ攻撃防止）
        try:
            ts = int(timestamp)
            now = int(datetime.now(timezone.utc).timestamp())
            if abs(now - ts) > max_age_seconds:
                return False, f"Timestamp too old or in future: {abs(now - ts)}s"
        except ValueError:
            return False, "Invalid timestamp format"

        # 署名検証
        expected_signature = self.generate_signature(timestamp, body)
        if not hmac.compare_digest(expected_signature, received_signature):
            return False, "Signature mismatch"

        return True, None

