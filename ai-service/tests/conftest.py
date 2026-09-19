import os
import uuid

import pytest

from app import backend_client, context
from tests.stub_backend import StubBackend

USE_REAL_BACKEND = os.getenv("YOJANA_CONTRACT_TARGET", "stub").lower() == "real"


@pytest.fixture
def backend():
    """The stub backend, unless YOJANA_CONTRACT_TARGET=real.

    Against the real backend the same tests run unchanged; only the assertions
    that inspect captured requests are skipped, since there is nothing to
    inspect on the other side of a socket.
    """
    stub = StubBackend()
    if not USE_REAL_BACKEND:
        backend_client.set_transport(stub.transport)
    yield stub
    backend_client.set_transport(None)


@pytest.fixture
def caller():
    """Establishes a request context the way app.api.chat does."""
    context.caller_jwt.set("eyJ-test-caller-token")
    context.correlation_id.set("corr-test-0001")
    context.idempotency_key.set(str(uuid.uuid4()))
    trace: list = []
    context.call_trace.set(trace)
    return trace
