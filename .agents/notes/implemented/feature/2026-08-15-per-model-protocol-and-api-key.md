# Agent Note: Per-model protocol and API key

Status: implemented

English | [中文](2026-08-15-per-model-protocol-and-api-key.zh.md)

## Problem

The Models page stored one wire protocol and one API key per provider. A gateway that speaks Chat Completions, Responses, and Anthropic Messages, or that bills different models to different keys, had to be split across several provider ids. Users asked to pick `openai` / `responses` / `messages` per model, and to attach one key to several models or one key per model.

## Decision

`PiAiModelProfile` accepts `api` and `apiKeyEnv`. Resolution is model → route → catalog for the protocol, and model → route for the credential. `createProvider` receives an `api` map when a route's models disagree, so one pi-ai `Provider` hosts mixed protocols. A request resolves the selected model's reference first; a miss still throws `MISSING_CREDENTIAL` and never falls through to an ambient key.

The Models page offers the three `supportedProtocols()` values as the provider default and again on each model row (`Use provider default` when the row names none). A typed per-model key that matches the provider field or another model's typed value reuses that reference; a distinct value stores under `<ROUTE>_<MODEL>_API_KEY`. Deleting a row unsets every page-derived reference the profile named.

## Alternatives considered

**Split mixed protocols across two provider ids.** Rejected because the picker and session log already treat the route as the provider identity. Users would have to remember which id owns which model.

**Store the literal key on the model row.** Rejected because `settings.yaml` must not carry secrets. The existing credential-reference plane already stores values write-only.

**One key field that lists models it applies to.** Rejected because the page already edits models as rows. Binding the key to the row matches "one key per model" and "one key for several models" without a second grouping control.

## Consequences

A catalog route can keep each shipped model's protocol and still add a model that speaks another. One stored secret can serve several models; a missing per-model reference fails only requests that select that model. The page-managed deletion set grows from one conventional `<ROUTE>_API_KEY` to every `<ROUTE>_<MODEL>_API_KEY` the page derived.

## Testing

`llm-pi-ai` catalog tests pin mixed `api` / `apiKeyEnv` on one route and refuse an empty per-model reference. An adapter test sends the route key and the model key on successive requests. Settings-models store tests pin shared-reference assignment; the custom-provider form test writes two protocols and two keys in one create.
