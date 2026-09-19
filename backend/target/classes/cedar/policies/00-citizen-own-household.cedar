// A citizen may do anything to their own household record, and nothing to
// anyone else's. Viewing their own access log is part of this: the brief gives
// citizens the right to see who looked at their data.
@id("citizen-own-household")
permit (
    principal in YojanaSaathi::Role::"CITIZEN",
    action in [
        YojanaSaathi::Action::"ViewHousehold",
        YojanaSaathi::Action::"UpdateHousehold",
        YojanaSaathi::Action::"CheckEligibility",
        YojanaSaathi::Action::"ViewAccessLog",
        YojanaSaathi::Action::"GrantConsent",
        YojanaSaathi::Action::"RevokeConsent"
    ],
    resource
)
when { resource.owner == principal };
