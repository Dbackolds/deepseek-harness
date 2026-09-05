# Agent Note: Real-API e2e in CI against the external DeepSeek API

Status: implemented

English | [中文](2026-06-19-real-api-e2e-ci.zh.md)

## Problem

The harness leans hard on real-API tests by policy: [docs/testing.md](../../../../docs/testing.md) argues that a no-key suite proves the plumbing but not the product, and the [ACP inject postmortem](../../../../docs/postmortem/0001-acp-default-export-drops-inject.md) is the standing proof — 178 keyless tests stayed green while a real ACP client session crashed instantly. The real-API e2e suite (`pnpm run test:e2e`, the `*.e2e.ts` files) exists precisely to close that gap: it drives the agent against the live DeepSeek API — real model calls, real bash tools, multi-turn, resume, ACP-over-stdio.

The default gate ([.github/workflows/ci.yml](../../../../.github/workflows/ci.yml)) is deliberately keyless: it carries no secret and runs for forks. `test:e2e` self-skips without a key (`describe.skipIf(!process.env.DEEPSEEK_API_KEY)`), so adding it there would report green without exercising the real suite. A separate secret-bearing workflow is required to run real-API coverage in CI without putting a secret in the keyless gate.

## Decision

A dedicated workflow, [.github/workflows/e2e.yml](../../../../.github/workflows/e2e.yml), separate from ci.yml, runs only `pnpm run test:e2e` against the external API using a repo secret, on `workflow_dispatch`, with a preflight that converts a missing secret into a loud failure instead of a false green. The keyless workflow remains separate so forkable quality gates and secret-consuming real-API gates keep different trigger and credential policies. Automatic `push`, `pull_request`, and `schedule` triggers are absent; the [dispatch-only note](2026-09-05-real-api-e2e-dispatch-only.md) owns that trigger set.

### A separate workflow, not a job in ci.yml

ci.yml's value is that it is keyless, forkable, and always-green: any contributor (including an outside fork) gets a complete keyless signal with no secret in the blast radius. Adding a secret-consuming job there would couple that always-green gate to credential availability and a different trigger policy. Keeping the secret-bearing work in its own file isolates the secret, trigger, and concurrency policy, and preserves ci.yml's property for forks. Different lifecycles → different files.

### Cost is not the constraint; reliability is

Internal inference cost is not the limiting constraint, so a dispatched run still executes every matching `*.e2e.ts` file, implementing the [docs/testing.md](../../../../docs/testing.md) with-key policy.

### Triggers: workflow_dispatch only

The workflow has no `push`, `pull_request`, `schedule`, or `workflow_call` trigger. Operators who hold `DEEPSEEK_API_KEY_EXTERNAL` start a run from the Actions UI. The [dispatch-only note](2026-09-05-real-api-e2e-dispatch-only.md) records why automatic triggers are absent.

### Preflight: fail loud, never false-green

Because a dispatched run is trusted and the secret is expected, the preflight is an unconditional presence check: empty key → `exit 1` with a `::error::` annotation naming the secret to configure. This is the crux that makes a self-skipping suite safe to run in CI. Without it, a deleted/renamed/misconfigured secret would make `test:e2e` skip every real suite and report all-green — a silent regression of the entire safety net. The guard turns "secret missing" from an invisible false pass into a visible failure.

### Secret mapping and hygiene

The repo secret is named `DEEPSEEK_API_KEY_EXTERNAL`; it is mapped to the `DEEPSEEK_API_KEY` env var the adapters and tests read (`process.env.DEEPSEEK_API_KEY`). The distinct secret name documents intent (this is the *external* public-API key, not an internal-endpoint key) and lets an internal-endpoint key coexist later without collision. Hygiene choices, each defensive:

- **Step-scoped secret.** `DEEPSEEK_API_KEY` is set in the `env:` of only the preflight and e2e steps, never job-level — so checkout/setup-node/install never see it. A compromised install-time lifecycle script in a dependency cannot read a secret that isn't in its environment.
- **`permissions: contents: read`.** The job only reads the repo to run tests; it needs no write scopes (no PR comments, no status writes), so the `GITHUB_TOKEN` is dropped to least privilege.
- **`DEEPSEEK_BASE_URL` pinned** to `https://api.deepseek.com` on the e2e step. The adapter would default to this when unset ([packages/llm/llm-deepseek/src/index.ts](../../../../packages/llm/llm-deepseek/src/index.ts) `PUBLIC_BASE_URL`), but pinning is self-documenting and hermetic — a stray repo-root `.env` (which `vitest.e2e.config.ts` loads if present) cannot silently redirect the run to another endpoint.
- **No secret echoed.** The preflight prints only `DEEPSEEK_API_KEY present.` — not the value or its length.

