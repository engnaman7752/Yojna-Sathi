"""
Builds the agent for one request.

Nothing is cached between requests. The agent carries the caller's conversation
history and only theirs, and the tools read the caller's identity from request
context, so there is no object here that could leak one person's state into
another's turn.
"""

import json
from functools import lru_cache
from pathlib import Path

from strands import Agent

from app import config
from app.agent.tools import ALL_TOOLS
from app.providers.models import chat_model

_PROMPT_PATH = Path(__file__).parent / "prompts" / "system.txt"


@lru_cache(maxsize=1)
def system_prompt() -> str:
    """The system prompt with the real field vocabulary substituted in.

    The vocabulary is injected rather than transcribed so that a change to
    data/vocabulary.json reaches the model and the rule engine together. If they
    ever disagree, the model starts proposing fields the engine will reject.
    """
    template = _PROMPT_PATH.read_text(encoding="utf-8")
    vocabulary = json.loads(config.VOCABULARY_PATH.read_text(encoding="utf-8"))

    lines = []
    for name, spec in vocabulary["fields"].items():
        bits = [f"- {name} ({spec['type']}"]
        if spec.get("unit"):
            bits.append(f", {spec['unit']}")
        bits.append(")")
        line = "".join(bits)
        if spec.get("values"):
            line += " one of: " + ", ".join(spec["values"])
        if spec.get("min") is not None or spec.get("max") is not None:
            line += f" range {spec.get('min', '-')}..{spec.get('max', '-')}"
        line += f" - {spec.get('description', '').strip()}"
        lines.append(line)

    return template.replace("{{VOCABULARY}}", "\n".join(lines))


def build_agent(history: list[dict], model=None) -> Agent:
    """Create an Agent seeded with the turns that came before this one.

    history is in Strands Message form: {"role": "user"|"assistant",
    "content": [{"text": "..."}]}.
    """
    return Agent(
        model=model if model is not None else chat_model(),
        tools=ALL_TOOLS,
        system_prompt=system_prompt(),
        messages=list(history),
        callback_handler=None,  # no stdout streaming; this runs as a service
    )
