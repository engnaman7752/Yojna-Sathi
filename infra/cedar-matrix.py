#!/usr/bin/env python3
"""
Authorization matrix for the Cedar policies in
backend/src/main/resources/cedar/, run against the real Cedar engine without
needing the JVM, Maven or a native FFI build.

    pip install cedarpy
    python infra/cedar-matrix.py backend/src/main/resources/cedar

It validates the schema and every policy file, then evaluates each
principal x action x resource combination twice: once through Cedar, and once
through expect_hh / expect_sv below, which restate the intended rules
independently. A disagreement between the two is a real finding - either the
policies say something other than what was intended, or the restatement is
wrong.

This is a policy-level check. It does NOT exercise the Java Authorizer, the
@RequiresPermission aspect or the audit trail; CedarLocalAuthorizerTest covers
those against the same files.

NOTE: cedarpy tracks the Cedar Rust crate, which may be a minor version ahead
of the Cedar that cedar-java embeds. Policy and schema syntax is stable across
4.x, but treat a disagreement between this harness and the Java as a version
question first.
"""
CEDAR_DIR = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
NS = "YojanaSaathi"
schema = cedarpy.Schema.from_str((CEDAR_DIR / "yojana.cedarschema").read_text())
files = sorted(CEDAR_DIR.glob("policies/*.cedar"))
texts = [p.read_text() for p in files]
policies = "\n".join(texts)
ids = re.findall(r'@id\("([^"]+)"\)', policies)
PID = {f"policy{i}": n for i, n in enumerate(ids)}

v = cedarpy.validate_policies(policies, schema)
errs = list(v.errors or [])
print(f"schema + {len(ids)} policies across {len(files)} files -> validation_passed={v.validation_passed}, errors={len(errs)}")
for e in errs: print("  ERROR:", e)
if errs or not v.validation_passed: sys.exit(1)

# ---------------------------------------------------------------- entity set
USERS = {                    # id            role               district
    "citizen-a":     ("CITIZEN",          "PATNA"),
    "citizen-b":     ("CITIZEN",          "PATNA"),
    "operator-1":    ("CSC_OPERATOR",     "PATNA"),
    "operator-2":    ("CSC_OPERATOR",     "PATNA"),
    "officer-patna": ("DISTRICT_OFFICER", "PATNA"),
    "officer-gaya":  ("DISTRICT_OFFICER", "GAYA"),
    "admin-1":       ("ADMIN",            "-"),
    "admin-2":       ("ADMIN",            "-"),
}
HOUSEHOLDS = {   # id       owner        registeredBy  district  consented
    "hh-a": ("citizen-a", "operator-1", "PATNA", ["operator-1"]),
    "hh-b": ("citizen-b", "operator-1", "PATNA", []),
    "hh-c": ("citizen-b", "operator-2", "GAYA",  ["operator-1", "operator-2"]),
}
VERSIONS = {  # id                  status       drafter    editors
    "sv-draft":        ("DRAFT",     "admin-1", []),
    "sv-draft-edited": ("DRAFT",     "admin-1", ["admin-2"]),
    "sv-published":    ("PUBLISHED", "admin-1", []),
}
HH_ACTIONS = ["ViewHousehold", "UpdateHousehold", "CheckEligibility", "ViewAccessLog",
              "GrantConsent", "RevokeConsent", "RegisterHousehold"]
SV_ACTIONS = ["CreateSchemeDraft", "EditSchemeDraft", "PublishSchemeVersion", "RejectSchemeVersion"]

def ref(t, i): return {"__entity": {"type": f"{NS}::{t}", "id": i}}
ENTITIES = [{"uid": {"type": f"{NS}::Role", "id": r}, "attrs": {}, "parents": []}
            for r in {v[0] for v in USERS.values()}]
ENTITIES += [{"uid": {"type": f"{NS}::User", "id": u}, "attrs": {"role": r, "district": d},
              "parents": [{"type": f"{NS}::Role", "id": r}]} for u, (r, d) in USERS.items()]
for h, (own, reg, dist, cons) in HOUSEHOLDS.items():
    ENTITIES.append({"uid": {"type": f"{NS}::Household", "id": h},
                     "attrs": {"owner": ref("User", own), "registeredBy": ref("User", reg),
                               "district": dist,
                               "consentedOperators": [ref("User", c) for c in cons]},
                     "parents": []})
