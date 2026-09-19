"""
Chat model selection.

MODEL_PROVIDER picks the provider; nothing else in the service knows which one
is in use. Verified against strands-agents 1.56.0:

    strands.models.gemini.GeminiModel(client=None, client_args=None, **config)
        config: model_id (required), params, context_window_limit,
                gemini_tools, use_native_token_count
        requires the [gemini] extra, which pulls google-genai

    strands.models.bedrock.BedrockModel(boto_session=None, boto_client_config=None,
                                        region_name=None, endpoint_url=None,
                                        api_key=None, **config)
        ships in the base package, no extra needed

The brief named the LiteLLM provider. strands.models.litellm.LiteLLMModel still
exists and works, but 1.56.0 also ships a native Gemini provider, which is one
fewer translation layer, uses Gemini's own tool-calling, and reads the
GEMINI_API_KEY variable the brief already defines. The native provider was
chosen deliberately; see README.md.
"""

from typing import Any

from app import config


def chat_model() -> Any:
    """Build the chat model for the configured provider."""
    provider = (config.MODEL_PROVIDER or "").strip().lower()

    if provider == "gemini":
        from strands.models.gemini import GeminiModel

        if not config.GEMINI_API_KEY:
            raise RuntimeError("MODEL_PROVIDER=gemini but GEMINI_API_KEY is not set.")
        return GeminiModel(
            client_args={"api_key": config.GEMINI_API_KEY},
            model_id=config.GEMINI_CHAT_MODEL,
            params={"temperature": 0.0},
        )

    if provider == "bedrock":
        from strands.models.bedrock import BedrockModel

        if not config.BEDROCK_CHAT_MODEL_ID:
            raise RuntimeError("MODEL_PROVIDER=bedrock but BEDROCK_CHAT_MODEL_ID is not set.")
        return BedrockModel(
            region_name=config.AWS_REGION,
            model_id=config.BEDROCK_CHAT_MODEL_ID,
            params={"temperature": 0.0},
        )

    raise ValueError(f"MODEL_PROVIDER must be 'gemini' or 'bedrock', got {config.MODEL_PROVIDER!r}")
