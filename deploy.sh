#!/usr/bin/env bash
# =============================================================
#  Peigo Smoothie Tarot H5 – Cloud Run Deploy Script
#  Project: peigo-496213
#  Service: peigo-tarot-h5
#  Region : asia-east1 (彰化)
# =============================================================
set -euo pipefail

# 確保使用 brew 裝的 gcloud
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:${PATH}"

PROJECT_ID="${PROJECT_ID:-peigo-496213}"
REGION="${REGION:-asia-east1}"
SERVICE="${SERVICE:-peigo-tarot-h5}"
MODEL_ID="${MODEL_ID:-gemini-3-pro-image-preview}"

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
    echo "[!] 請先設定 GEMINI_API_KEY 環境變數：" >&2
    echo "    export GEMINI_API_KEY=your-image-engine-key" >&2
    exit 1
fi

cd "$(dirname "$0")"

echo "=== 1/5 設定專案 ==="
gcloud config set project "${PROJECT_ID}"
gcloud config set run/region "${REGION}"

echo "=== 2/5 啟用必要 API ==="
gcloud --quiet services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    --project "${PROJECT_ID}"

echo "=== 3/5 部署到 Cloud Run ==="
gcloud --quiet run deploy "${SERVICE}" \
    --source=. \
    --region="${REGION}" \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=1Gi \
    --cpu=1 \
    --concurrency=20 \
    --timeout=300 \
    --max-instances=10 \
    --set-env-vars="GEMINI_API_KEY=${GEMINI_API_KEY},MODEL_ID=${MODEL_ID}"

echo "=== 4/5 取得服務 URL ==="
URL=$(gcloud --quiet run services describe "${SERVICE}" --region="${REGION}" --format='value(status.url)')
echo "Service URL: ${URL}"

echo "=== 5/5 首頁檢查 ==="
curl -s -o /dev/null -w "GET / -> HTTP %{http_code}\n" "${URL}/" || true
echo ""
echo ""
echo "完成！打開瀏覽器測試：${URL}"
