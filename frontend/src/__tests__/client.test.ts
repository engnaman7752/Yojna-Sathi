import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, ServiceUnreachable, request } from "../api/client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("attaches the JWT and a correlation id to every request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/api/eligibility/check", { method: "POST", body: { state: "BIHAR" }, token: "tok-1" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok-1");
    expect(init.headers["X-Correlation-Id"]).toMatch(/.+/);
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("reuses a correlation id when one is supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);
    await request("/x", { token: "t", correlationId: "corr-fixed" });
    expect(fetchMock.mock.calls[0][1].headers["X-Correlation-Id"]).toBe("corr-fixed");
  });

  it.each([
    ["CONSENT_EXPIRED", /permission has expired/i],
    ["OUT_OF_DISTRICT", /another district/i],
    ["SELF_APPROVAL_FORBIDDEN", /someone else has to publish/i],
    ["SOMETHING_ELSE", /do not have permission/i],
  ])("turns a 403 %s into a readable message", async (code, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(403, { code, message: "Denied by policy", correlationId: "c1", policyId: "p1" }),
    ));
    const err = (await request("/x", { token: "t" }).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.friendly).toMatch(expected);
    // the developer detail is kept on the object, not put in the sentence
    expect(err.friendly).not.toMatch(/p1|policy/i);
    expect(err.policyId).toBe("p1");
    expect(err.correlationId).toBe("c1");
  });

  it("keeps a 401 distinct from a 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { code: "UNAUTHENTICATED", message: "x" })));
    const err = (await request("/x", { token: "t" }).catch((e) => e)) as ApiError;
    expect(err.friendly).toMatch(/sign in again/i);
  });

  it("reports a network failure as unreachable, not as an error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = (await request("/agent/chat", { token: "t", serviceName: "ai-service" }).catch((e) => e)) as unknown;
    expect(err).toBeInstanceOf(ServiceUnreachable);
    expect((err as ServiceUnreachable).service).toBe("ai-service");
  });

  it("treats a 5xx from the ai-service as unreachable so the fallback engages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503, { code: "X", message: "down" })));
    const err = (await request("/agent/chat", { token: "t", serviceName: "ai-service" }).catch((e) => e)) as unknown;
    expect(err).toBeInstanceOf(ServiceUnreachable);
  });

  it("does not treat a backend 5xx as unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { code: "INTERNAL_ERROR", message: "boom" })));
    const err = (await request("/x", { token: "t" }).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.friendly).toMatch(/our end/i);
  });
});
