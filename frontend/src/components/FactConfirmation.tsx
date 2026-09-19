import { useMemo, useState } from "react";
import type { HouseholdFacts } from "../api/types";
import { FIELD_NAMES, isSupplied, labelFor, unitSuffix, vocabulary } from "../vocabulary";

/**
 * One field the person changed after the agent extracted it. Phase 9 uses these
 * to measure extraction quality, so the shape is deliberately explicit: what
 * was extracted, what it was changed to, and whether the agent had proposed
 * anything at all.
 */
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

/**
 * Shows what the agent understood and lets the person correct it before
 * anything is decided. Every field comes from data/vocabulary.json, so the form
 * cannot offer a field the rule engine would reject.
 */
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
    <form onSubmit={submit} aria-label="Confirm your details">
      <p>Please check these details. Change anything that is wrong.</p>
      {FIELD_NAMES.map((field) => {
        const spec = vocabulary.fields[field];
        const wasCorrected = correctedFields.has(field);
        const inputId = `fact-${field}`;
        return (
          <div key={field} data-testid={`field-${field}`} data-corrected={wasCorrected ? "true" : "false"}>
            <label htmlFor={inputId}>
              {labelFor(field)} {unitSuffix(field) && <span>({unitSuffix(field)})</span>}
              {wasCorrected && <span data-testid={`corrected-${field}`}> — you changed this</span>}
            </label>
            {spec.type === "enum" ? (
              <select
                id={inputId}
                value={values[field]}
                onChange={(e) => setValues({ ...values, [field]: e.target.value })}
              >
                <option value="">Not said</option>
                {spec.values?.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : spec.type === "boolean" ? (
              <select
                id={inputId}
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
      <button type="submit">{submitLabel}</button>
    </form>
  );
}
