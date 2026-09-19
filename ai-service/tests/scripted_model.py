"""
A model that emits a fixed script of tool calls and replies.

The point is not to simulate Gemini - it cannot and does not try to. It drives
the plumbing so that the tool wiring, the header attachment, the idempotency key
and the trace can be exercised end to end without a model API key. Anything that
depends on the model's judgement (does it extract the right facts from Hindi?)
is NOT covered here and needs a real key plus the running backend.
"""

from typing import Any

from strands.models.model import Model


class ScriptedModel(Model):
    """steps: list of ("tool", name, args) and ("say", text)."""

    def __init__(self, steps: list[tuple]):
        self._steps = list(steps)
        self._config: dict[str, Any] = {"model_id": "scripted-stub"}

    def get_config(self) -> Any:
        return self._config

    def update_config(self, **model_config: Any) -> None:
        self._config.update(model_config)

    async def structured_output(self, output_model, prompt, system_prompt=None, **kwargs):
        raise NotImplementedError("the scripted model does not do structured output")

    async def stream(self, messages, tool_specs=None, system_prompt=None, **kwargs):
        if not self._steps:
            step = ("say", "(script exhausted)")
        else:
            step = self._steps.pop(0)

        yield {"messageStart": {"role": "assistant"}}
        if step[0] == "tool":
            _, name, args = step
            yield {"contentBlockStart": {"start": {"toolUse": {"name": name, "toolUseId": f"tu-{name}"}}}}
            import json as _json
            yield {"contentBlockDelta": {"delta": {"toolUse": {"input": _json.dumps(args)}}}}
            yield {"contentBlockStop": {}}
            yield {"messageStop": {"stopReason": "tool_use"}}
        else:
            yield {"contentBlockStart": {"start": {}}}
            yield {"contentBlockDelta": {"delta": {"text": step[1]}}}
            yield {"contentBlockStop": {}}
            yield {"messageStop": {"stopReason": "end_turn"}}
