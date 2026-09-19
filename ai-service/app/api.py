"""
FastAPI surface for the chat agent.

The handler establishes the caller's identity and the request's idempotency key
before the agent runs, and clears nothing afterwards because each request runs
in its own context.
"""

import uuid
import tempfile
import os
import json

from fastapi import FastAPI, Header, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import context
from app.agent.builder import build_agent
from app.extraction.page_text import extract_pages
from app.providers.models import chat_model

app = FastAPI(title="Yojana Saathi AI service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

@app.post("/admin/extract")
async def extract_scheme_rules_from_pdf(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None)
):
    """
    Extracts raw text from an uploaded government scheme PDF and uses the 
    configured LLM to generate the JSON DSL draft for the Scheme Repository.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization: Bearer <jwt> is required.")

    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # 1. Save uploaded file to temp location
    fd, temp_path = tempfile.mkstemp(suffix=".pdf")
    try:
        os.write(fd, await file.read())
        os.close(fd)
        
        # 2. Extract text from PDF using pypdf via extraction module
        doc_text = extract_pages(temp_path, doc_id=file.filename)
        combined_text = "\n\n".join([f"--- Page {p.page} ---\n{p.text}" for p in doc_text.pages])
        
        if not combined_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract any readable text from the PDF.")

        # 3. Read Vocabulary for strict LLM constraint
        vocabulary_path = context.config.VOCABULARY_PATH
        with open(vocabulary_path, "r", encoding="utf-8") as f:
            vocab = json.load(f)
            
        allowed_fields = ", ".join(vocab["fields"].keys())

        # 4. Prompt the LLM
        prompt = (
            "You are an expert analyst for the Indian Government's Yojana Saathi platform. "
            "You must read the following government scheme document and convert its eligibility rules into a strict JSON payload.\n\n"
            "This JSON payload will be loaded directly into a Java backend RuleEngine.\n\n"
            f"Here is the exact document text:\n{combined_text[:15000]}\n\n"
            "REQUIREMENTS:\n"
            "1. Output ONLY a valid JSON object. Do not include markdown codeblocks like ```json.\n"
            "2. The JSON must match this structure exactly:\n"
            "{\n"
            '  "schemeId": "short-lowercase-id-without-spaces",\n'
            '  "name": "Full Scheme Name",\n'
            '  "state": "ALL" or the specific State name (e.g. "BIHAR"),\n'
            '  "version": 1,\n'
            '  "status": "DRAFT",\n'
            '  "conditions": [\n'
            "    {\n"
            '      "id": "c1",\n'
            '      "label": "Human readable explanation if they fail",\n'
            '      "rule": { "==": [{"var": "state"}, "ALL"] },\n'
            '      "evidence": { "docId": "optional-evidence-id", "page": 1 }\n'
            "    }\n"
            "  ]\n"
            "}\n"
            f"3. You may ONLY reference these variables in your JsonLogic rules: {allowed_fields}.\n"
            "4. Keep conditions extremely simple using JsonLogic format (e.g., <=, >=, ==, in). \n"
            "5. If you cannot automatically capture a complex rule, ignore it; the human Admin will edit it before publishing.\n"
        )
        
        # 5. Invoke Model
        from strands import Agent
        model = chat_model()
        agent = Agent(model=model, system_prompt="You are an expert analyst.", tools=[])
        result = await agent.invoke_async(prompt)
        
        # 6. Parse JSON safely
        text_response = str(result).strip()
        if text_response.startswith("```json"):
            text_response = text_response.replace("```json", "", 1)
        if text_response.endswith("```"):
            text_response = text_response[:-3]
            
        return json.loads(text_response.strip())

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="The AI generated invalid JSON rules. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
