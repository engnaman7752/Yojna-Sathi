import { useMemo, useState } from "react";
import { FIELD_NAMES, labelFor, vocabulary, type FieldSpec } from "../vocabulary";

/**
 * Form-based scheme editor for non-technical admins.
 *
 * Instead of asking admins to write JsonLogic by hand (which is what a raw
 * JSON textarea forces), this component builds up scheme conditions using
 * plain-language dropdowns: pick a field, pick an operator, pick a value.
 * Under the hood it produces the same JsonLogic the backend RuleEngine
 * expects, so the switch is invisible downstream.
 *
 * A collapsible "Advanced" panel still shows the raw JSON for reviewers who
 * want to see or copy it, and can accept AI-drafted JSON via the parent's
 * onLoadJson callback.
 */

export type Operator = "==" | "!=" | "<=" | ">=" | "<" | ">" | "in" | "!in";

export interface UiCondition {
  id: string;
  label: string;
  field: string;
  operator: Operator;
  valueText: string;      // for numbers and single values
  values: string[];       // for `in` / `!in`
  evidencePage: string;   // stored as string, coerced on save
}

export interface SchemeForm {
  schemeId: string;
  name: string;
  state: string;
  version: number;
  conditions: UiCondition[];
}

const INDIAN_STATES = [
  "ALL", "ANDHRA_PRADESH", "ARUNACHAL_PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH",
  "DELHI", "GOA", "GUJARAT", "HARYANA", "HIMACHAL_PRADESH", "JHARKHAND", "KARNATAKA",
  "KERALA", "MADHYA_PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM",
  "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL_NADU", "TELANGANA",
  "TRIPURA", "UTTAR_PRADESH", "UTTARAKHAND", "WEST_BENGAL",
];

const OPERATOR_LABELS: Record<Operator, string> = {
  "==": "is equal to",
  "!=": "is not equal to",
  "<=": "is at most",
  ">=": "is at least",
  "<":  "is less than",
  ">":  "is more than",
  "in": "is one of",
  "!in": "is NOT one of",
};

/** Which operators make sense for each field type. */
function operatorsFor(spec: FieldSpec | undefined): Operator[] {
  if (!spec) return ["==", "!="];
  if (spec.type === "boolean") return ["=="];
  if (spec.type === "enum")    return ["==", "!=", "in", "!in"];
  if (spec.type === "integer") return [">=", "<=", ">", "<", "==", "!="];
  return ["==", "!="];
}

let uid = 0;
const newId = () => `c${Date.now()}_${uid++}`;

export function emptyForm(): SchemeForm {
  return {
    schemeId: "new-scheme",
    name: "New Scheme",
    state: "ALL",
    version: 1,
    conditions: [],
  };
}

/**
 * Try to convert a scheme JSON (from AI or the backend) back into form
 * conditions. Anything that doesn't fit the simple {op:[{var:X}, value]}
 * shape is dropped with a warning - the admin can still edit the raw JSON
 * via the Advanced panel.
 */
export function formFromJson(json: any): { form: SchemeForm; dropped: number } {
  const form: SchemeForm = {
    schemeId: json?.schemeId ?? "new-scheme",
    name: json?.name ?? "New Scheme",
    state: json?.state ?? "ALL",
    version: Number(json?.version) || 1,
    conditions: [],
  };
  let dropped = 0;
  for (const c of json?.conditions ?? []) {
    const parsed = parseRule(c?.rule);
    if (!parsed) { dropped++; continue; }
    form.conditions.push({
      id: c?.id || newId(),
      label: c?.label || "",
      field: parsed.field,
      operator: parsed.op,
      valueText: parsed.valueText,
      values: parsed.values,
      evidencePage: c?.evidence?.page != null ? String(c.evidence.page) : "",
    });
  }
  return { form, dropped };
}

function parseRule(rule: any): { field: string; op: Operator; valueText: string; values: string[] } | null {
  if (!rule || typeof rule !== "object") return null;
  const keys = Object.keys(rule);
  if (keys.length !== 1) return null;
  const op = keys[0] as Operator;
  const args = rule[op];
  if (!Array.isArray(args) || args.length !== 2) return null;
  const [left, right] = args;
  if (!left || typeof left !== "object" || typeof left.var !== "string") return null;
  const field = left.var;
  if (op === "in" || op === "!in") {
    const arr = Array.isArray(right) ? right : [right];
    return { field, op, valueText: "", values: arr.map(String) };
  }
  return { field, op, valueText: String(right), values: [] };
}

/**
 * Convert form conditions back into the scheme JSON the backend expects.
 * The rule is emitted as JsonLogic; numeric field types get numeric values.
 */
