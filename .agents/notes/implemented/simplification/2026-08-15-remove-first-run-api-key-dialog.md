# Agent Note: Remove the first-run API key dialog

Status: implemented

English | [中文](2026-08-15-remove-first-run-api-key-dialog.zh.md)

## Problem

A first-run GUI with no usable provider opened a blocking dialog asking for the official DeepSeek API key before the user could reach the rest of the product. The Models page already offers the same write — a first-run setup card or an ordinary missing-key row — so the dialog duplicated that path, held `#root` inert, and forced a choice between saving a key and dismissing the coordinator pass. [Shared-modal product onboarding](../feature/2026-08-13-shared-modal-product-onboarding.md) had placed that dialog after the testing-stage notice; the notice still needs to ship, the credential takeover does not.

## Decision

`ui-settings-models` no longer registers a `deepseek-official` `settings.onboarding` step. The versioned welcome notice remains the only shipped first-run dialog. A missing official key is entered on the Models page through the existing `ProviderEditor`; `credentials.set` stays the only secret write.

The credential-only editor mode, its onboarding copy keys, and `onboardingReadiness` are deleted with the step. The Models join still reports whether any provider can serve requests, and that fact still decides the page's first-run setup-card posture. The Host settings and credential contracts are unchanged.

## Alternatives considered

**Keep the dialog and only make Configure later the default.** Rejected: a mandatory first-run interstitial that the user can already skip is still a takeover, and the Models page already owns the write.

**Auto-complete the step without deleting the registrant.** Rejected: a mounted step that always completes is dead code on the coordinator, and it would keep the unused editor mode and copy keys alive.

**Remove the welcome notice in the same change.** Rejected: the notice is a separate product statement with its own acknowledgement field; this decision only removes the credential takeover.

## Consequences

A fresh profile sees the testing-stage notice, then the ordinary application. API-key setup lives only under Settings → Models. Reintroducing a first-run credential prompt requires a new product decision that supersedes this note.

## Testing

- `packages/client/ui-settings-models` unit coverage pins a single `welcome-notice` occupant, `providerUsable` without an onboarding projection, and `ProviderEditor` without credential-only props.
- The keyless assembled-Web scenarios `onboarding-deepseek-config` and `onboarding-usable-provider` assert that no "Add an API key to get started" dialog appears, and that a missing official key is stored from the Models page.
