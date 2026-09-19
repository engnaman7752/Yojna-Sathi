# Data contract for Phase 1

Three files feed the eligibility engine. `vocabulary.json` is generated from the
field list in PROJECT_BRIEF.md and is in this repository. The other two are
ground truth and must come from you; the engine is written against the shapes
below, and if your files differ the *loader* is what changes, never your rules.

## data/vocabulary.json

Already present. Thirteen fields, each with `type`, `unit` and where relevant
`values`, `min`, `max`. Money is in whole rupees, land in whole square metres.
`state` has one reserved value, `"ALL"`, which marks a central scheme and is
never a household's state.

## data/schemes/*.json — one file per scheme version

```json
{
  "schemeId": "example-scheme",
  "name": "Example Scheme",
  "state": "ALL",
  "version": 1,
  "status": "PUBLISHED",
  "conditions": [
    {
      "id": "income-ceiling",
      "label": "Annual household income must be 2,50,000 rupees or less",
      "rule": { "<=": [ { "var": "annualIncome" }, 250000 ] },
      "evidence": { "docId": "example-guidelines-2024", "page": 4, "quote": "..." }
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `schemeId` | yes | Stable id. `expectedEligible` in the test file refers to this. |
| `name` | yes | Display name. |
| `state` | yes | A state name, or `"ALL"` for a central scheme. Matched case-insensitively. |
| `version` | yes | Integer, 1 or more. Several files may share a `schemeId` with different versions. |
| `status` | yes | `DRAFT`, `PUBLISHED` or `REJECTED`. Only `PUBLISHED` is ever evaluated. |
| `conditions` | yes | Non-empty. A scheme with no conditions would make everyone eligible, so the loader refuses it. |
| `conditions[].id` | yes | Unique within the scheme. Appears in failure messages. |
| `conditions[].label` | yes | What a citizen is shown when this condition fails. |
| `conditions[].rule` | yes | A JSON Logic object returning true or false. |
| `conditions[].evidence` | no | `docId`, `page`, `quote`. Unused in Phase 1; populated by the extractor from Phase 6. |

The loader refuses to start the application if a rule references a field outside
`vocabulary.json`, if a rule reads no field at all, if two files declare the same
`schemeId` and `version`, or if any required field above is missing. Each refusal
names the file and the condition.

A scheme is met only when **every** condition passes. If several `PUBLISHED`
versions of one `schemeId` exist, the highest `version` is used.

## data/test_households.json — the ground truth cases

```json
{
  "cases": [
    {
      "id": "widow-60-bihar",
      "description": "Widow above 60 in Bihar with no pension",
      "facts": {
        "state": "BIHAR",
        "district": "PATNA",
        "annualIncome": 48000,
        "monthlyPension": 0,
        "ownsCultivableLand": false,
        "landAreaSqm": 0,
        "paysIncomeTax": false,
        "socialCategory": "OBC",
        "age": 63,
        "gender": "F",
        "maritalStatus": "WIDOWED",
        "disabilityPercent": 0,
        "studentClass": null
      },
      "expectedEligible": ["example-scheme"]
    }
  ]
}
```

`facts` accepts only the thirteen vocabulary fields; an unrecognised key fails
the test loudly rather than being ignored. Omit a field, or set it to `null`, to
mean "not supplied" — which is not the same as zero, and the engine treats it
differently (see below). `expectedEligible` is the exact set of `schemeId`s the
household should qualify for; anything else granted is a failure too.

## One behaviour you should confirm

A rule that reads a fact the household did not supply is, by default, an
**error**: the engine throws and names the scheme, the condition and the missing
field. JSON Logic would otherwise resolve the absent value to null and quietly
return false, turning "we never asked" into "not eligible" — a silent denial of
a benefit someone may be entitled to.

Set `yojana.eligibility.missing-field-policy: FAIL_CONDITION` in
`backend/src/main/resources/application.yml` to make it fail that one condition
instead, with `information missing: <fields>` as the detail. Tell me which you
want if partial households are meant to be normal input.
