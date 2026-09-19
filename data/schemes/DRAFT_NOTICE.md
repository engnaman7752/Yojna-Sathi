# These scheme rules are DRAFTS. They are not ground truth yet.

Every file in this directory, and `../test_households.json`, was drafted by
Claude from public reporting on the schemes named, because the real ground truth
had not been supplied. They carry `"_draft": true` and a `"_provenance"` note.
PROJECT_BRIEF.md says never to invent scheme rules; this happened only because
you explicitly asked for drafts to review.

Treat them the way the product treats any AI-drafted version: **nothing here is
correct until a human says it is.**

## What to check before trusting any of it

**"Below the poverty line" is encoded as `annualIncome <= 100000`, and that is
wrong.** BPL is a card and a state-administered status, not an income threshold,
and the threshold differs by state and between rural and urban areas. The field
vocabulary has no way to say "holds a BPL card", so three schemes (IGNOAPS,
IGNWPS, IGNDPS) use an income proxy that will produce wrong answers at the
margin. This is the single most consequential thing to fix. It probably means
adding a `bplCardHolder` boolean to `data/vocabulary.json` — a vocabulary change,
so it needs your decision rather than mine.

**IGNWPS does not test gender.** "Widow" is encoded as
`maritalStatus == "WIDOWED"` only. A widower would currently match. Decide
whether the rule should also require `gender == "F"`.

**Post-matric SC/ST is one scheme here, two in reality.** SC and ST students are
covered by separate central schemes with their own income ceilings, and that
ceiling has been revised more than once. `<= 250000` reflects the older figure.

**Bihar MVPY carries no income test.** Sources disagree on whether one applies.
Only age and "no other government pension" are encoded.

**PM-KISAN's exclusions are only partly representable.** Serving and retired
government employees, professionals, constitutional post holders and
institutional landholders are all excluded in reality; none of those is
expressible in the current vocabulary. Only the income-tax and pension
exclusions are encoded, so this scheme is over-inclusive by design.

**`studentClass` is modelled as an integer 1-12.** Post-matric study beyond
class 12 cannot be represented at all.

## The deliberate DRAFT file

`pm-kisan.v2-draft.json` is not a mistake. It is a second version of PM-KISAN,
`status: DRAFT`, adding a 2-hectare land ceiling. The case
`farmer-35-bihar-above-draft-land-ceiling` holds 2.5 hectares: version 2 would
exclude him, version 1 does not, and he is expected to qualify. That case fails
the moment an unpublished version starts affecting a citizen's result, which is
exactly the Phase 2 behaviour you asked to be tested.
