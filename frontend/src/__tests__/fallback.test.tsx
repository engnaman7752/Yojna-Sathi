import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPage } from "../pages/ChatPage";
import { ResultsView } from "../components/ResultsView";
import type { EligibilityCheckResponse } from "../api/types";

const RESULT: EligibilityCheckResponse = {
  correlationId: "corr-1",
  schemesEvaluated: 2,
  eligible: [{
    schemeId: "ignwps", schemeName: "IGNWPS", version: 1, eligible: true,
    conditions: [{ conditionId: "is-a-widow", label: "The applicant must be a widow", passed: true,
                   evidence: { docId: "nsap-guidelines", page: 12 } }],
  }],
  notEligible: [{
    schemeId: "pm-kisan", schemeName: "PM-KISAN", version: 1, eligible: false,
    conditions: [{ conditionId: "owns-cultivable-land",
                   label: "The family must own cultivable land in the official land records",
                   passed: false }],
  }],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("agent failure falls back to the direct form", () => {
  it("shows the manual form when the ai-service cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<ChatPage token="tok" />);

    await userEvent.type(screen.getByLabelText(/type in any language/i), "मैं 63 साल की विधवा हूँ");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(screen.getByTestId("manual-fallback")).toBeInTheDocument());
    // the chat input is gone, so the person is not left retrying a dead service
    expect(screen.queryByLabelText(/type in any language/i)).not.toBeInTheDocument();
  });

  it("the manual form reaches the rule engine and shows real results", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))   // ai-service down
      .mockResolvedValue(json(200, RESULT));                     // backend is fine
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatPage token="tok" />);
    await userEvent.type(screen.getByLabelText(/type in any language/i), "नमस्ते");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByTestId("manual-fallback")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/^state/i), "BIHAR");
    await userEvent.type(screen.getByLabelText(/^district/i), "PATNA");
    await userEvent.click(screen.getByRole("button", { name: /check schemes/i }));

    await waitFor(() => expect(screen.getByTestId("eligible-ignwps")).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toMatch(/\/api\/eligibility\/check$/);
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("an ordinary chat error is shown as a message, not as a fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(403, { code: "X", message: "no" })));
    render(<ChatPage token="tok" />);
    await userEvent.type(screen.getByLabelText(/type in any language/i), "hi");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/do not have permission/i));
    expect(screen.queryByTestId("manual-fallback")).not.toBeInTheDocument();
  });
});

describe("results view", () => {
  it("shows failed condition labels for schemes that did not match", () => {
    render(<ResultsView result={RESULT} />);
    expect(screen.getByTestId("failed-pm-kisan-owns-cultivable-land"))
      .toHaveTextContent("The family must own cultivable land in the official land records");
  });

  it("lists the document and page for an eligible scheme", () => {
    render(<ResultsView result={RESULT} />);
    expect(screen.getByTestId("eligible-ignwps")).toHaveTextContent(/see page 12/i);
  });
});
