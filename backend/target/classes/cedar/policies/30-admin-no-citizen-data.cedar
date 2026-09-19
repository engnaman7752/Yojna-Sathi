// Admins run the scheme catalogue; they never see citizen data. This is a
// forbid rather than an absence of permit, so that no future permit policy can
// accidentally hand an admin access to a household: in Cedar, forbid always
// wins over permit.
@id("admin-never-sees-citizen-data")
forbid (
    principal in YojanaSaathi::Role::"ADMIN",
    action in [
        YojanaSaathi::Action::"ViewHousehold",
        YojanaSaathi::Action::"UpdateHousehold",
        YojanaSaathi::Action::"CheckEligibility",
        YojanaSaathi::Action::"ViewAccessLog",
        YojanaSaathi::Action::"GrantConsent",
        YojanaSaathi::Action::"RevokeConsent",
        YojanaSaathi::Action::"RegisterHousehold"
    ],
    resource
);
