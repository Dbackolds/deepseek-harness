# Cookbook: opening a pull request

English | [中文](opening-a-pull-request.zh.md)

How to open, label, evidence, and land a DeepSeek Harness pull request. The [stack review cookbook](responding-to-pr-review-on-a-stack.md) owns review-fix placement; [dsh-merging-stacked-prs](../../.agents/skills/dsh-merging-stacked-prs/SKILL.md) owns landing a dependent chain.

## Before you open one

1. Confirm the work belongs in this repository. Out-of-tree plugins stay in their own repository with the `dsh-plugin` topic.
2. Split independent changes. One pull request has one dominant intent. Dependent follow-ups use GitHub's official stack object before landing ([native stacks](../../.agents/notes/implemented/process/2026-08-02-native-github-stacks-and-optional-rebases.md)).
3. Keep the branch on current `master` (or the official parent in a stack). A mergeable GitHub state against a stale base is not current evidence.
4. Open or reuse a same-repository Issue first. Ready-for-review human pull requests must cite at least one such Issue.

## Body and Issue citation

Use [.github/pull_request_template.md](../../.github/pull_request_template.md). Keep the visible body short: the Issue citation stays outside `<details>`; change and verification notes stay collapsed.

- Write `Fixes #NN` (or `Closes` / `Resolves`) when merging the pull request should close that Issue. Write `Related to #NN` to associate without closing.
- Same-repository Issues count. A number that resolves to another pull request does not satisfy the policy.
- HTML comments, fenced code, and inline code are ignored when parsing citations.
- When the pull request is not a draft, is not authored by a Bot or App, and has a review request or a submitted review, [Issue policy](../../.github/workflows/issue-policy.yml) requires at least one same-repository Issue citation plus the labels below.

## Labels

Every open or merged pull request carries exactly one canonical `kind/*` and at least one materially affected `area/*` ([taxonomy](../../.agents/notes/implemented/process/2026-08-08-unified-github-label-taxonomy.md)). GitHub's live `area/*` names own the inventory.

| Kind | Dominant intent |
|---|---|
| `kind/feature` | Adds or intentionally changes behavior. |
| `kind/bug-fix` | Corrects incorrect behavior. |
| `kind/doc` | Makes documentation the dominant intent. |
| `kind/testing` | Changes tests or testing infrastructure without changing product behavior. |
| `kind/cleanup` | Preserves behavior while maintaining or simplifying implementation or repository process. |
| `kind/dependency` | Updates dependencies without another dominant intent. |

Do not put `source/*` on a pull request (Issues only). Do not recreate reserved aliases such as `kind/bug` or `kind/documentation`. Accompanying tests, documentation, or cleanup do not override a feature or bug-fix kind. A resolving `Fixes` pull request that carries a `p0`–`p3` label must match the highest Priority among the Issues it closes; omit the Priority label when none of those Issues have one.

Issues use native Issue Type instead of `kind/*`. Their titles include Chinese and do not prefix Type, Priority, Status, area, or Owner.

## What must land in the same change

- **Agent Note.** Non-trivial work adds or updates one in the same pull request ([when to write one](../../.agents/notes/README.md#when-to-write-one)). Mechanical or local edits are the only exemption.
- **Docs and JSDoc.** Public behavior, config, defaults, errors, wire fields, and events update the owning README and JSDoc together ([documentation standard](../AGENTS.md)).
- **Tests that match the surface.** Package behavior, real Loader or process composition for product-visible plugins, and a keyless recorded-session snapshot when model- or product-user-visible output changes ([testing policy](../testing.md)).
- **GUI evidence.** Locale-owned copy, `verify-client-ui-i18n`, and the owning `test:web` or settings golden. A product-user-visible GUI change also includes a demonstration GIF recorded from that pull request's tree ([record-browser-gif](../../.agents/skills/record-browser-gif/SKILL.md)).
- **Bilingual pairs.** An edited paired document updates its counterpart in the same pull request, then re-records `pnpm run verify-translation-pairing --write <pair>`.

## Local checks before review

Git hooks stay narrow: staged lint, whitespace, vendor-manifest, pairing records, and `pnpm run typecheck` on push. Contributors run the [smallest checks that cover the outgoing diff](../../AGENTS.md#run-relevant-checks-locally) once; [dsh-pre-push-checks](../../.agents/skills/dsh-pre-push-checks/SKILL.md) selects them. CI owns exhaustive coverage and the platform matrix. Do not claim checks pass from a green unit suite when the change needs snapshots, `doc-sync`, built smokes, or `test:web`.

After `gh stack sync`, validate immediately and do not merge until that evidence passes.

## History and landing

Standalone and stacked branches may merge-forward or rebase. Remote rewrites use `--force-with-lease` or the lease-protected `gh stack` push path and abort if the remote moved; raw `--force` is forbidden. Preserve an in-progress merge-forward checkpoint before taking a newer base.

A same-repository chain of two or more dependent pull requests uses GitHub's official stack before landing. Land through that stack procedure, not per-PR merge plus manual retargeting.

## Review

Prioritize correctness, lifecycle, security, and broken required behavior. A short review with one substantiated blocker is enough. Use [dsh-code-review](../../.agents/skills/dsh-code-review/SKILL.md) for repository-specific checks. Reply in the existing review thread; after a rewritten push, re-read unresolved threads, approvals, mergeability, and checks because older commit OIDs and inline anchors are not current evidence.

## Verify

- The body cites a same-repository Issue with `Fixes` or `Related to` as intended, and the live labels are one allowed `kind/*` plus the material `area/*` names.
- The diff contains the Agent Note, docs, tests, snapshots, and GUI evidence the changed surface requires, or an explicit exemption that matches those policies.
- Relevant local checks were run against the live base; CI is green or the failing job is diagnosed rather than ignored.
- A stacked change is an official GitHub stack, and each child diff against its parent shows only that child's work.
