# FastAPI 連携サービス Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 依存関係インストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコピー
COPY ./app ./app

# 非rootユーザーで実行
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:8000/health')"

# 起動
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


