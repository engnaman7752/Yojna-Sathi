# ai-service — Phase 4, the chat agent

Python, Strands Agents SDK. Talks to the Spring Boot API over HTTP and never
touches DynamoDB.

```
app/
  config.py          environment, exactly the variables the brief names
  context.py         per-request JWT, correlation id, idempotency key
  backend_client.py  the only path to the Spring Boot API
  api.py             FastAPI: POST /agent/chat
  providers/models.py   chat_model(), switching on MODEL_PROVIDER
  agent/tools.py        check_eligibility, save_profile, evaluate_household, get_scheme_details
  agent/builder.py      builds the per-request Agent
  agent/prompts/system.txt   the seven rules, with the field vocabulary injected
tests/
  stub_backend.py    stands in for the Spring Boot API
  scripted_model.py  drives the plumbing without a model API key
```

## Running

```
pip install -e '.[dev]'
export MODEL_PROVIDER=gemini GEMINI_API_KEY=... BACKEND_URL=http://localhost:8080
uvicorn app.api:app --port 8000
python -m pytest
```

## Model provider

The brief names the Strands LiteLLM provider. strands-agents 1.56.0 also ships a
native `strands.models.gemini.GeminiModel`, and that is what `chat_model()`
uses: one fewer translation layer, Gemini's own tool-calling, and it reads the
`GEMINI_API_KEY` the brief already defines. `MODEL_PROVIDER=bedrock` selects
`BedrockModel`, which needs no extra. Switching back to LiteLLM is a change to
`providers/models.py` and one dependency.

## Why the JWT is a context variable and not a tool parameter

Anything in a tool signature is something the model can read, invent or be
argued into changing. The caller's token, the correlation id and the idempotency
key are set once by the request handler and read by `backend_client`, so no
prompt can reach them.

This is safe with Strands rather than merely tidy: a synchronous `@tool` runs
through `asyncio.to_thread` and concurrent tools are dispatched with
`asyncio.create_task`, both of which propagate the current `contextvars.Context`.
`tests/test_context_isolation.py` pins that down, including two callers in
flight at once. Strands also offers `invocation_state` plus `@tool(context=True)`
for the same purpose; the contextvar was chosen because it keeps the tools
independent of the agent framework.

## The idempotency key

Minted per HTTP request in `api.py`, never by the model. If the model calls
`save_profile` twice in one turn, both carry the same key and the backend stores
one household. A genuinely separate request gets a new key.

One consequence to be aware of: two *different* households cannot be saved in a
single request, because they would share the key. If that turns out to be a real
conversation shape, the key should become per tool call plus a hash of the facts.

## What is not verified here

The tests run against `tests/stub_backend.py`. Set `YOJANA_CONTRACT_TARGET=real`
and `BACKEND_URL` to run the same assertions against the running Spring Boot
service; the assertions that inspect captured requests skip themselves.

`tests/scripted_model.py` replays a fixed sequence of tool calls. It exercises
the wiring, not the model's judgement. Whether Gemini extracts the right facts
from a Hindi description, in the right units, using only vocabulary field names,
is untested until there is an API key and a running backend.
