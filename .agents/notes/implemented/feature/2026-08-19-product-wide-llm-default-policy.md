# Agent Note: Product-wide default retry budget and stream-idle timeout

Status: implemented

English | [中文](2026-08-19-product-wide-llm-default-policy.zh.md)

## Problem

The product default for a provider that omits `retryPolicy` is two finite retries, and the stream-idle interval defaults to five minutes inside each adapter schema. Users who hit a long thinking stream or a transient timeout have no General-settings control. Putting those knobs on a new out-of-tree retry plugin would duplicate `dsh-llm-retry` and fight the provider-owned policy decision. Putting them only on each adapter's Models card would hide a process-wide default behind per-route editors.

## Decision

`@deepseek-ai/dsh-llm-default-policy` owns one process-wide default: five finite retries, unlimited off, and a five-minute stream-idle interval. The Web General settings row writes the `llm-default-policy` settings section. DeepSeek and pi-ai adapters resolve an omitted `retryPolicy` or `streamIdleTimeoutMs` from `ctx.llmDefaultPolicy.current()`. Unlimited maps to always mode; otherwise normal mode uses `maxRetries`. A provider that sets either field keeps that exact value. Changing the default re-registers routes that still inherit it; an in-flight request keeps the serving policy captured when it started.

`dsh-llm-retry` still executes the serving policy. The default service does not listen to `agent/request-error`.

## Alternatives considered

**A new out-of-tree retry plugin.** Rejected because retry execution and durable `llm/retry` records already belong to `dsh-llm-retry`, and policy must stay on the failed provider route.

**A global `retryPolicy` on `dsh-llm-retry`.** Rejected because that executor already refuses the field so provider registration cannot drift from recovery policy.

**Changing only `DEFAULT_MAX_RETRIES` to 5 with no settings row.** Rejected because the requested control is a user-visible General setting, not a silent default bump.

**Editing each provider's Models card instead of a General row.** Rejected for the product-wide default the request asked for; per-provider overrides remain on adapter configuration.

## Consequences

Headless and Web compositions that omit a provider policy now retry five times. Operators who need the previous two-retry budget set `llm-default-policy.maxRetries` to 2 or give the provider its own `retryPolicy`. Unlimited retries every model-request failure, including permanent authentication and quota errors, until success or cancellation.
