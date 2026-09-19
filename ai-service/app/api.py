"""
FastAPI surface for the chat agent.

The handler establishes the caller's identity and the request's idempotency key
before the agent runs, and clears nothing afterwards because each request runs
in its own context.
"""

import uuid

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app import context
from app.agent.builder import build_agent

app = FastAPI(title="Yojana Saathi AI service", version="0.1.0")


class ChatMessage(BaseModel):
    role: str = Field(description="user or assistant")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(description="Full conversation so far, oldest first")


class ChatResponse(BaseModel):
    reply: str
    correlationId: str
    trace: list[dict] = Field(default_factory=list, description="Tool and backend calls made")


def _to_strands(messages: list[ChatMessage]) -> list[dict]:
    return [{"role": m.role, "content": [{"text": m.content}]} for m in messages]


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/agent/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    authorization: str | None = Header(default=None),
    x_correlation_id: str | None = Header(default=None),
) -> ChatResponse:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization: Bearer <jwt> is required.")
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty.")
    if request.messages[-1].role != "user":
        raise HTTPException(status_code=400, detail="The last message must be from the user.")

    corr = x_correlation_id or str(uuid.uuid4())

    # Generated here, not by the model: one key per HTTP request, so a retry of
    # the same request saves one household and a second, different request is
    # free to save another.
    context.caller_jwt.set(authorization.split(" ", 1)[1].strip())
    context.correlation_id.set(corr)
    context.idempotency_key.set(str(uuid.uuid4()))
    trace: list[dict] = []
    context.call_trace.set(trace)

    history = _to_strands(request.messages)
    agent = build_agent(history[:-1])
    result = await agent.invoke_async(request.messages[-1].content)

    return ChatResponse(reply=str(result), correlationId=corr, trace=trace)
