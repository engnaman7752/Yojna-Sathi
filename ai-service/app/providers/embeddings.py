"""
Embedding model selection, mirroring providers/models.py.

Verified against the installed packages:
  google-genai: client.models.embed_content(model=..., contents=...,
                config=EmbedContentConfig(task_type=..., output_dimensionality=...))
                -> EmbedContentResponse with .embeddings[i].values
  bedrock:      boto3 invoke_model on amazon.titan-embed-text-v2:0

task_type matters and is easy to miss: a document and a query are embedded for
different purposes, and using one type for both measurably costs recall.
"""

from __future__ import annotations

import json
from typing import Any

from app import config

GEMINI_EMBED_MODEL = "gemini-embedding-001"
BEDROCK_EMBED_MODEL = "amazon.titan-embed-text-v2:0"


class GeminiEmbedder:
    def __init__(self, api_key: str, model_id: str = GEMINI_EMBED_MODEL):
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model_id

    def _embed(self, texts: list[str], task_type: str) -> list[list[float]]:
        from google.genai import types

        response = self._client.models.embed_content(
            model=self._model,
            contents=texts,
            config=types.EmbedContentConfig(task_type=task_type),
        )
        return [list(e.values) for e in response.embeddings]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts, "RETRIEVAL_DOCUMENT")

    def embed_query(self, text: str) -> list[float]:
        return self._embed([text], "RETRIEVAL_QUERY")[0]


class BedrockEmbedder:
    def __init__(self, region: str, model_id: str = BEDROCK_EMBED_MODEL):
        import boto3

        self._client = boto3.client("bedrock-runtime", region_name=region)
        self._model = model_id

    def _one(self, text: str) -> list[float]:
        response = self._client.invoke_model(
            modelId=self._model,
            body=json.dumps({"inputText": text}),
            accept="application/json",
            contentType="application/json",
        )
        return json.loads(response["body"].read())["embedding"]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        # Titan embeds one text per call; batch at the caller if throughput matters.
        return [self._one(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._one(text)


def embedding_model() -> Any:
    provider = (config.MODEL_PROVIDER or "").strip().lower()
    if provider == "gemini":
        if not config.GEMINI_API_KEY:
            raise RuntimeError("MODEL_PROVIDER=gemini but GEMINI_API_KEY is not set.")
        return GeminiEmbedder(config.GEMINI_API_KEY)
    if provider == "bedrock":
        return BedrockEmbedder(config.AWS_REGION)
    raise ValueError(f"MODEL_PROVIDER must be 'gemini' or 'bedrock', got {config.MODEL_PROVIDER!r}")
