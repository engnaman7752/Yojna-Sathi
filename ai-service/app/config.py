"""Environment configuration. Exactly the variables named in PROJECT_BRIEF.md."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "gemini")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-3.6-flash")

BEDROCK_CHAT_MODEL_ID = os.getenv("BEDROCK_CHAT_MODEL_ID")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
BACKEND_TIMEOUT_SECONDS = float(os.getenv("BACKEND_TIMEOUT_SECONDS", "20"))

# RETRIEVER / CHROMA_URL / BEDROCK_KB_ID belong to Phase 7 and are not read here.

# data/vocabulary.json is the single source of truth for field names. The agent
# reads it so the prompt and the tool schemas cannot drift from the rule engine.
DATA_DIR = Path(os.getenv("YOJANA_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
VOCABULARY_PATH = DATA_DIR / "vocabulary.json"
