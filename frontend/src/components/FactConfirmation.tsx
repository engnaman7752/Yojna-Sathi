import { useMemo, useState } from "react";
import type { HouseholdFacts } from "../api/types";
import { FIELD_NAMES, isSupplied, labelFor, unitSuffix, vocabulary } from "../vocabulary";

export interface FieldCorrection {
  field: string;
  extracted: string | number | boolean | null;
  corrected: string | number | boolean | null;
  wasMissing: boolean;
}

export interface FactConfirmationProps {
  extracted: HouseholdFacts;
  onConfirm: (facts: HouseholdFacts, corrections: FieldCorrection[]) => void;
  submitLabel?: string;
}

function parseValue(field: string, raw: string): string | number | boolean | null {
  if (raw === "") return null;
  const spec = vocabulary.fields[field];
  if (spec.type === "integer") {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  if (spec.type === "boolean") return raw === "true";
  return raw;
}

function toInput(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function FactConfirmation({ extracted, onConfirm, submitLabel = "Confirm" }: FactConfirmationProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELD_NAMES.map((f) => [f, toInput(extracted[f])])),
  );

  const corrections = useMemo<FieldCorrection[]>(() => {
    const out: FieldCorrection[] = [];
    for (const field of FIELD_NAMES) {
      const before = toInput(extracted[field]);
      const after = values[field];
      if (before !== after) {
        out.push({
          field,
          extracted: isSupplied(extracted[field]) ? (extracted[field] as never) : null,
          corrected: parseValue(field, after),
          wasMissing: !isSupplied(extracted[field]),
        });
      }
    }
    return out;
  }, [extracted, values]);

  const correctedFields = new Set(corrections.map((c) => c.field));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const facts: HouseholdFacts = {};
    for (const field of FIELD_NAMES) {
      const parsed = parseValue(field, values[field]);
      if (parsed !== null) facts[field] = parsed;
    }
    onConfirm(facts, corrections);
  }

  return (
    <form onSubmit={submit} aria-label="Confirm your details" className="fact-form">
      <p className="fact-form-desc">
        Please check these details. Change anything that is wrong.
      </p>
      <div className="fact-grid">
        {FIELD_NAMES.map((field) => {
          const spec = vocabulary.fields[field];
          const wasCorrected = correctedFields.has(field);
          const inputId = `fact-${field}`;
          return (
            <div
              key={field}
              className={`form-group ${wasCorrected ? "fact-corrected" : ""}`}
              data-testid={`field-${field}`}
              data-corrected={wasCorrected ? "true" : "false"}
            >
              <label htmlFor={inputId} className="form-label">
                {labelFor(field)}
                {unitSuffix(field) && <span className="fact-unit"> ({unitSuffix(field)})</span>}
                {wasCorrected && (
                  <span className="fact-changed-badge" data-testid={`corrected-${field}`}>
                    changed
                  </span>
                )}
              </label>
              {spec.type === "enum" ? (
                <select
                  id={inputId}
                  className="form-select"
                  value={values[field]}
                  onChange={(e) => setValues({ ...values, [field]: e.target.value })}
                >
                  <option value="">Not said</option>
                  {spec.values?.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : spec.type === "boolean" ? (
                <select
                  id={inputId}
                  className="form-select"
                  value={values[field]}
                  onChange={(e) => setValues({ ...values, [field]: e.target.value })}
                >
                  <option value="">Not said</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  id={inputId}
                  className="form-input"
                  type={spec.type === "integer" ? "number" : "text"}
                  inputMode={spec.type === "integer" ? "numeric" : undefined}
                  value={values[field]}
                  min={spec.min}
                  max={spec.max}
                  onChange={(e) => setValues({ ...values, [field]: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>
      <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "var(--sp-4)" }}>
        {submitLabel}
      </button>
    </form>
  );
}
