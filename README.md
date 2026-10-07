# Peigo Smoothie Tarot H5

TurnCloud AI OS:Banana Split powered Peigo smoothie tarot H5 experience.

## What It Does

- Mobile-first H5 flow: take a selfie, select a Peigo smoothie tarot card, generate a personalized poster.
- Static frontend served by Express.
- `/fusion-api/fuse` calls the image engine and stores generated posters under `/generated/...`.
- Cloud Run ready via Dockerfile and `deploy.sh`.

## Local Development

```bash
npm install
export GEMINI_API_KEY="your-key"
npm start
```

Open:

```text
http://localhost:8080/
```

## Deploy To Cloud Run

```bash
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
export GEMINI_API_KEY="your-key"
./deploy.sh
```

Defaults:

- Project: `peigo-496213`
- Region: `asia-east1`
- Service: `peigo-tarot-h5`

You can override them:

```bash
PROJECT_ID=peigo-496213 REGION=asia-east1 SERVICE=peigo-tarot-h5 ./deploy.sh
```

## Important

Do not commit API keys. `GEMINI_API_KEY` is injected as a Cloud Run environment variable by `deploy.sh`.

## Lead Capture（日文版 `/ja`）

AI 生成海報的等待時間，日文版會請使用者留下名字與 email：結果頁顯示「○○ さんだけのスムージー占い」，並自動寄出感謝信與資料連結。

流程：`/api/lead`（Cloud Run，驗證 + 每 IP 10 分鐘 5 次限流）→ Google Apps Script（寫入 Google Sheet、用部署者的 Google 帳號寄出感謝信與資料連結）。

設定步驟：

1. 建一份 Google Sheet → 擴充功能 → Apps Script，貼上 [`apps-script/LeadMailer.gs`](apps-script/LeadMailer.gs)。
2. 把資料（PDF）放進一個 Google Drive 資料夾，共用設定改為「知道連結的任何人」可檢視。
3. 專案設定 → 指令碼屬性：`LEAD_SECRET`（自訂一串長亂碼）、`WEBSITE_URL`，可選 `BROCHURE_URL`（資料夾連結）、`SENDER_NAME`、`REPLY_TO`。
4. 在編輯器執行一次 `testSend` 完成授權，確認自己收到測試信。
5. 部署 → 新增部署作業 → 網頁應用程式；執行身分「我」、存取權「任何人」，複製網址。
6. 設定 Cloud Run 環境變數（不會動到其他變數）：

```bash
gcloud run services update peigo-tarot-h5 --region=asia-east1 --project=peigo-496213 \
  --update-env-vars="LEAD_WEBHOOK_URL=<網頁應用程式網址>,LEAD_WEBHOOK_SECRET=<同 LEAD_SECRET>"
```

寄信額度：Google Workspace 帳號每天 1,500 封。
