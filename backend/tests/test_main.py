import json
import sys
from pathlib import Path

from fastapi import HTTPException
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend import main


class _FakeGeminiResponse:
    def __init__(self, text: str):
        self.text = text


class _FakeGeminiModels:
    def __init__(self, response_text: str | None = None, error: Exception | None = None):
        self._response_text = response_text
        self._error = error

    def generate_content(self, model: str, contents: str):
        del model, contents
        if self._error is not None:
            raise self._error
        return _FakeGeminiResponse(self._response_text or '')


class _FakeGeminiClient:
    def __init__(self, response_text: str | None = None, error: Exception | None = None):
        self.models = _FakeGeminiModels(response_text=response_text, error=error)


client = TestClient(main.app)


def test_normalize_sentiment_handles_known_and_unknown_values():
    assert main.normalize_sentiment('Positive') == 'Positive'
    assert main.normalize_sentiment(' neutral ') == 'Neutral'
    assert main.normalize_sentiment('NEGATIVE') == 'Negative'
    assert main.normalize_sentiment('mixed') == 'Neutral'


def test_parse_json_payload_accepts_plain_json():
    payload = main.parse_json_payload('{"sentiment": "Positive"}')
    assert payload['sentiment'] == 'Positive'


def test_parse_json_payload_extracts_json_from_wrapped_text():
    wrapped = '```json\n{"sentiment": "Negative"}\n```'
    payload = main.parse_json_payload(wrapped)
    assert payload['sentiment'] == 'Negative'


def test_parse_json_payload_raises_on_invalid_payload():
    try:
        main.parse_json_payload('no-json-here')
    except HTTPException as exc:
        assert exc.status_code == 502
        assert 'invalid response payload' in exc.detail.lower()
    else:
        raise AssertionError('Expected HTTPException for invalid model payload')


def test_health_endpoint_returns_ok():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


def test_analyze_endpoint_returns_structured_result(monkeypatch):
    model_output = {
        'sentiment': 'Negative',
        'confidence_score': 0.92,
        'category': 'Shipping',
        'department': 'Logistics',
        'detected_language': 'Spanish',
        'reply_draft': 'Lamentamos el retraso.',
        'summary': 'Customer reports delayed delivery.',
    }

    monkeypatch.setattr(
        main,
        'get_genai_client',
        lambda: _FakeGeminiClient(response_text=json.dumps(model_output)),
    )

    response = client.post(
        '/api/analyze',
        json={'review_text': 'Delivery was delayed and package arrived damaged.'},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload['sentiment'] == 'Negative'
    assert payload['department'] == 'Logistics'
    assert payload['confidence_score'] == 0.92


def test_analyze_endpoint_returns_502_for_upstream_failure(monkeypatch):
    monkeypatch.setattr(
        main,
        'get_genai_client',
        lambda: _FakeGeminiClient(error=RuntimeError('network timeout')),
    )

    response = client.post(
        '/api/analyze',
        json={'review_text': 'Order still not received.'},
    )

    assert response.status_code == 502
    assert 'gemini api request failed' in response.json()['detail'].lower()


def test_analyze_endpoint_returns_502_for_empty_model_response(monkeypatch):
    monkeypatch.setattr(
        main,
        'get_genai_client',
        lambda: _FakeGeminiClient(response_text=''),
    )

    response = client.post(
        '/api/analyze',
        json={'review_text': 'Package arrived but support was helpful.'},
    )

    assert response.status_code == 502
    assert 'empty response' in response.json()['detail'].lower()


def test_analyze_endpoint_validates_short_review_text():
    response = client.post('/api/analyze', json={'review_text': 'a'})
    assert response.status_code == 422