export function formToJson(form: SchemeForm): any {
  const conditions = form.conditions.map(c => {
    const spec = vocabulary.fields[c.field];
    let ruleValue: any;
    if (c.operator === "in" || c.operator === "!in") {
      ruleValue = c.values.length ? c.values : [c.valueText];
    } else if (spec?.type === "integer" && !isNaN(Number(c.valueText))) {
      ruleValue = Number(c.valueText);
    } else if (spec?.type === "boolean") {
      ruleValue = c.valueText === "true" || c.valueText === "TRUE" || c.valueText === "yes";
    } else {
      ruleValue = c.valueText;
    }
    const rule: any = { [c.operator]: [{ var: c.field }, ruleValue] };
    const cond: any = {
      id: c.id,
      label: c.label || `${labelFor(c.field)} ${OPERATOR_LABELS[c.operator]} ${
        c.operator === "in" || c.operator === "!in" ? c.values.join(", ") : c.valueText
      }`,
      rule,
    };
    if (c.evidencePage.trim()) {
      cond.evidence = { page: parseInt(c.evidencePage) };
    }
    return cond;
  });
  return {
    schemeId: form.schemeId.trim(),
    name: form.name.trim(),
    state: form.state.trim() || "ALL",
    version: form.version,
    conditions,
  };
}

