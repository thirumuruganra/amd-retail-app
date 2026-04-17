# Smart Review Vibe Checker

Smart Review Vibe Checker is a lightweight web app for retail teams. Paste a customer review, run AI analysis, and get:

- sentiment (Positive, Neutral, Negative)
- confidence score
- issue category
- suggested department routing
- detected review language
- drafted reply in the customer’s language
- one-line English summary for internal handling

The app uses a React + Vite frontend and a FastAPI backend powered by the Gemini API.

## Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: FastAPI, Pydantic, google-genai
- Deployment: Docker (Cloud Run ready)

## Project structure

- frontend/: React client app
- backend/: FastAPI API service
- Dockerfile: multi-stage build for frontend + backend runtime
- prd.md: product requirements
- implementation_plan.md: implementation notes

## Prerequisites

- Node.js 20+ (recommended)
- Python 3.10+
- A Gemini API key

## 1) Backend setup

From the project root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Create backend/.env:

```dotenv
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.0-flash
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Start the backend:

```bash
uvicorn backend.main:app --reload --port 8000
```

## 2) Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local Vite URL shown in the terminal (usually http://localhost:5173).

Note: during local development, Vite proxies /api calls to http://localhost:8000.

## API

### POST /api/analyze

Request body:

```json
{
  "review_text": "El pedido llego tarde y la caja vino rota."
}
```

Example response:

```json
{
  "sentiment": "Negative",
  "confidence_score": 0.92,
  "category": "Shipping",
  "department": "Logistics",
  "detected_language": "Spanish",
  "reply_draft": "Lamentamos mucho el retraso y el estado de la caja...",
  "summary": "Customer reports delayed delivery and damaged packaging."
}
```

### GET /health

Returns:

```json
{
  "status": "ok"
}
```

## Production build (frontend)

```bash
cd frontend
npm run build
```

After the build, FastAPI serves static files from frontend/dist.

## Docker

Build image from the project root:

```bash
docker build -t smart-review-vibe-checker .
```

Run container:

```bash
docker run --rm -p 8080:8080 -e GEMINI_API_KEY=your_api_key_here smart-review-vibe-checker
```

Open http://localhost:8080.

## Cloud Run notes

- Set GEMINI_API_KEY as an environment variable in the service config.
- Optional overrides:
  - GEMINI_MODEL
  - FRONTEND_ORIGINS

## Troubleshooting

- 500 Missing GEMINI_API_KEY environment variable:
  - Add GEMINI_API_KEY to backend/.env (local) or container/service env vars (Docker/Cloud Run).
- 502 Model returned malformed JSON:
  - Retry the request. The backend has fallback JSON parsing, but model output can still fail occasionally.
- Frontend cannot reach API in dev:
  - Confirm backend is running on port 8000.
  - Confirm frontend dev server is running from frontend/.