### Scope, runtime shape

The job runs only `test:e2e` on Node 24; keyless gates and version compatibility belong to the main CI workflow. Tests run unbuilt through the workspace paths map with a bounded configurable worker pool, per-test retries, and a job timeout. A superseded dispatch on the same ref is cancelled.

The DeepSeek native `web_search` probe is registered but skipped. The live Anthropic-compatible endpoint can return a successful response without structured source blocks, so its positive-source assertion is not a reliable merge signal; unit coverage still pins response parsing, but CI does not prove the live source-block wire shape.

## Security

The repository's first CI secret requires a recorded threat model because access differs between same-repository, fork, and Dependabot pull requests and changes when the repository becomes public.

### Who can reach the secret in a private repository

- **No write access: cannot.** The workflow has no `pull_request` or `pull_request_target` trigger, so a fork PR never starts this job and never receives the secret.
- **Write (push) access: can.** Anyone who can dispatch the workflow or push a workflow file can already reach Actions secrets. Write access ⇒ secret access, always. The mitigation lives in who is granted write and in branch protection, not in this file.

So "everyone who could open a PR can steal it" is false: only the write-access set can, and that set could already steal any secret the repo holds.

### What changes when the repo goes public

The secret stays protected from the public **through this workflow**: there is no pull-request trigger, so fork PRs (openable by anyone on a public repo) never start this job. The write-access set is unchanged by visibility, so the insider reality is also unchanged.

What gets worse is the *surrounding* model, and these are the things to address before flipping visibility:

- **Logs become world-readable.** A careless secret echo that leaks to organization members would leak to the entire internet and be scraped within minutes. Secret-handling discipline (no value/length echoes — already done) matters far more.
- **The `pull_request_target` footgun becomes catastrophic.** Adding that trigger would run untrusted fork code in the base-repo context **with** secrets — a full key-leak vector. This is benign-ish on a private repo and disastrous on a public one. A `SECURITY —` comment on the trigger in e2e.yml forbids the change and points here.
- **Rotate on flip.** The key lived in a private repo's CI; treat going-public as "assume exposed" and rotate `DEEPSEEK_API_KEY_EXTERNAL` at that moment.
- **Settle the secret behind controls.** Confirm Settings → Actions → *"Send secrets to workflows from fork pull requests"* stays **off** (the one setting that would actually break the fork boundary), and consider moving the key into a GitHub **Environment** with required reviewers so even merged code uses it only under controlled conditions and rotation has a single home.

None of these require changing the workflow to go public; they are operational steps plus the already-added `pull_request_target` guard comment.

## Alternatives considered

- **A secret-consuming job inside ci.yml** — rejected: it would couple the keyless, forkable, always-green gate to credential availability and a different trigger/concurrency policy; different lifecycles, different files.
- **Automatic `push` / `pull_request` / `schedule` triggers** — rejected here because this repository has no `DEEPSEEK_API_KEY_EXTERNAL`; the [dispatch-only note](2026-09-05-real-api-e2e-dispatch-only.md) owns that choice.

## Consequences

A second CI workflow and an optional repo secret to maintain. The real-API suite runs when an operator dispatches it with `DEEPSEEK_API_KEY_EXTERNAL` present; it is not a merge gate. The preflight makes secret misconfiguration self-announcing instead of silently disabling the net.

The design carries a documented constraint: the hard prohibition on `pull_request_target`. The going-public checklist above is the operational companion — this Agent Note is the place a future maintainer should re-read before changing the trigger set or flipping repo visibility, rather than re-deriving the fork/secret model from scratch.

Runner egress to `https://api.deepseek.com` is assumed — GitHub-hosted `ubuntu-latest` has it; an egress-restricted self-hosted runner would need connectivity confirmed before a dispatch can succeed.
