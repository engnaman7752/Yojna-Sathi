"""The tool schemas and the field vocabulary must not drift apart."""

import json

import pytest

from app import config
from app.agent.builder import system_prompt
from app.agent.tools import ALL_TOOLS

FACT_TOOLS = {"check_eligibility", "save_profile"}


@pytest.fixture(scope="module")
def vocabulary():
    return json.loads(config.VOCABULARY_PATH.read_text(encoding="utf-8"))["fields"]


@pytest.mark.parametrize("tool_name", sorted(FACT_TOOLS))
def test_fact_tool_accepts_exactly_the_vocabulary(tool_name, vocabulary):
    tool = next(t for t in ALL_TOOLS if t.tool_name == tool_name)
    params = set(tool.tool_spec["inputSchema"]["json"]["properties"])
    assert params == set(vocabulary), (
        f"{tool_name} parameters drifted from data/vocabulary.json.\n"
        f"  only in tool:       {sorted(params - set(vocabulary))}\n"
        f"  only in vocabulary: {sorted(set(vocabulary) - params)}"
    )


@pytest.mark.parametrize("tool_name", sorted(FACT_TOOLS))
def test_only_state_and_district_are_required(tool_name):
    tool = next(t for t in ALL_TOOLS if t.tool_name == tool_name)
    assert set(tool.tool_spec["inputSchema"]["json"]["required"]) == {"state", "district"}


def test_no_tool_takes_a_token_or_a_key():
    """The JWT, correlation id and idempotency key are never tool parameters."""
    forbidden = {"jwt", "token", "authorization", "correlationid", "idempotencykey",
                 "correlation_id", "idempotency_key", "userid", "user_id"}
    for tool in ALL_TOOLS:
        params = {p.lower() for p in tool.tool_spec["inputSchema"]["json"]["properties"]}
        assert not (params & forbidden), f"{tool.tool_name} exposes {params & forbidden} to the model"


def test_system_prompt_carries_the_real_vocabulary(vocabulary):
    prompt = system_prompt()
    assert "{{VOCABULARY}}" not in prompt
    for name in vocabulary:
        assert name in prompt, f"{name} is missing from the system prompt"


def test_system_prompt_states_all_seven_rules():
    prompt = system_prompt()
    for n in range(1, 8):
        assert f"\n{n}. " in prompt, f"rule {n} is missing from the system prompt"
