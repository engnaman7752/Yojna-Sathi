// A district officer sees households in their own district and no other.
// principal.district is loaded from DynamoDB at decision time, so a transfer
// takes effect on the next request rather than when a token expires.
//
// Officers get read access only: they may not edit a household, and they may
// not read a citizen's access log.
@id("district-officer-own-district")
permit (
    principal in YojanaSaathi::Role::"DISTRICT_OFFICER",
    action in [
        YojanaSaathi::Action::"ViewHousehold",
        YojanaSaathi::Action::"CheckEligibility"
    ],
    resource
)
when { resource.district == principal.district };
