// Admins draft, edit, publish and reject scheme versions. The maker-checker
// restriction on publishing lives in its own file as a forbid.
@id("admin-manages-schemes")
permit (
    principal in YojanaSaathi::Role::"ADMIN",
    action in [
        YojanaSaathi::Action::"CreateSchemeDraft",
        YojanaSaathi::Action::"EditSchemeDraft",
        YojanaSaathi::Action::"PublishSchemeVersion",
        YojanaSaathi::Action::"RejectSchemeVersion"
    ],
    resource
);
