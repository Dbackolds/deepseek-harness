# Agent Note: Real-API e2e CI is dispatch-only

Status: implemented

English | [中文](2026-09-05-real-api-e2e-dispatch-only.zh.md)

## Problem

[.github/workflows/e2e.yml](../../../../.github/workflows/e2e.yml) consumes `DEEPSEEK_API_KEY_EXTERNAL` and hard-fails in preflight when that secret is empty, so a repository without the secret cannot keep the workflow on `push`, `pull_request`, or `schedule` without reddening every trusted run. This fork has no such secret. The original trigger set and secret model live in the [real-API e2e Agent Note](2026-06-19-real-api-e2e-ci.md).

## Decision

The workflow listens only to `workflow_dispatch`, matching the E2B and pi-ai live suites. A dispatched run is trusted, so the preflight still converts a missing secret into a loud failure instead of a false green. There is no `pull_request`, `push`, or `schedule` trigger, and no job-level untrusted-PR skip.

The [original note](2026-06-19-real-api-e2e-ci.md) still owns the separate-workflow split, secret mapping, step-scoped credential hygiene, `DEEPSEEK_BASE_URL` pin, and the prohibition on `pull_request_target`.

## Alternatives considered

**Keeping push, pull_request, and schedule and adding `DEEPSEEK_API_KEY_EXTERNAL`.** That restores the original merge and nightly signal, but this repository does not hold the key, and every master push was already failing at preflight.

**Skipping the job when the secret is empty.** That would stay green without proving the live suite, which is the false-green the preflight exists to prevent.

**Deleting the workflow file.** Local `pnpm run test:e2e` and a later secret-bearing dispatch would then have no CI entry.

## Consequences

Master and pull-request CI no longer run the live DeepSeek suite. Operators who have the secret dispatch the workflow. Re-adding automatic triggers without the secret returns the preflight red that this change removes.
