import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FactConfirmation } from "../components/FactConfirmation";
import { FIELD_NAMES } from "../vocabulary";

describe("fact confirmation", () => {
  it("renders one input per vocabulary field and nothing else", () => {
    render(<FactConfirmation extracted={{}} onConfirm={() => {}} />);
    for (const field of FIELD_NAMES) {
      expect(screen.getByTestId(`field-${field}`)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/^field-/)).toHaveLength(FIELD_NAMES.length);
  });

  it("offers only the allowed values for an enum field", () => {
    render(<FactConfirmation extracted={{}} onConfirm={() => {}} />);
    const select = screen.getByLabelText(/social category/i) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["", "GEN", "OBC", "SC", "ST"]);
  });

  it("marks a field the person corrected and reports what changed", async () => {
    const onConfirm = vi.fn();
    render(<FactConfirmation extracted={{ state: "BIHAR", district: "PATNA", age: 63 }} onConfirm={onConfirm} />);

    expect(screen.getByTestId("field-age")).toHaveAttribute("data-corrected", "false");
    const age = screen.getByLabelText(/^age/i);
    await userEvent.clear(age);
    await userEvent.type(age, "65");

    expect(screen.getByTestId("field-age")).toHaveAttribute("data-corrected", "true");
    expect(screen.getByTestId("corrected-age")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    const [facts, corrections] = onConfirm.mock.calls[0];
    expect(facts.age).toBe(65);
    expect(corrections).toEqual([
      { field: "age", extracted: 63, corrected: 65, wasMissing: false },
    ]);
  });

  it("records a field the agent never proposed as wasMissing", async () => {
    const onConfirm = vi.fn();
    render(<FactConfirmation extracted={{ state: "BIHAR", district: "PATNA" }} onConfirm={onConfirm} />);
    await userEvent.type(screen.getByLabelText(/annual household income/i), "48000");
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));

    const [facts, corrections] = onConfirm.mock.calls[0];
    expect(facts.annualIncome).toBe(48000);
    expect(corrections).toEqual([
      { field: "annualIncome", extracted: null, corrected: 48000, wasMissing: true },
    ]);
  });

  it("leaves unanswered fields out of the payload rather than sending zero", async () => {
    const onConfirm = vi.fn();
    render(<FactConfirmation extracted={{ state: "BIHAR", district: "PATNA" }} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    const [facts] = onConfirm.mock.calls[0];
    expect(Object.keys(facts).sort()).toEqual(["district", "state"]);
    expect("annualIncome" in facts).toBe(false);
  });
});