for s, (st, drafter, editors) in VERSIONS.items():
    ENTITIES.append({"uid": {"type": f"{NS}::SchemeVersion", "id": s},
                     "attrs": {"schemeId": "pm-kisan", "status": st,
                               "drafter": ref("User", drafter),
                               "editors": [ref("User", e) for e in editors]},
                     "parents": []})

# ------------------------------------- expected outcome, stated independently
def expect_hh(user, action, hh):
    role, udist = USERS[user]
    owner, reg, hdist, cons = HOUSEHOLDS[hh]
    if role == "ADMIN": return False
    if action == "RegisterHousehold": return role == "CSC_OPERATOR"
    if role == "CITIZEN": return owner == user
    if role == "CSC_OPERATOR":
        return action in ("ViewHousehold", "UpdateHousehold", "CheckEligibility") \
               and reg == user and user in cons
    if role == "DISTRICT_OFFICER":
        return action in ("ViewHousehold", "CheckEligibility") and hdist == udist
    return False

def expect_sv(user, action, sv):
    role, _ = USERS[user]
    status, drafter, editors = VERSIONS[sv]
    if role != "ADMIN": return False
    if action != "PublishSchemeVersion": return True
    return status == "DRAFT" and user != drafter and user not in editors

def ask(user, action, rtype, rid):
    r = cedarpy.is_authorized(
        {"principal": f'{NS}::User::"{user}"', "action": f'{NS}::Action::"{action}"',
         "resource": f'{NS}::{rtype}::"{rid}"', "context": {}},
        policies, ENTITIES, schema)
    allow = str(r.decision).endswith("Allow")
    ann = r.diagnostics.id_annotations_by_reason or {}
    why = [ann.get(x) or PID.get(x, x) for x in (r.diagnostics.reasons or [])]
    errs = r.diagnostics.errors or []
    return allow, why, errs

# ----------------------------------------------------------------- run matrix
rows, failures = [], []
for user, action, hh in itertools.product(USERS, HH_ACTIONS, HOUSEHOLDS):
    allow, why, errs = ask(user, action, "Household", hh)
    exp = expect_hh(user, action, hh)
    rows.append((user, action, hh, exp, allow, why, errs))
    if allow != exp or errs: failures.append(rows[-1])
for user, action, sv in itertools.product(USERS, SV_ACTIONS, VERSIONS):
    allow, why, errs = ask(user, action, "SchemeVersion", sv)
    exp = expect_sv(user, action, sv)
    rows.append((user, action, sv, exp, allow, why, errs))
    if allow != exp or errs: failures.append(rows[-1])

def grid(title, users, actions, resources, kind):
    print(f"\n{title}")
    w = max(len(u) for u in users) + len(max(resources, key=len)) + 4
    hdr = " " * w + "".join(a[:13].center(15) for a in actions)
    print(hdr); print("-" * len(hdr))
    for u in users:
        for res in resources:
            cells = []
            for a in actions:
                exp, got = ((expect_hh, ask) if kind == "hh" else (expect_sv, ask))
                e = exp(u, a, res); g, _, _ = ask(u, a, kind == "hh" and "Household" or "SchemeVersion", res)
                cells.append((("ALLOW" if g else "deny") + ("" if g == e else "  <-MISMATCH")).center(15))
            print(f"{(u + ' / ' + res):<{w}}" + "".join(cells))
    print("-" * len(hdr))

grid("HOUSEHOLD ACTIONS   (hh-a: owned by citizen-a, registered by operator-1, PATNA, consent ACTIVE for operator-1)\n"
     "                    (hh-b: owned by citizen-b, registered by operator-1, PATNA, consent REVOKED)\n"
     "                    (hh-c: owned by citizen-b, registered by operator-2, GAYA,  consent active for operator-1 and -2)",
     list(USERS), HH_ACTIONS, list(HOUSEHOLDS), "hh")
grid("SCHEME VERSION ACTIONS  (sv-draft: DRAFT by admin-1 | sv-draft-edited: DRAFT by admin-1, edited by admin-2 | sv-published: PUBLISHED)",
     list(USERS), SV_ACTIONS, list(VERSIONS), "sv")

print(f"\n{len(rows)} decisions | {len(rows) - len(failures)} matched expectation | {len(failures)} mismatched")
for f in failures:
    print(f"  MISMATCH {f[0]} {f[1]} {f[2]}: expected {'ALLOW' if f[3] else 'DENY'}, got {'ALLOW' if f[4] else 'DENY'} reasons={f[5]} errors={f[6]}")
sys.exit(1 if failures else 0)
