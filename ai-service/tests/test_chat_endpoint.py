"""
End-to-end through POST /agent/chat with a scripted model.

Covers the request path: the JWT is taken from the header and never from the
body, an idempotency key is minted per request, history is seeded into the
agent, tools reach the backend with the right headers, and the trace comes back.
"""

import json

import pytest
from fastapi.testclient import TestClient

from app import backend_client
from app.agent import builder
from app.api import app
from tests.scripted_model import ScriptedModel
from tests.stub_backend import StubBackend


@pytest.fixture
def client(monkeypatch):
    stub = StubBackend()
    backend_client.set_transport(stub.transport)
    real_build = builder.build_agent
    holder = {}

    def build_with_script(history, model=None):
        return real_build(history, model=holder["model"])

    monkeypatch.setattr("app.api.build_agent", build_with_script)
    yield TestClient(app), stub, holder
    backend_client.set_transport(None)


def test_rejects_a_request_with_no_bearer_token(client):
    c, _, holder = client
    holder["model"] = ScriptedModel([("say", "hello")])
    r = c.post("/agent/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 401


def test_full_turn_calls_the_tool_and_returns_a_trace(client):
    c, stub, holder = client
    holder["model"] = ScriptedModel([
        ("tool", "check_eligibility",
         {"state": "BIHAR", "district": "PATNA", "age": 63, "maritalStatus": "WIDOWED",
          "annualIncome": 48000}),
        ("say", "आपको विधवा पेंशन मिल सकती है।"),
    ])
    r = c.post(
        "/agent/chat",
        headers={"Authorization": "Bearer eyJ-caller", "X-Correlation-Id": "corr-abc"},
        json={"messages": [
            {"role": "user", "content": "नमस्ते"},
            {"role": "assistant", "content": "नमस्ते, बताइए।"},
            {"role": "user", "content": "मैं 63 साल की विधवा हूँ, पटना में रहती हूँ।"},
        ]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["correlationId"] == "corr-abc"

    tool_calls = [e for e in body["trace"] if e["kind"] == "tool"]
    assert [t["name"] for t in tool_calls] == ["check_eligibility"]
    assert tool_calls[0]["args"]["maritalStatus"] == "WIDOWED"

    sent = stub.requests[-1]
    assert sent.headers["Authorization"] == "Bearer eyJ-caller"
    assert sent.headers["X-Correlation-Id"] == "corr-abc"
    assert "annualIncome" in json.loads(sent.content)


def test_one_request_mints_one_idempotency_key_so_a_double_save_stores_once(client):
    c, stub, holder = client
    facts = {"state": "BIHAR", "district": "PATNA", "age": 63}
    holder["model"] = ScriptedModel([
        ("tool", "save_profile", facts),
        ("tool", "save_profile", facts),   # the model tries again
        ("say", "सहेज लिया।"),
    ])
    r = c.post("/agent/chat",
               headers={"Authorization": "Bearer eyJ-caller"},
               json={"messages": [{"role": "user", "content": "मुझे रजिस्टर कीजिए"}]})
    assert r.status_code == 200, r.text
    saves = [e for e in r.json()["trace"] if e.get("name") == "save_profile"]
    assert len(saves) == 2, "the model called save_profile twice"
    assert len(stub.households) == 1, "but only one household must exist"
    keys = {rq.headers["Idempotency-Key"] for rq in stub.requests if rq.url.path == "/api/households"}
    assert len(keys) == 1, "both saves must carry the one key minted for this request"
