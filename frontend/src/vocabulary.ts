import vocabularyJson from "@data/vocabulary.json";

export interface FieldSpec {
  type: "string" | "integer" | "boolean" | "enum";
  unit: string | null;
  required?: boolean;
  values?: string[];
  min?: number;
  max?: number;
  description?: string;
}

export interface Vocabulary {
  vocabularyVersion: number;
  fields: Record<string, FieldSpec>;
}

export const vocabulary = vocabularyJson as unknown as Vocabulary;
export const FIELD_NAMES = Object.keys(vocabulary.fields);

/** Human labels. Anything not listed falls back to the field name itself. */
const LABELS: Record<string, string> = {
  state: "State",
  district: "District",
  annualIncome: "Annual household income",
  monthlyPension: "Pension received each month",
  ownsCultivableLand: "Owns cultivable land",
  landAreaSqm: "Land area",
  paysIncomeTax: "Pays income tax",
  socialCategory: "Social category",
  age: "Age",
  gender: "Gender",
  maritalStatus: "Marital status",
  disabilityPercent: "Disability percentage",
  studentClass: "School class",
};

export function labelFor(field: string): string {
  return LABELS[field] ?? field;
}

export function unitSuffix(field: string): string {
  const unit = vocabulary.fields[field]?.unit;
  switch (unit) {
    case "INR_PER_YEAR":
      return "rupees per year";
    case "INR_PER_MONTH":
      return "rupees per month";
    case "SQM":
      return "square metres";
    case "YEARS":
      return "years";
    case "PERCENT":
      return "%";
    case "CLASS":
      return "";
    default:
      return "";
  }
}

/** A value is only sent if the person actually supplied it. */
export function isSupplied(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}
