"""
A stand-in for the Spring Boot API, as an httpx transport.

It exists because the real backend is a separate service that has to be running
and seeded before a contract test can talk to it. The stub implements only the
parts of the contract these tests assert on - including the idempotency
behaviour, so the duplicate-save test is really testing something.

To run the same tests against the real backend, do not point them at this stub:
set BACKEND_URL and leave the transport unset (see conftest.py).
"""

import json
import uuid

import httpx

CENTRAL_RESULT = {
    "eligible": [{"schemeId": "ignwps", "schemeName": "IGNWPS", "version": 1, "eligible": True,
                  "conditions": []}],
    "notEligible": [{"schemeId": "pm-kisan", "schemeName": "PM-KISAN", "version": 1, "eligible": False,
                     "conditions": [{"conditionId": "owns-cultivable-land",
                                     "label": "The family must own cultivable land in the official land records",
                                     "passed": False}]}],
    "schemesEvaluated": 2,
}


class StubBackend:
    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.idempotency: dict[str, dict] = {}   # key -> stored response
        self.households: dict[str, dict] = {}    # id  -> facts

    @property
    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path

        if request.headers.get("Authorization", "") == "":
            return httpx.Response(401, json={"code": "UNAUTHENTICATED", "message": "no token",
                                             "correlationId": "stub"})

        if path == "/api/eligibility/check":
            return httpx.Response(200, json=CENTRAL_RESULT)

        if path == "/api/households" and request.method == "POST":
            key = request.headers.get("Idempotency-Key")
            if not key:
                return httpx.Response(400, json={"code": "IDEMPOTENCY_KEY_REQUIRED",
                                                 "message": "Idempotency-Key header is required",
                                                 "correlationId": "stub"})
            if key in self.idempotency:
                # Duplicate: return the stored result, create nothing new.
                return httpx.Response(200, json=self.idempotency[key])
            household_id = f"hh-{uuid.uuid4().hex[:8]}"
            self.households[household_id] = json.loads(request.content or b"{}")
            stored = {"householdId": household_id, "created": True}
            self.idempotency[key] = stored
            return httpx.Response(201, json=stored)

        if path.endswith("/eligibility") and path.startswith("/api/households/"):
            return httpx.Response(200, json=CENTRAL_RESULT)

        if path.startswith("/api/schemes/"):
            scheme_id = path.rsplit("/", 1)[-1]
            if scheme_id == "ignwps":
                return httpx.Response(200, json={"schemeId": "ignwps", "name": "IGNWPS",
                                                 "state": "ALL", "version": 1, "status": "PUBLISHED"})
            return httpx.Response(404, json={"code": "SCHEME_NOT_FOUND",
                                             "message": f"No published scheme {scheme_id}",
                                             "correlationId": "stub"})

        return httpx.Response(404, json={"code": "NOT_FOUND", "message": path, "correlationId": "stub"})
