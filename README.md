# ChatKit Session Server

Simple Express proxy that issues ChatKit sessions via OpenAI and returns a client secret to the caller. Intended for deployment on Railway with environment variable configuration.

## Requirements
- Node.js 18+ (for built-in `fetch`)
- Environment variables:
  - `OPENAI_API_KEY` (required)
  - `CHATKIT_WORKFLOW_ID` (required)
  - `ALLOWED_ORIGINS` (optional, comma-separated)

## Setup
```bash
npm install
npm start # defaults to PORT=3000
```

## Endpoints
- `GET /` → `{ ok: true }` health check
- `POST /api/chatkit/session`
  - Body: `{ "user": "some-id" }` (defaults to `"anonymous"`)
  - Proxies to `https://api.openai.com/v1/chatkit/sessions` and returns `{ "client_secret": "<value>" }` on success.

## CORS
- If `ALLOWED_ORIGINS` is set, only those origins are allowed; otherwise all origins are allowed (useful for testing).

## Deployment Guide
1. Create a new GitHub repository and push:
   - `git init && git add . && git commit -m "Initial commit"`
   - `git branch -M main`
   - `git remote add origin git@github.com:<your-username>/<repo>.git`
   - `git push -u origin main`
2. In Railway: New Project → GitHub Repository → select the repo → deploy.
3. Set Railway Variables: `OPENAI_API_KEY`, `CHATKIT_WORKFLOW_ID`, and optionally `ALLOWED_ORIGINS`.
4. Test after deploy:
   ```bash
   curl -X POST https://<railway-domain>/api/chatkit/session \
     -H "Content-Type: application/json" \
     -d '{"user":"test"}'
   ```
# inblabhomepage
