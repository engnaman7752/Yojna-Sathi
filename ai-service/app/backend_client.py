"""
The only way this service talks to the Spring Boot API.

Two rules are enforced here rather than trusted to each tool:
  - every request carries the end user's own JWT, taken from the request
    context, so authorization has one enforcement point and the AI service
    never holds a privileged key for user data;
  - every request carries X-Correlation-Id, so one conversation can be traced
    across both services.

Python never touches DynamoDB. All persistence goes through these calls.
"""

from typing import Any

import httpx

from app import config
from app.context import correlation_id, record, require_jwt

_transport: httpx.AsyncBaseTransport | None = None  # tests inject a stub here


def set_transport(transport: httpx.AsyncBaseTransport | None) -> None:
    """Point the client at a stub backend. Used by tests only."""
    global _transport
    _transport = transport


class BackendError(RuntimeError):
    """A non-2xx response, carrying the backend's { code, message, correlationId }."""

    def __init__(self, status: int, code: str, message: str, corr: str | None):
        super().__init__(f"{code}: {message}")
        self.status = status
        self.code = code
        self.backend_message = message
        self.correlation_id = corr


async def call(
    method: str,
    path: str,
    *,
    json_body: dict[str, Any] | None = None,
    extra_headers: dict[str, str] | None = None,
) -> Any:
    headers = {
        "Authorization": f"Bearer {require_jwt()}",
        "Accept": "application/json",
    }
    corr = correlation_id.get()
    if corr:
        headers["X-Correlation-Id"] = corr
    if extra_headers:
        headers.update(extra_headers)

    record(
        {
            "kind": "http",
            "method": method,
            "path": path,
            "body": json_body,
            # The token is never written to the trace or the logs.
            "headers": {k: ("<jwt>" if k == "Authorization" else v) for k, v in headers.items()},
        }
    )

    async with httpx.AsyncClient(
        base_url=config.BACKEND_URL,
        timeout=config.BACKEND_TIMEOUT_SECONDS,
        transport=_transport,
    ) as client:
        response = await client.request(method, path, json=json_body, headers=headers)

    if response.status_code >= 400:
        try:
            body = response.json()
        except Exception:
            body = {}
        raise BackendError(
            response.status_code,
            body.get("code", "BACKEND_ERROR"),
            body.get("message", response.text[:300]),
            body.get("correlationId"),
        )
    if not response.content:
        return None
    return response.json()
