/** The error shape every backend endpoint uses: { code, message, correlationId, policyId? } */
export interface ApiErrorBody {
  code: string;
  message: string;
  correlationId?: string;
  policyId?: string;
}

export interface ConditionResult {
  conditionId: string;
  label: string;
  passed: boolean;
  detail?: string;
  evidence?: { docId?: string; page?: number; quote?: string };
}

export interface SchemeResult {
  schemeId: string;
  schemeName: string;
  version: number;
  eligible: boolean;
  conditions: ConditionResult[];
  failedConditions?: ConditionResult[];
}

export interface EligibilityCheckResponse {
  correlationId: string;
  schemesEvaluated: number;
  eligible: SchemeResult[];
  notEligible: SchemeResult[];
}

/** Only the 13 fields in data/vocabulary.json may appear here. */
export type HouseholdFacts = Record<string, string | number | boolean | null | undefined>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  correlationId: string;
  trace: Array<Record<string, unknown>>;
}