export function SchemeEditor({
  value, onChange,
}: {
  value: SchemeForm;
  onChange: (next: SchemeForm) => void;
}) {
  const [rawJson, setRawJson] = useState<string>("");

  const jsonPreview = useMemo(() => JSON.stringify(formToJson(value), null, 2), [value]);

  const addCondition = () => {
    onChange({
      ...value,
      conditions: [
        ...value.conditions,
        {
          id: newId(),
          label: "",
          field: "state",
          operator: "==",
          valueText: "ALL",
          values: [],
          evidencePage: "",
        },
      ],
    });
  };

  const updateCondition = (idx: number, patch: Partial<UiCondition>) => {
    const next = [...value.conditions];
    next[idx] = { ...next[idx], ...patch };
    // Reset value/values if operator or field changed to something incompatible.
    if (patch.field || patch.operator) {
      const spec = vocabulary.fields[next[idx].field];
      const ops = operatorsFor(spec);
      if (!ops.includes(next[idx].operator)) next[idx].operator = ops[0];
    }
    onChange({ ...value, conditions: next });
  };

  const removeCondition = (idx: number) => {
    const next = value.conditions.filter((_, i) => i !== idx);
    onChange({ ...value, conditions: next });
  };

  const loadFromRaw = () => {
    try {
      const parsed = JSON.parse(rawJson);
      const { form, dropped } = formFromJson(parsed);
      onChange(form);
      if (dropped > 0) {
        alert(`Loaded successfully. ${dropped} condition(s) had complex rules the form editor can't show — they're in the Advanced JSON but won't appear in the visual editor. Save will preserve only what's in the visual editor above.`);
      }
    } catch (e) {
      alert("That JSON is not valid: " + (e as Error).message);
    }
  };

  return (
    <div>
      {/* Basic info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)", marginBottom: "var(--sp-4)" }}>
        <div className="form-group">
          <label className="form-label">Scheme name (shown to citizens)</label>
          <input className="form-input" value={value.name} placeholder="e.g. Pradhan Mantri Awas Yojana"
                 onChange={e => onChange({ ...value, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Short ID (letters, digits, hyphens)</label>
          <input className="form-input" value={value.schemeId} placeholder="e.g. pm-awas"
                 onChange={e => onChange({ ...value, schemeId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
        </div>
        <div className="form-group">
          <label className="form-label">Applies to state</label>
          <select className="form-select" value={value.state}
                  onChange={e => onChange({ ...value, state: e.target.value })}>
            <option value="ALL">All India (Central scheme)</option>
            {INDIAN_STATES.filter(s => s !== "ALL").map(s =>
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Version number</label>
          <input type="number" className="form-input" value={value.version} min={1}
                 onChange={e => onChange({ ...value, version: parseInt(e.target.value) || 1 })} />
        </div>
      </div>

      {/* Conditions list */}
      <div style={{ marginTop: "var(--sp-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3)" }}>
          <div>
            <h3 style={{ margin: 0 }}>Eligibility conditions</h3>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", margin: 0 }}>
              A citizen must meet ALL of these to be eligible. Add one row per rule.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={addCondition}>+ Add Condition</button>
        </div>

        {value.conditions.length === 0 && (
          <div className="empty-state-card glass-card">
            <div style={{ fontSize: "2rem" }}>📋</div>
            <p>No conditions yet. Click <strong>+ Add Condition</strong> to build the first eligibility rule.</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {value.conditions.map((c, idx) => {
            const spec = vocabulary.fields[c.field];
            const ops = operatorsFor(spec);
            const isEnum = spec?.type === "enum";
            const isBool = spec?.type === "boolean";
            return (
              <div key={c.id} className="glass-card" style={{ padding: "var(--sp-4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-3)" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Condition {idx + 1}</span>
                  <button type="button"
                          onClick={() => removeCondition(idx)}
                          style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.85rem" }}>
                    🗑️ Remove
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: "var(--sp-3)" }}>
                  <label className="form-label">If failed, tell the citizen:</label>
                  <input className="form-input" value={c.label}
                         placeholder="e.g. Household income must be under ₹2,00,000 per year"
                         onChange={e => updateCondition(idx, { label: e.target.value })} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--sp-3)", alignItems: "end" }}>
                  <div className="form-group">
                    <label className="form-label">Field</label>
                    <select className="form-select" value={c.field}
                            onChange={e => updateCondition(idx, { field: e.target.value })}>
                      {FIELD_NAMES.map(f => <option key={f} value={f}>{labelFor(f)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Comparison</label>
                    <select className="form-select" value={c.operator}
                            onChange={e => updateCondition(idx, { operator: e.target.value as Operator })}>
                      {ops.map(o => <option key={o} value={o}>{OPERATOR_LABELS[o]}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Value{spec?.unit ? ` (${spec.unit})` : ""}</label>
                    {isBool ? (
                      <select className="form-select" value={c.valueText}
                              onChange={e => updateCondition(idx, { valueText: e.target.value })}>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (c.operator === "in" || c.operator === "!in") && isEnum ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--bg-surface)", padding: "0.5rem", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
                        {(spec?.values ?? []).map(v => (
                          <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", cursor: "pointer" }}>
                            <input type="checkbox" checked={c.values.includes(v)}
                                   onChange={e => {
                                     const next = e.target.checked
                                       ? [...c.values, v]
                                       : c.values.filter(x => x !== v);
                                     updateCondition(idx, { values: next });
                                   }} />
                            {v}
                          </label>
                        ))}
                      </div>
                    ) : isEnum ? (
                      <select className="form-select" value={c.valueText}
                              onChange={e => updateCondition(idx, { valueText: e.target.value })}>
                        <option value="">— pick one —</option>
                        {(spec?.values ?? []).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : spec?.type === "integer" ? (
                      <input type="number" className="form-input" value={c.valueText}
                             min={spec.min} max={spec.max}
                             onChange={e => updateCondition(idx, { valueText: e.target.value })} />
                    ) : (
                      <input className="form-input" value={c.valueText}
                             onChange={e => updateCondition(idx, { valueText: e.target.value })} />
                    )}
                  </div>
                </div>

                {spec?.description && (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "var(--sp-2)", marginBottom: 0 }}>
                    ℹ️ {spec.description}
                  </p>
                )}

                <div className="form-group" style={{ marginTop: "var(--sp-3)" }}>
                  <label className="form-label" style={{ fontSize: "var(--fs-xs)" }}>PDF page number this rule came from (optional)</label>
                  <input type="number" className="form-input" value={c.evidencePage}
                         min={1} placeholder="e.g. 3" style={{ maxWidth: 200 }}
                         onChange={e => updateCondition(idx, { evidencePage: e.target.value })} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced JSON panel */}
      <details style={{ marginTop: "var(--sp-6)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--text-secondary)" }}>
          ⚙️ Advanced: view / paste raw JSON
        </summary>
        <div style={{ marginTop: "var(--sp-3)" }}>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
            The generated JSON that will be sent to the backend. You can paste an AI-drafted JSON below and click "Load into form" to convert it back to the visual editor.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
            <div>
              <label className="form-label" style={{ fontSize: "var(--fs-xs)" }}>Generated JSON (read-only)</label>
              <textarea className="form-input" rows={12} value={jsonPreview} readOnly
                        style={{ fontFamily: "monospace", fontSize: "0.75rem" }} />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: "var(--fs-xs)" }}>Paste JSON to load</label>
              <textarea className="form-input" rows={12} value={rawJson}
                        placeholder="Paste scheme JSON here..."
                        onChange={e => setRawJson(e.target.value)}
                        style={{ fontFamily: "monospace", fontSize: "0.75rem" }} />
              <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }}
                      onClick={loadFromRaw} disabled={!rawJson.trim()}>
                Load into form
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
