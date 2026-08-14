# Agent Note: Shared-modal product onboarding

Status: implemented

English | [中文](2026-08-13-shared-modal-product-onboarding.zh.md)

## Problem

First-run onboarding mixed two interaction models: a viewport takeover for product context and a credential prompt that redirected users into Settings before they could enter a key. That made a short, ordered flow feel like two unrelated surfaces and left onboarding UI ownership split across packages. The product still needs a versioned testing-stage notice before provider setup, but restoring it must not add a second independent overlay or change the Host settings and credential boundaries.

## Decision

**One existing client Cordis plugin owns the shipped first-run step.** `ui-settings-models` registers `welcome-notice` at order `-100` in `settings.onboarding`. The shell continues to mount only the first incomplete entry. No additional client package or plugin row is introduced.

**The notice uses one modal component.** `OnboardingModal` wraps the existing ui-primitives `Modal`, supplies the common title and content geometry, and owns `#root` inert for exactly the visible lifetime. Escape and mask clicks do not silently complete mandatory onboarding; the step exposes only its explicit Continue action. A step still loading private facts returns `null`, so it paints and blocks nothing.

**The welcome notice reuses the existing durable field.** Its exact copy and version live in `onboarding-copy.ts`. Loopback clients compare and write `ui-onboarding.welcomeNoticeVersion` through the existing settings API, and only Continue acknowledges the current version. Remote clients retain the existing process-local fallback because the settings namespace is loopback-only. No Host schema, API-proxy allowlist, or persistence implementation changes.

**API keys are entered on the Models page.** The [first-run credential dialog removal](../simplification/2026-08-15-remove-first-run-api-key-dialog.md) dropped the official-DeepSeek `settings.onboarding` step. A missing key is a Models setup card or missing-key row, not a product takeover.

## Alternatives considered

**Separate client plugins for the notice and any later first-run step.** Rejected because the product asks for one client Cordis plugin and the notice already shares copy, ordering, modal chrome, and invalidation ownership with Models.

**Move acknowledgement into a new Host API.** Rejected because the existing settings contract already expresses the required state and write. A new endpoint would widen scope without changing user capability.

**Keep the former full-viewport stage.** Rejected because the requested onboarding is a dialog over the current app, and the common ui-primitives modal already provides the appropriate portal, mask, and accessibility contract.

## Consequences

A fresh loopback profile sees the specified internal-testing notice. Acknowledgement remains versioned in `settings.yaml`. Already-ready or unsupported deployments render no onboarding chrome while readiness loads. The Models package owns product-onboarding presentation as well as provider configuration; its README and browser coverage make that broader responsibility explicit. This decision restores a concise testing-stage notice after the historical [full-viewport beta notice removal](../simplification/2026-08-13-remove-first-run-beta-notice.md) without restoring that notice's telemetry copy or takeover layout. The later [credential-dialog removal](../simplification/2026-08-15-remove-first-run-api-key-dialog.md) leaves this notice as the only shipped first-run step.
