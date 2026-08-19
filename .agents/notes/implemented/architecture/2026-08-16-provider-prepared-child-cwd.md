# Agent Note: Providers may prepare a durable child working directory

Status: implemented

English | [中文](2026-08-16-provider-prepared-child-cwd.zh.md)

## Problem

Every in-process child inherited its parent's session working directory. A provider could prepare an isolated checkout before child creation, but neither the one-shot driver nor `ContinuableCreateSpec` could carry that directory to the session header. Implementing isolation outside the child-creation owners would require copying the driver and continuation manager, losing their publication, cancellation, persistence, and cold-resume guarantees.

## Decision

Both child-creation owners accept one trusted resolved working-directory value. `InProcessRunOptions.cwd` overrides parent-directory inheritance for a one-shot child. `ContinuableCreateSpec.cwd` does the same for the first Activation of a durable child. `ContinuableStartSpec.cwd` lets a same-process caller supply the directory directly and wins over the provider-prepared value — the captain-style orchestration plugin that already passes persona, tool filter, and agent options per child is such a caller. All paths pass the value through `childSessionMeta`, so the child header is complete before Agent publication.

The override is optional. Existing spawn and fork providers omit it and retain parent-directory inheritance. A provider that owns an isolated workspace resolves and validates the directory before returning or calling the driver.

Continuable preparation runs only for the first Activation. The continuation manager persists `cwd` in the child session header, and cold resume uses that header through the ordinary Agent resume path without calling the provider again. Workspace creation, identity validation, retention, and cleanup remain provider concerns; the subagent packages only transport the directory into their existing lifecycle owners.

This seam does not create git worktrees, change AgentTeams spawn policy, or authorize filesystem access.

## Alternatives considered

- **Copy the in-process driver and continuation manager into an isolation plugin**: rejected because publication, cancellation, quiescent disposal, descriptor ordering, persistence, and cold resume would have two implementations that drift independently.
- **Change the process working directory globally**: rejected because concurrent children require different directories and process-wide mutation would race every other Agent and tool.
- **Store only a provider workspace id and resolve it on every resume**: rejected because the Session header already owns durable cwd, cold resume deliberately avoids provider dispatch, and an extra lookup would make resume depend on plugin-specific state before Agent construction.
- **Add a worktree-specific interface to the subagent service**: rejected because the subagent lifecycle needs only a resolved directory; Git ownership and policy belong to the provider that prepares it.
- **Bind every AgentTeams member to a worktree in the same change**: deferred. Members are durable continuable children whose cwd freezes at spawn. Reviewers and planners should stay in the captain tree; write-capable members may later opt into a tree. Automatic `git worktree add` and merge remain a later consumer of this seam.

## Consequences

- Isolation providers reuse the same one-shot and continuable lifecycle implementations as built-in providers.
- A durable child resumes in the directory recorded at creation even when the parent later changes cwd or the preparing provider is unavailable.
- The trusted same-process provider is responsible for path validation and resource ownership; this change does not turn cwd into a sandbox or authorize access.
- Focused driver and continuation tests pin explicit override, default inheritance, persistence, and provider-free cold-resume semantics.

## Testing

- `packages/subagent/subagent-in-process-driver/tests/subagent-in-process-driver.spec.ts` covers parent inheritance and an explicit one-shot override.
- `packages/subagent/subagent/tests/continuation.spec.ts` persists a prepared continuable cwd, prefers a caller-supplied cwd, and cold-resumes it after the preparing provider unregisters.
