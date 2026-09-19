"""
The agent's tools. Every one of them is a call to the Spring Boot API.

Three things are deliberately absent from every signature below: the caller's
JWT, the correlation id and the idempotency key. They live in request context
(app/context.py) and are attached by the backend client, so the model cannot
read them, cannot forge one, and cannot be argued into using someone else's.

The parameter names are the field names from data/vocabulary.json, spelled
exactly as the rule engine spells them, camelCase and all. That is not a style
lapse: it makes the tool schema the model sees, the prompt, and the backend
contract one vocabulary rather than three that have to be kept in step.
"""

from typing import Any

from strands import tool

from app.backend_client import BackendError, call
from app.context import record, require_idempotency_key


def _ok(payload: Any) -> dict:
    return {"status": "success", "content": [{"json": payload}]}


def _failed(err: BackendError) -> dict:
    # The model is told a call failed and why, but never gets a stack trace or
    # anything it could replay as an instruction.
    return {
        "status": "error",
        "content": [{"json": {"code": err.code, "message": err.backend_message}}],
    }


def _facts(**kwargs: Any) -> dict:
    """Drop unsupplied fields so the engine can tell 'absent' from 'zero'."""
    return {k: v for k, v in kwargs.items() if v is not None}


@tool
async def check_eligibility(
    state: str,
    district: str,
    annualIncome: int | None = None,
    monthlyPension: int | None = None,
    ownsCultivableLand: bool | None = None,
    landAreaSqm: int | None = None,
    paysIncomeTax: bool | None = None,
    socialCategory: str | None = None,
    age: int | None = None,
    gender: str | None = None,
    maritalStatus: str | None = None,
    disabilityPercent: int | None = None,
    studentClass: int | None = None,
) -> dict:
    """Check which schemes a household qualifies for, without saving anything.

    Use this when the person has described their situation but has not asked to
    be registered. The deterministic rule engine decides; you only report what
    it returns. Omit any field the person has not told you - do not guess a
    value, and do not send 0 to mean "unknown".

    Args:
        state: State or union territory of residence.
        district: District of residence.
        annualIncome: Total household income per year, in whole rupees.
        monthlyPension: Government pension already received per month, in whole rupees.
        ownsCultivableLand: Whether the household owns cultivable agricultural land.
        landAreaSqm: Land held, in whole square metres. 1 acre = 4047, 1 hectare = 10000.
        paysIncomeTax: Whether anyone in the household paid income tax last assessment year.
        socialCategory: One of GEN, OBC, SC, ST.
        age: Age in completed years of the person the check is about.
        gender: One of M, F, O.
        maritalStatus: One of SINGLE, MARRIED, WIDOWED, DIVORCED.
        disabilityPercent: Certified disability percentage, 0 to 100.
        studentClass: School class currently enrolled in, 1 to 12.
    """
    facts = _facts(
        state=state, district=district, annualIncome=annualIncome, monthlyPension=monthlyPension,
        ownsCultivableLand=ownsCultivableLand, landAreaSqm=landAreaSqm, paysIncomeTax=paysIncomeTax,
        socialCategory=socialCategory, age=age, gender=gender, maritalStatus=maritalStatus,
        disabilityPercent=disabilityPercent, studentClass=studentClass,
    )
    record({"kind": "tool", "name": "check_eligibility", "args": facts})
    try:
        return _ok(await call("POST", "/api/eligibility/check", json_body=facts))
    except BackendError as e:
        return _failed(e)


@tool
async def save_profile(
    state: str,
    district: str,
    annualIncome: int | None = None,
    monthlyPension: int | None = None,
    ownsCultivableLand: bool | None = None,
    landAreaSqm: int | None = None,
    paysIncomeTax: bool | None = None,
    socialCategory: str | None = None,
    age: int | None = None,
    gender: str | None = None,
    maritalStatus: str | None = None,
    disabilityPercent: int | None = None,
    studentClass: int | None = None,
) -> dict:
    """Save the household's details so they can be looked up again later.

    Only call this when the person has agreed to be registered. The same
    household saved twice in one request is stored once: the request handler
    supplies an idempotency key, which you neither see nor control.

    Args:
        state: State or union territory of residence.
        district: District of residence.
        annualIncome: Total household income per year, in whole rupees.
        monthlyPension: Government pension already received per month, in whole rupees.
        ownsCultivableLand: Whether the household owns cultivable agricultural land.
        landAreaSqm: Land held, in whole square metres.
        paysIncomeTax: Whether anyone in the household paid income tax last assessment year.
        socialCategory: One of GEN, OBC, SC, ST.
        age: Age in completed years.
        gender: One of M, F, O.
        maritalStatus: One of SINGLE, MARRIED, WIDOWED, DIVORCED.
        disabilityPercent: Certified disability percentage, 0 to 100.
        studentClass: School class currently enrolled in, 1 to 12.
    """
    facts = _facts(
        state=state, district=district, annualIncome=annualIncome, monthlyPension=monthlyPension,
        ownsCultivableLand=ownsCultivableLand, landAreaSqm=landAreaSqm, paysIncomeTax=paysIncomeTax,
        socialCategory=socialCategory, age=age, gender=gender, maritalStatus=maritalStatus,
        disabilityPercent=disabilityPercent, studentClass=studentClass,
    )
    record({"kind": "tool", "name": "save_profile", "args": facts})
    try:
        return _ok(await call(
            "POST", "/api/households",
            json_body=facts,
            extra_headers={"Idempotency-Key": require_idempotency_key()},
        ))
    except BackendError as e:
        return _failed(e)


@tool
async def evaluate_household(householdId: str) -> dict:
    """Run the eligibility rules against a household that has already been saved.

    Args:
        householdId: The id returned by save_profile, or one the person gave you.
    """
    record({"kind": "tool", "name": "evaluate_household", "args": {"householdId": householdId}})
    try:
        return _ok(await call("POST", f"/api/households/{householdId}/eligibility"))
    except BackendError as e:
        return _failed(e)


@tool
async def get_scheme_details(schemeId: str) -> dict:
    """Look up a published scheme: its name, and the conditions it applies.

    Only published schemes are visible. If this returns not found, say the
    scheme is not available - never describe a scheme from memory.

    Args:
        schemeId: The scheme id, for example pm-kisan or ignwps.
    """
    record({"kind": "tool", "name": "get_scheme_details", "args": {"schemeId": schemeId}})
    try:
        return _ok(await call("GET", f"/api/schemes/{schemeId}"))
    except BackendError as e:
        return _failed(e)


ALL_TOOLS = [check_eligibility, save_profile, evaluate_household, get_scheme_details]
