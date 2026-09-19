"""
The caller's identity reaches the tools, and two callers never see each other's.

Strands runs a synchronous tool via asyncio.to_thread and dispatches concurrent
tools with asyncio.create_task. Both propagate the current context, which is
what makes the contextvar approach safe here rather than merely convenient.
"""

import asyncio
import uuid

import pytest

from app import context
from app.agent.tools import check_eligibility, save_profile


async def test_tool_refuses_to_run_without_a_caller():
    context.caller_jwt.set(None)
    with pytest.raises(context.MissingCallerIdentity):
        await check_eligibility(state="BIHAR", district="PATNA")


async def test_two_concurrent_callers_do_not_mix(backend):
    async def one_request(token: str, district: str):
        context.caller_jwt.set(token)
        context.correlation_id.set(f"corr-{token}")
        context.idempotency_key.set(str(uuid.uuid4()))
        context.call_trace.set([])
        await asyncio.sleep(0)  # force interleaving
        await check_eligibility(state="BIHAR", district=district)
        return token

    await asyncio.gather(
        asyncio.create_task(one_request("token-A", "PATNA")),
        asyncio.create_task(one_request("token-B", "GAYA")),
    )

    seen = {
        r.headers["Authorization"]: __import__("json").loads(r.content)["district"]
        for r in backend.requests
    }
    assert seen == {"Bearer token-A": "PATNA", "Bearer token-B": "GAYA"}


async def test_save_profile_needs_an_idempotency_key_from_the_handler(backend):
    context.caller_jwt.set("token-A")
    context.idempotency_key.set(None)
    context.call_trace.set([])
    with pytest.raises(context.MissingCallerIdentity):
        await save_profile(state="BIHAR", district="PATNA")
