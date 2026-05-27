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
