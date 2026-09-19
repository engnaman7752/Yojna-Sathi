// Nothing AI-generated goes live without a second pair of human eyes: whoever
// drafted or edited a version may not be the one who publishes it.
//
// This is a forbid with no role condition, so it binds every principal
// including a future super-admin, and it cannot be overridden by any permit.
// Rejection is deliberately NOT covered: withdrawing your own draft is not a
// self-approval, and blocking it would leave bad drafts stuck in the queue.
//
// The database enforces the same rule again on write, as a conditional
// transaction. Authorization and persistence agree by design; neither trusts
// the other.
@id("maker-checker-no-self-publish")
forbid (
    principal,
    action == YojanaSaathi::Action::"PublishSchemeVersion",
    resource
)
when {
    resource.drafter == principal || resource.editors.contains(principal)
};

// Only a DRAFT can be published. Republishing an already-published version, or
// publishing a rejected one, is refused here as well as in the conditional write.
@id("publish-only-drafts")
forbid (
    principal,
    action == YojanaSaathi::Action::"PublishSchemeVersion",
    resource
)
unless { resource.status == "DRAFT" };
