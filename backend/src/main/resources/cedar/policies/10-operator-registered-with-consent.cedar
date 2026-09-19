// A CSC operator may see a household only when BOTH hold: they registered it,
// and consent to them is currently active. Either one alone is not enough, so
// revoking consent locks out the operator who created the record.
//
// consentedOperators is built in Java from unexpired rows only.
@id("operator-registered-household-with-consent")
permit (
    principal in YojanaSaathi::Role::"CSC_OPERATOR",
    action in [
        YojanaSaathi::Action::"ViewHousehold",
        YojanaSaathi::Action::"UpdateHousehold",
        YojanaSaathi::Action::"CheckEligibility"
    ],
    resource
)
when {
    resource has registeredBy &&
    resource.registeredBy == principal &&
    resource.consentedOperators.contains(principal)
};

// Registering a new household is the one household action an operator may take
// without consent, because the record does not exist yet.
@id("operator-register-household")
permit (
    principal in YojanaSaathi::Role::"CSC_OPERATOR",
    action == YojanaSaathi::Action::"RegisterHousehold",
    resource
);
