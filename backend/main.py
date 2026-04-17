import json
import os
import re
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from google import genai

load_dotenv()


class AnalyzeRequest(BaseModel):
    review_text: str = Field(min_length=3, max_length=5000)


class AnalyzeResponse(BaseModel):
    sentiment: Literal["Positive", "Neutral", "Negative"]
    confidence_score: float = Field(ge=0, le=1)
    category: str
    department: str
    detected_language: str
    reply_draft: str
    summary: str


app = FastAPI(title="Smart Review Vibe Checker API")

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"
INDEX_FILE = FRONTEND_DIST_DIR / "index.html"

_genai_client: genai.Client | None = None


def get_genai_client() -> genai.Client:
    global _genai_client

    if _genai_client is not None:
        return _genai_client

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Missing GEMINI_API_KEY environment variable.",
        )

    _genai_client = genai.Client(api_key=api_key)
    return _genai_client


def build_prompt(review_text: str) -> str:
    return f"""
You are an AI assistant helping a retail internal support team.
Analyze the customer review and return ONLY valid JSON.

Review:
\"\"\"
{review_text}
\"\"\"

Requirements:
- Detect the sentiment as one of: Positive, Neutral, Negative.
- Return confidence_score as a decimal between 0 and 1.
- Determine the primary category (for example: Shipping, Product Quality, Customer Service, Billing, Packaging, Refunds, Website Experience).
- Route to the best department (for example: Logistics, Quality Control, Customer Service, Billing, General Support).
- Detect the language of the review.
- Draft a polite, concise reply in the SAME language as the review.
- Add a one sentence summary in English for internal teams.

Return exactly this JSON shape:
{{
  \"sentiment\": \"Positive|Neutral|Negative\",
  \"confidence_score\": 0.0,
  \"category\": \"string\",
  \"department\": \"string\",
  \"detected_language\": \"string\",
  \"reply_draft\": \"string\",
  \"summary\": \"string\"
}}
""".strip()


def parse_json_payload(raw_text: str) -> dict[str, Any]:
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not match:
            raise HTTPException(
                status_code=502,
                detail="Model returned an invalid response payload.",
            )

        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=502,
                detail="Model returned malformed JSON.",
            ) from exc


def normalize_sentiment(value: str) -> str:
    normalized = value.strip().lower()
    if normalized == "positive":
        return "Positive"
    if normalized == "neutral":
        return "Neutral"
    if normalized == "negative":
        return "Negative"
    return "Neutral"


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_review(payload: AnalyzeRequest) -> AnalyzeResponse:
    client = get_genai_client()
    prompt = build_prompt(payload.review_text)

    try:
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            contents=prompt,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API request failed: {exc}",
        ) from exc

    if not response.text:
        raise HTTPException(
            status_code=502,
            detail="Gemini API returned an empty response.",
        )

    model_json = parse_json_payload(response.text)

    try:
        result = AnalyzeResponse(
            sentiment=normalize_sentiment(str(model_json.get("sentiment", "Neutral"))),
            confidence_score=float(model_json.get("confidence_score", 0.5)),
            category=str(model_json.get("category", "General Feedback")).strip(),
            department=str(model_json.get("department", "General Support")).strip(),
            detected_language=str(model_json.get("detected_language", "Unknown")).strip(),
            reply_draft=str(model_json.get("reply_draft", "")).strip(),
            summary=str(model_json.get("summary", "")).strip(),
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected structured response format: {exc}",
        ) from exc

    return result


@app.get("/health")
def health_check() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.get("/", include_in_schema=False, response_model=None)
def serve_index() -> FileResponse | JSONResponse:
    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)

    return JSONResponse(
        {
            "message": "Smart Review Vibe Checker API",
            "hint": "Build the frontend (frontend/dist) to serve the web app from this process.",
        }
    )


@app.get("/{full_path:path}", include_in_schema=False, response_model=None)
def serve_frontend(full_path: str) -> FileResponse:
    if full_path.startswith("api") or full_path == "health":
        raise HTTPException(status_code=404, detail="Not found")

    requested_file = FRONTEND_DIST_DIR / full_path
    if requested_file.exists() and requested_file.is_file():
        return FileResponse(requested_file)

    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)

    raise HTTPException(status_code=404, detail="Frontend build not found")