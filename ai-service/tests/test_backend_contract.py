"""
Contract between the AI service and the Spring Boot API.

Runs against the stub by default. Set YOJANA_CONTRACT_TARGET=real and
BACKEND_URL=http://localhost:8080 to run the same assertions against the
running backend; the request-inspection assertions skip themselves there.
"""

import json

import pytest

from tests.conftest import USE_REAL_BACKEND
from app.agent.tools import (check_eligibility, evaluate_household,
                             get_scheme_details, save_profile)

inspects_requests = pytest.mark.skipif(
    USE_REAL_BACKEND, reason="captured requests are only visible with the stub")


async def test_every_call_carries_the_callers_jwt_and_correlation_id(backend, caller):
    await check_eligibility(state="BIHAR", district="PATNA", age=63)
    if USE_REAL_BACKEND:
        return
    sent = backend.requests[-1]
    assert sent.headers["Authorization"] == "Bearer eyJ-test-caller-token"
    assert sent.headers["X-Correlation-Id"] == "corr-test-0001"


@inspects_requests
async def test_unsupplied_facts_are_omitted_not_zeroed(backend, caller):
    """Absent must stay absent: the engine treats 0 and 'not asked' differently."""
    await check_eligibility(state="BIHAR", district="PATNA", age=63, monthlyPension=0)
    body = json.loads(backend.requests[-1].content)
    assert body == {"state": "BIHAR", "district": "PATNA", "age": 63, "monthlyPension": 0}
    assert "annualIncome" not in body
    assert "studentClass" not in body


async def test_check_eligibility_reports_the_engines_verdict(backend, caller):
    result = await check_eligibility(state="BIHAR", district="PATNA", age=63,
                                     maritalStatus="WIDOWED", annualIncome=48000)
    assert result["status"] == "success"
    payload = result["content"][0]["json"]
    assert [s["schemeId"] for s in payload["eligible"]] == ["ignwps"]
    # The failed condition's label travels with it, so the agent can say why not.
    assert payload["notEligible"][0]["conditions"][0]["label"]


@inspects_requests
async def test_save_profile_sends_the_handlers_idempotency_key(backend, caller):
    await save_profile(state="BIHAR", district="PATNA", age=63)
    assert backend.requests[-1].headers.get("Idempotency-Key")


async def test_duplicate_save_does_not_create_a_second_household(backend, caller):
    """Same request, same key: one household, and the stored result comes back."""
    first = await save_profile(state="BIHAR", district="PATNA", age=63)
    second = await save_profile(state="BIHAR", district="PATNA", age=63)

    assert first["status"] == "success" and second["status"] == "success"
    first_id = first["content"][0]["json"]["householdId"]
    second_id = second["content"][0]["json"]["householdId"]
    assert first_id == second_id, "a duplicate save created a second household"
    if not USE_REAL_BACKEND:
        assert len(backend.households) == 1


async def test_evaluate_household_uses_the_stored_record(backend, caller):
    saved = await save_profile(state="BIHAR", district="PATNA", age=63)
    household_id = saved["content"][0]["json"]["householdId"]
    result = await evaluate_household(householdId=household_id)
    assert result["status"] == "success"
    if not USE_REAL_BACKEND:
        assert backend.requests[-1].url.path == f"/api/households/{household_id}/eligibility"


async def test_unknown_scheme_is_an_error_the_agent_can_report(backend, caller):
    result = await get_scheme_details(schemeId="no-such-scheme")
    assert result["status"] == "error"
    assert result["content"][0]["json"]["code"] == "SCHEME_NOT_FOUND"


async def test_trace_records_the_tool_call_and_the_http_call(backend, caller):
    await get_scheme_details(schemeId="ignwps")
    kinds = [e["kind"] for e in caller]
    assert kinds == ["tool", "http"]
    assert caller[0]["name"] == "get_scheme_details"
    assert caller[1]["headers"]["Authorization"] == "<jwt>", "the token must never reach the trace"
