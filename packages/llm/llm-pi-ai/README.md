---
description: "The pi-ai-backed multi-provider adapter for users and maintainers routing the harness LLM service through pi-ai catalogs and hand-declared gateways."
kind: "package-reference"
---

# @deepseek-ai/dsh-llm-pi-ai

English | [中文](README.zh.md)

## Summary

`@deepseek-ai/dsh-llm-pi-ai` is the pi-ai-backed multi-provider adapter for the harness LLM service: one plugin instance owns a dictionary of provider routes, each served through [`@earendil-works/pi-ai`](https://www.npmjs.com/package/@earendil-works/pi-ai). A route naming an installed pi-ai provider inherits its endpoint, wire protocol, and model catalog as defaults; a route pi-ai does not ship is declared outright, so an OpenAI-compatible gateway or self-hosted server is configuration, not a code change. Profiles and credentials resolve per request over the optional settings and credential seams, so editing the user settings document changes the next request without a restart. A provider that ships a login can be signed into through the harness authorization seam, and the stored sign-in — an OAuth grant, or a key typed into pi-ai's own login prompt — authenticates its route and refreshes itself under the store's cross-process lock. The plugin can mount dormant with zero routes and activate them the moment a settings section supplies profiles.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin when a composition routes model requests through pi-ai's provider catalogs or through gateways that pi-ai's installed catalog does not describe. The `providers` dictionary is the whole configuration surface: each key is the provider route name a request selects with `GenerateOptions.provider`.

### When to choose it

Choose this adapter when the same composition serves several providers, when a route needs pi-ai's catalog defaults with a few fields corrected, or when a hand-declared gateway must be reached through its own endpoint and protocol. Choose `dsh-llm-deepseek` for the direct DeepSeek route when the deployment needs no other provider. Both adapters can be mounted together because their route names do not collide; registering a route another adapter already owns fails plugin loading.

### Configure provider routes

Each profile may set a `retryPolicy`; omission uses normal mode with five retries. `apiKeyEnv` is a credential reference resolved per request through the harness credential seam, so no secret enters the configuration file; a reference that resolves to nothing fails the request with `MISSING_CREDENTIAL`. Omitting it leaves the route configured-but-keyless, which for an installed catalog route defers to pi-ai's provider-native ambient discovery.
Configure credentials, the model catalog, and deployment-specific transport settings per provider, keyed by the provider route itself. `apiKeyEnv` is a credential *reference* resolved per request, so no secret enters this file. A model may name its own `apiKeyEnv`; that reference wins for requests that select it, and several models may name the same reference so one stored key serves them. Omitting every reference leaves the route unauthenticated, which for an installed catalog route means pi-ai's provider-native ambient discovery; a configured reference that resolves to nothing fails the request with `MISSING_CREDENTIAL` instead, because falling through would authenticate with whatever unrelated key the environment happens to hold.

Configure credentials, the model catalog, and deployment-specific transport settings per provider, keyed by the provider route itself. Each profile may set a `retryPolicy`; omission uses normal mode with five retries. `apiKeyEnv` is a credential *reference* resolved per request, so no secret enters this file. Omitting it leaves the route unauthenticated, which for an installed catalog route means pi-ai's provider-native ambient discovery; a configured reference that resolves to nothing fails the request with `MISSING_CREDENTIAL` instead, because falling through would authenticate with whatever unrelated key the environment happens to hold. One credential serves every model on its route.

```yaml
- name: '@deepseek-ai/dsh-llm-pi-ai'
  config:
    providers:
      openai:
        apiKeyEnv: OPENAI_API_KEY
        baseURL: https://proxy.example.com:8443
        reasoning: high
        requestImagePixelBudget: 4194304 # total pixels; 2048 by 2048 default
        requestImageMaxBytes: 1048576    # raw bytes before base64 expansion
        maxRequestImageBytes: 20971520   # accumulated base64 payload
        retryPolicy:
          mode: normal
          maxRetries: 3
      anthropic:
        apiKeyEnv: ANTHROPIC_API_KEY
        models:
          - id: claude-sonnet-4-5
            contextWindow: 200000
      acme-gateway:
        displayName: Acme Gateway
        apiKeyEnv: ACME_GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.acme.example/v1
        compat:
          thinkingFormat: deepseek
        models:
          - id: acme-think
            name: Acme Think
            contextWindow: 262144
            reasoningEfforts:
              off:
              high: high
```

| Field | Default | Meaning |
|---|---|---|
| `apiKeyEnv` | absent | Credential reference resolved per request; omission defers to pi-ai ambient discovery |
| `displayName` | provider name | Label shown by selector surfaces |
| `api` | catalog protocol | Wire protocol; only needed for routes the catalog does not supply |
| `baseURL` | catalog endpoint | Endpoint of every model on the route |
| `models` | installed catalog | Replaces the route's catalog wholesale; each entry defaults from the installed model |
| `modelOverrides` | none | Reshapes individual installed-catalog models without replacing the rest |
| `compat` | catalog detection | Wire-compatibility switches for unrecognized endpoints |
| `defaultContextWindow` | `262,144` | Capacity fallback for undescribed models |
| `defaultMaxTokens` | `32,768` | Output-cap fallback for undescribed models |
| `requestImagePixelBudget` | `4,194,304` | Total-pixel budget for each deterministic request image |
| `requestImageMaxBytes` | `1 MiB` | Encoded-byte target for each request image before base64 expansion |
| `maxRequestImageBytes` | `20 MiB` | Aggregate base64 image-payload bound with oldest-first offload |
| `retryPolicy` | normal, 5 retries | Provider-owned retry policy executed by `dsh-llm-retry` |
              max: ultra
          - id: acme-claude
            api: anthropic-messages
            apiKeyEnv: ACME_CLAUDE_API_KEY
The dict shape makes duplicate routes unrepresentable, and the pre-release array shape (with per-profile `provider` fields) fails load with migration directions. `providers` may also be empty or omitted entirely: the adapter then mounts **dormant** — zero routes, no extra catalog entries — and registers routes the moment the `llm-pi-ai:` settings section supplies profiles, dropping them again when it empties. Dormant or not, the plugin declares every installed catalog provider in the configurable-provider directory (`ctx.llm.listConfigurableProviders()`, settings path `providers.<provider>`), joined with every route the current profiles declare, so configuration surfaces can offer the full catalog before any route exists and can still address a hand-declared one. Each entry carries `declared`: whether pi-ai ships nothing under that key. It follows the installed catalog, never the settings document, because narrowing a shipped provider's models stores a profile too and that route is still one pi-ai knows — only the adapter can tell the two apart, which is why the directory answers rather than leaving a surface to infer it. Which adapters exist is composition; which providers run can be entirely the user's settings document. Registration with `ctx.llm` is atomic: a collision with any provider route already owned by another adapter fails plugin loading without registering the remaining routes. Model ids are not lifecycle config; a model the route does not configure fails before any provider request with `LlmError('UNKNOWN_MODEL')`.
## Catalog resolution
A profile's `models` list *replaces* the route's installed catalog rather than extending it; omitting it (or leaving it empty) serves that catalog unchanged. Each entry defaults its unset fields from the installed model of the same `id`, so narrowing a catalog route to two models, correcting one capacity, or adding a model newer than the installed catalog are all one-line edits — but declaring any `models` list means every model the route should keep serving must appear in it, an entry of nothing but `id` being enough. The configurable entry fields are `id`, `name`, `contextWindow`, `maxTokens`, `reasoningEfforts`, `compat`, `systemPrompt`, `api`, and `apiKeyEnv`. Pricing and input modalities have no harness consumer and ride the installed entry or are absent. A non-empty `systemPrompt` is a complete system-prompt template for that model id: agent-loop replaces every assembled system section with the interpolated text. Absence or whitespace keeps ordinary assembly. `api` on an entry is that model's wire protocol and wins over the route's; absence uses the route, then the installed catalog entry, then the protocol the route's shipped siblings agree on. `apiKeyEnv` on an entry is that model's credential reference and wins over the route's.
`modelOverrides` reshapes individual installed-catalog models without that cost: each key is a catalog model id, each value the same fields a `models` entry takes with the id living in the key, and the rest of the catalog keeps serving untouched — "correct one model, keep the other thirty-seven" as a three-line edit. An override becomes that catalog entry's configuration, so capacities, efforts, compat, and `systemPrompt` resolve through the same path with the same diagnostics and the same request-default semantics as a `models` entry. Overrides are only meaningful on a catalog route serving its catalog: one set beside a `models` list (which already replaces the catalog), on a hand-declared route (whose models are fully spelled in `models`), or naming a model the catalog does not describe is refused rather than skipped, because a silently unchanged model is a typo someone would otherwise hunt for.
### Per-model reasoning efforts

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-llm-pi-ai) is the exhaustive source for every accepted field and its JSDoc.

### Sign in to a provider

A provider pi-ai ships a login for can be signed into through the harness authorization seam: the flow offers OAuth or an interactive key prompt (a key is typed into pi-ai's own login prompt, not into the settings form), and the resulting credential is stored in the harness credential store at `llm-pi-ai/<provider id>`. The stored sign-in authenticates its route beneath any `apiKeyEnv` override and refreshes itself under the store's cross-process lock; signing out deletes the stored record. A hand-declared route key outside the record grammar — a lowercase hyphenated identifier — cannot be signed into, because a record write for it refuses with `LlmError('UNSTORABLE_PROVIDER_ID')`; such a route authenticates through `apiKeyEnv` or ambient provider settings instead.

### Resolve the model catalog
pi-ai shapes each request from the provider id and baseURL: which role carries the system prompt, which field caps output, how a thinking level travels. A private gateway's URL says nothing, and for an endpoint pi-ai does not recognize the detection answers as though it were OpenAI itself — a reasoning model's system prompt goes out as `developer`, the output cap as `max_completion_tokens`, the thinking level as a bare `reasoning_effort` — and most OpenAI-compatible gateways reject at least one of those. `compat` is therefore configurable on the route (its models' default) and per model (winning per field), resolving model → route → installed catalog entry → pi-ai's own detection; a route-level switch shadows the catalog entry's value for every model that reads it, and there is no spelling for handing a field back to the catalog short of restating its value. Naming `thinkingFormat: zai` without `supportsDeveloperRole` fills `false`: official zai catalog entries refuse that role, and a private URL would otherwise keep the OpenAI detection.

A profile's `models` list replaces the route's installed catalog rather than extending it; each entry defaults its unset fields from the installed model of the same id, so narrowing a route to two models, correcting one capacity, or adding a model newer than the installed catalog are one-line edits. `modelOverrides` reshapes individual installed-catalog models without that cost — correct one model, keep the other thirty-seven — and is refused when set beside a `models` list, on a hand-declared route, or naming a model the catalog does not describe, because a silently unchanged model would be a typo someone hunts for later.

### Run with reasoning and wire compatibility

`reasoningEfforts` declares a model's selectable thinking levels: each key is a level selectors offer, its value the spelling dispatch sends on the wire, so `max: ultra` renames a level for a gateway with its own vocabulary. Omitting the field keeps the installed catalog entry's capability; `false` declares a non-reasoning model. `compat` switches reshape the request for endpoints pi-ai cannot recognize — which role carries the system prompt, which field caps output, how a thinking level travels — configurable per route and per model. A model neither the entry nor the installed catalog sizes takes the route's `defaultContextWindow` and `defaultMaxTokens` fallbacks.

### Change configuration at runtime
Request modalities resolve entry `input` → installed catalog entry → route `defaultInput` (default `[text]`), the same order and the same fallback role the capacities above use. So a catalog model keeps the modalities the catalog records for it, and a narrower route default never strips them; a gateway whose *undescribed* models all take images declares `[text, image]` once at the route instead of on every entry. `video` is the one modality beyond pi-ai's own vocabulary: a video never enters pi-ai as a content block — it rides through as a stable text marker naming its attachment, and the adapter's process-wide fetch pipeline rewrites that marker into the endpoint's `video_url` wire item, so pi-ai never sees a video block. An entry's empty list means the same as an absent one — it describes a model accepting nothing, so it states no answer and resolution continues past it, which is what keeps a catalog model's own modalities when a `models` entry names it without declaring any. The route's may not be empty, since nothing sits below it to answer instead.

Profiles are re-read once per operation through the optional settings seam: the base and the user's `llm-pi-ai:` settings section merge per provider, so a user can add a route, override one field of a composition route, or point a route at another proxy, all effective on the next request with no restart. A section the adapter could not serve is refused where it is written — `settings.mutate` answers `settings-rejected` — and a stored section that later fails keeps the namespace's last good value. When the route set or a route's retry policy changes, the plugin re-registers atomically: a conflicting route leaves the previous routes serving.

### Discover models from endpoints

The plugin answers "which models can this provider serve?" for a route a configuration surface is editing or drafting. A route the installed catalog ships is answered from that catalog with no network call; only a route the catalog does not describe is interrogated over the wire (`openai-completions` and `openai-responses` shapes). The reply is candidate metadata a surface may offer for adoption — nothing is stored, and `settings.yaml` remains the only thing that decides what a route serves.
Resolution still fails loud, naming the offending route and model, when a route cannot be served at all: a route the catalog does not ship needs `api` (on the route or on every model), `baseURL`, and a non-empty `models` list of uniquely-identified models. That resolution runs inside the section schema, so an unserviceable profile is refused **where it is written** — `settings.mutate` answers `settings-rejected` naming the route and model — rather than being stored and then quietly disabling every route in the namespace. The settings seam keeps a namespace's last good value for an already-stored section that fails, so this cannot strand a deployment. `api` accepts the protocols in `supportedProtocols()` and is only needed when the catalog cannot supply one: a model absent from the catalog inherits the protocol its shipped siblings agree on, so adding a model to a single-protocol catalog route restates nothing. A mixed-protocol catalog route keeps each shipped model's own protocol unless the model or the route names one.
`baseURL` sets the endpoint of every model on the route, so private proxies such as `https://proxy.example.com:8443` remain supported; a catalog route that omits it keeps each catalog model's own endpoint. Naming `api` on a catalog route is the default for models that do not name their own; a model-level `api` is how one route hosts Completions, Responses, and Anthropic Messages side by side.

### Failures and recovery

A route pi-ai does not ship needs `api`, `baseURL`, and a non-empty `models` list; an unserviceable profile is refused where it is written, naming the route and model. Failures carry stable codes: a credential that cannot be used fails with `INVALID_CREDENTIAL` naming the route and reference, a route whose `apiKeyEnv` reference resolves to nothing fails with `MISSING_CREDENTIAL`, an unconfigured model fails with `UNKNOWN_MODEL`, and terminal provider failures distinguish `QUOTA` from transient `RATE_LIMIT`. `GenerateOptions.stop` is rejected with `UNSUPPORTED_OPTION` because pi-ai's common streaming UI cannot guarantee it across providers.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains the design behind the adapter; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design philosophy

The adapter is built on immutable snapshots and per-operation resolution. Each operation captures a whole snapshot — the profiles plus a `createModels()` collection holding the `Provider` each route built — before its first `await`, and a configuration change builds a new collection rather than mutating the one in use, so a request that started under one configuration never finishes under another. A route's own credential reference resolves through the harness seam and rides as the request's `apiKey` option, which pi-ai treats as the highest-priority auth override — that is what keeps the fail-loud reference semantics. Everything that override does not cover reaches pi-ai through the collection's own auth: the credential store holds the records a login wrote and a refresh rotates (addressed as `llm-pi-ai/<provider id>`), and the auth context answers the ambient questions a provider asks while resolving. Both are stable across snapshots, so a configuration change rebuilds the collection without forgetting who is signed in.
Supported profile fields are `apiKeyEnv`, `displayName`, `api`, `baseURL`, `models`, `modelOverrides`, `compat`, `defaultContextWindow`, `defaultMaxTokens`, `defaultInput`, `headers`, `reasoning`, `thinkingBudgets`, `cacheRetention`, `transport`, `timeoutMs`, `websocketConnectTimeoutMs`, `streamIdleTimeoutMs`, and `retryPolicy`. Each profile's optional retry policy is captured with that provider route; omission uses the product-wide default from `dsh-llm-default-policy`. The stream-idle interval is a positive finite Node timer delay, uses that same product-wide default when omitted, and covers only an outstanding provider read, not consumer think time. Harness app attribution wins a conflicting configured header name.

Supported profile fields are `apiKeyEnv`, `displayName`, `api`, `baseURL`, `models`, `modelOverrides`, `compat`, `defaultContextWindow`, `defaultMaxTokens`, `defaultInput`, `headers`, `reasoning`, `thinkingBudgets`, `cacheRetention`, `transport`, `timeoutMs`, `websocketConnectTimeoutMs`, `streamIdleTimeoutMs`, `maxRequestImageBytes`, `maxRequestVideoBytes`, and `retryPolicy`. Each resolved profile retry policy is captured with that provider route; omission uses the shared bounded normal default of five retries. The stream-idle interval is a positive finite Node timer delay, defaults to five minutes, and covers only an outstanding provider read, not consumer think time. `maxRequestImageBytes` bounds one request's base64-encoded image payload (default 20MiB, a positive integer): every image in history is re-encoded into every request, so when the accumulated payload exceeds the bound, the oldest images are replaced by a fixed text placeholder until the request fits, keeping an image-heavy session serviceable instead of permanently rejected by a gateway request-size cap. The default leaves capacity for system prompts, history, tools, and JSON; deployments behind stricter gateways lower it per route. `maxRequestVideoBytes` bounds one request's base64-encoded video payload (default 100MiB, a positive integer, validated like the image budgets): a request whose videos exceed it is refused with `UNSUPPORTED_CONTENT` naming the payload size — a video is never offloaded to a placeholder. Harness app attribution wins a conflicting configured header name.

Supported profile fields are `apiKeyEnv`, `displayName`, `api`, `baseURL`, `models`, `modelOverrides`, `compat`, `defaultContextWindow`, `defaultMaxTokens`, `defaultInput`, `headers`, `reasoning`, `thinkingBudgets`, `cacheRetention`, `transport`, `timeoutMs`, `websocketConnectTimeoutMs`, `streamIdleTimeoutMs`, `maxRequestImageBytes`, `maxRequestVideoBytes`, `requestImagePixelBudget`, `requestImageMaxBytes`, and `retryPolicy`. Each resolved profile retry policy is captured with that provider route; omission uses the shared bounded normal default of five retries. The stream-idle interval is a positive finite Node timer delay, defaults to five minutes, and covers only an outstanding provider read, not consumer think time. Every image route derives a deterministic request version from the provider-independent normalized attachment under `requestImagePixelBudget` (default 2048 by 2048 total pixels) and `requestImageMaxBytes` (default 1MiB raw bytes). Before reading attachments, `maxRequestImageBytes` applies to conservative request-version upper bounds and replaces the oldest over-budget images with fixed text; exact base64 lengths are checked again after retained versions are generated. The 20MiB default can retain fifteen maximum-size 1MiB versions after base64 expansion while leaving request-body headroom. The same version feeds inline base64, and its stable descriptor exposes the attachment id and actual request-image dimensions. Harness app attribution wins a conflicting configured header name.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: profile resolution, settings wiring, directory and route registration |
| [`src/auth.ts`](src/auth.ts) | The credential store and ambient auth context over the harness credential plane |
| [`src/login.ts`](src/login.ts) | Authorization flows for the installed providers that ship a login |
| [`src/config.ts`](src/config.ts) | Profile schema, resolution, and serviceability checks |
| [`src/catalog.ts`](src/catalog.ts) | Installed-catalog integration and drift gates |
| [`src/provider.ts`](src/provider.ts) | The supported-protocol table and provider construction |
| [`src/context.ts`](src/context.ts) | Harness-to-pi-ai context conversion, image handling, replay restore |
| [`src/stream.ts`](src/stream.ts) | pi-ai event conversion into harness `StreamChunk` values |
| [`src/replay.ts`](src/replay.ts) | Versioned `ReplayEnvelope` storage and validation |
| [`src/discovery.ts`](src/discovery.ts) | Endpoint interrogation for configuration surfaces |

### Registration and directory

The plugin declares every installed catalog provider it can authenticate in the configurable-provider directory, joined with every route the current profiles declare, so configuration surfaces can offer the full catalog before any route exists. Each entry carries `declared` — whether pi-ai ships nothing under that key — because only the adapter can distinguish a hand-declared route from a narrowed catalog route. Route registration is atomic: a candidate set that collides with another adapter leaves the previous routes serving. A bare mount with zero routes is the dormant posture: nothing registers until a settings section supplies profiles, and routes drop when it empties.
A request naming a route the **installed catalog ships is answered from that catalog**, with no network call: pi-ai's registry is the authoritative list for its own providers, and it carries the context windows, output caps, and selectable thinking levels a listing endpoint would not disclose. Such a route needs no `baseURL` at all. Only a route the catalog does not describe — a gateway, a self-hosted server — is interrogated over the wire, and one that names no endpoint is told to set one or enter its models by hand.

### Replay and vocabulary

Successful assistant responses store a versioned, lossless-JSON replay state beside the provider and model that produced them — response-level facts plus one per-block entry per streamed block. At request time, `LlmRuntime` passes replay state only when the same adapter instance owns both routes; the adapter validates it and restores native response ids and provider signatures, degrading an unusable state to provider-neutral content instead of failing the request. pi-ai tool-call arguments are parsed objects, so the adapter parses input and re-stringifies output to the harness raw-JSON convention; pi-ai in-stream error events map to terminal `finish` chunks.

</details>
Most listings disclose an id and nothing else; `context_window`/`context_length` and `max_output_tokens`/`max_tokens` are read when a gateway supplies them, and `reasoningEfforts`/`reasoning_efforts` plus `supportsReasoningEffort`/`supports_reasoning_effort` are read when a gateway advertises selectable thinking levels. Known pi-ai level ids are kept with their wire spelling; unknown tokens are dropped. Entries without a usable id are skipped rather than failing the whole listing, and everything else the adopting surface still owes. The reply is read under a four-megabyte ceiling enforced on the bytes actually received — the endpoint is a URL the user typed, so a declared length is checked first but never trusted as the bound. An unreachable endpoint, a refused credential, a non-JSON body, and a body with no `data` array all fail with `DISCOVERY_FAILED` and a message naming the endpoint and, for a 401 or 403 alone, the credential. Cancellation during the body read surfaces as `ABORTED`, like a cancellation before the request went out.

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough. They move from the service contract to the twin adapter and the shared types.

- [dsh-llm service](../llm/README.md) — the provider-neutral service this adapter registers on.
- [llm-deepseek adapter](../llm-deepseek/README.md) — the direct DeepSeek twin for the `deepseek-official` route.
- [LLM streaming subsystem](../../../docs/subsystems/llm-streaming.md) — the `StreamChunk` protocol and adapter contract.
- [llm-retry](../llm-retry/README.md) — the retry executor that applies each profile's `retryPolicy`.
- [Twin LLM adapters](../../../.agents/notes/implemented/architecture/2026-06-13-twin-llm-adapters.md) — why the DeepSeek route ships two structurally different adapters.
- [Generated configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-llm-pi-ai) — every accepted config field and its source declaration.

-----

<a id="model-experience"></a>
## Model Experience

### Provider request through pi-ai

#### What the model sees

The selected catalog model receives `GenerateOptions.system`, history, tools, and sampling fields supported by pi-ai's common streaming API. Each retained image is preceded by text naming its complete attachment id and actual request dimensions. When the current execution filesystem maps the attachment provider's host object, the text also carries a read-only normalized-object path and warns that normalization or request projection may have resized or re-encoded the upload. When accumulated base64 image payload exceeds the route's `maxRequestImageBytes`, each offloaded image keeps its own identity and currently resolved access in replacement text. Offloaded normalized attachments are not read or transformed. Provider-native replay metadata is restored only when the adapter validates it for the historical content.
The selected catalog model receives `GenerateOptions.system`, history, tools, and sampling fields supported by pi-ai's common streaming API. Each retained image is preceded by stable text naming its complete attachment id and actual request dimensions. Each video rides as one stable marker text item naming its attachment; the fetch pipeline replaces whole marker items — and markers embedded in tool-result text, which move into a following user message — with the endpoint's `video_url` content before the request leaves. When accumulated base64 image payload exceeds the route's `maxRequestImageBytes`, each offloaded image (oldest first) is replaced by fixed text that tells the model to read the file again when a path is available or ask the user to attach it again. Offloaded normalized attachments are not read or transformed. Provider-native replay metadata is restored only when the adapter validates it for the historical content.

#### Token effect

Provider tokenization governs exact input. Retained images add the stable attachment and coordinate descriptor; the offload placeholder replaces an omitted image's visual tokens. Replay metadata may let a native API reuse provider-side state.

#### KV Cache effect

Conversion preserves logical request order, while image handles and offload placeholders add model-visible text. A changed execution-world path rewrites a historical handle and can prevent reuse from that image even when attachment identity and request bytes stay stable. Changing adapter instance, provider, model, or another upstream token has the same suffix effect. Crossing the image bound replaces an earlier image with placeholder text, so reuse ends at that message until the offloaded prefix stabilizes.

### Provider response

#### What the model sees

pi-ai events become harness reasoning, text, tool-call, usage, and finish chunks. The adapter passes parsed tool arguments to the harness as raw JSON strings. OpenAI-compatible SSE `data:` JSON whose string literals contain raw C0 controls or an unterminated quote is repaired on the fetch body before the OpenAI SDK parses it, so a Grok-style `run_code` payload with real newlines still becomes a tool call instead of `PI_AI_ERROR`.

#### Token effect

Generated content affects later inputs only after the loop records it. pi-ai folds reasoning tokens into output usage when the provider does not report them separately, and preserves its exact `totalTokens` value unchanged.

#### KV Cache effect

Recorded response content appends to the next request and does not invalidate its earlier reusable prefix. Unrecorded transport metadata and usage accounting do not affect cache identity.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define where the adapter stops and future work begins. They are current package constraints, not a general pi-ai comparison or a task backlog.

- **`maxRequestImageBytes` counts base64 image payload only** — text, tools, descriptors, and JSON structure ride outside the bound, so it must sit below the gateway's request-body cap with headroom. Offload is a deterministic request projection and is not recorded as a session event.
- **`video_url` injection targets OpenAI-compatible chat completions only** — the marker rewrite hooks process-wide `globalThis.fetch` for POSTs whose URL ends in `/chat/completions`, so a video-capable route speaking another wire protocol would send the marker text untransformed; a second wire format is the trigger for the deferred `videoFormat` switch. `maxRequestVideoBytes` refuses rather than offloads, so one over-budget video fails the request naming the size until it is removed or the budget is raised.
- **A sign-in lives only in the process that started it** — an authorization attempt is not durable, so reloading the page mid-login abandons it and the human starts over. Signing out is `deleteRecord` on the stored record, which forgets it locally without telling the issuer.
- **Provider-native discovery answers through this plugin's ambient context** — a route naming no credential defers to the catalog provider's own resolution, which asks for environment values (`AZURE_OPENAI_API_KEY`, `AWS_PROFILE`, and each provider's own set) and for local credential files. Both questions are answered here: the credential seam is consulted before the process environment, and file existence is checked against the host process's filesystem with `~` expanded. What it cannot do is *read* a credential file's contents — a provider that parses `~/.aws/credentials` itself does so directly, outside the seam.
- **Settings can add or override routes, not remove composition routes** — the user layer merges over the composition base, so deleting a `cordis.yml`-provided provider is a composition change.
- **The layered merge has no delete for dict keys** — a `reasoningEfforts` level, `modelOverrides` entry, or `compat` field the base declares can be overridden but not removed by the user layer.
- **`headers` can carry a credential the redactor never sees** — the profile's `headers` dict is plain strings; store credentials as `apiKeyEnv` references.
- **A route's catalog never refreshes itself** — the catalog is whatever `settings.yaml` says; nothing here queries a provider for the models it serves.
- **One wire protocol per route** — a mixed-protocol catalog route cannot host a model of the other protocol; splitting the provider across two route keys is the workaround.
- **A modality declaration is not verified** — a model declaring `image` its gateway does not serve is refused by the provider after prompt admission. The durable image remains in history and the same misdeclared model can fail again; switching to a text-only model remains possible because the shared LLM runtime projects image references into stable text for that request.
- **An unauthenticated route depends on its protocol** — a route naming no credential resolves as configured-but-keyless, but pi-ai's OpenAI-compatible implementation still requires an API key or an `Authorization` header, so a keyless local server needs a placeholder credential referenced by `apiKeyEnv` or an `Authorization` entry in `headers`.
- **`GenerateOptions.stop` is unsupported** — pi-ai's common stream options cannot guarantee stop-sequence behavior across providers.
- **In-history `system` messages use pi-ai's common context conversion** — provider-specific placement follows pi-ai rather than a harness-owned wire override.
- **Provider HTTP status is unavailable** — pi-ai error events do not expose a stable HTTP status across providers.
- **Retry policy is provider-owned, not an SDK retry** — pi-ai SDK retries stay disabled so durable agent steps and `llm/retry` events own every visible attempt, and direct `ctx.llm.stream()` calls remain single-attempt.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is non-authoritative working context: undecided directions and notes for maintainers. Shipped behavior and accepted rationale live in the sections above, the package code, and the linked Agent Notes.

- The offered protocol set is deliberately narrower than pi-ai's full API set: Bedrock, Vertex, Azure, and Codex authenticate through flows a profile cannot completely describe with a key, an endpoint, and headers; catalog routes still reach them through their own provider, and only an explicit override is refused. Codex is sign-in-able through the authorization flow's OAuth grant.
- The `compat` switch set is pinned to pi-ai's compat types by drift gates; an upstream upgrade that adds a field, gives a further protocol a compat type, or widens a value union fails the build until someone classifies it.

</details>
- **Settings can add or override routes, not remove composition routes** — the user layer merges over the composition `base`, so deleting a `cordis.yml`-provided provider is a composition change; `replace` on the namespace only resets the user layer.
- **The layered merge has no delete for dict keys** — the settings seam merges the composition `base` and the user layer per key, recursively, so a `reasoningEfforts` level, `modelOverrides` entry, or `compat` field the base declares cannot be removed by the user layer, only overridden — and for `reasoningEfforts` absence *is* the meaning ("not offered"), so a base-declared level stays offered. This only triggers when a `cordis.yml` entry config declares per-model reasoning fields for the same model the user layer edits; the supported posture is to leave those to the settings document (the shipped composition mounts the adapter dormant), and a `models` list is an array replacing wholesale, which is the in-band escape.
- **`headers` can carry a credential the redactor never sees** — the profile's `headers` dict is plain strings, so `Authorization` or `api-key` set there is returned verbatim by a redacted `describe()` and rendered by any configuration UI. Store credentials as `apiKeyEnv` references; making the dict write-only is deferred with the rest of the [wire-boundary work](../llm/README.md#known-limitations-and-deferred-work).
- **A route's catalog never refreshes itself** — the catalog is whatever `settings.yaml` says, so a model list is only as current as its last edit. Nothing here queries a provider for the models it serves; a route gains a model when someone writes one.
- **A model without `api` still needs a resolvable protocol** — a hand-declared model that names neither its own `api` nor a route-level one is refused at write time. Catalog models keep their installed protocol until the model or the route names another.
- **A modality declaration is not verified, and over-claiming outlives the turn** — nothing interrogates an endpoint for what it accepts, so a model declaring `image` its gateway does not serve is refused by the provider mid-turn rather than here. Prompt admission commits the user message durably before the request is built, so the rejected image stays in the session log: that model keeps re-sending it, and model selection refuses a switch to any text-only model. Recovery is another image-capable model, a fork before the image, or a new session; rolling an unconsumed image message back out of the log on a failed send is deferred.
- **One wire protocol per route** — `api` applies to the whole route, so a mixed-protocol catalog route (an OpenAI-style catalog spanning Responses and Chat Completions) cannot host a model of the other protocol, and adding a model such a route does not describe requires naming `api` and moving every model onto it. Splitting the provider across two route keys is the workaround.
- **A modality declaration is not verified** — nothing interrogates an endpoint for what it accepts, so a model declaring `image` its gateway does not serve is refused by the provider after prompt admission. The durable image remains in history and the same misdeclared model can fail again. Switching to a text-only model remains possible because the shared LLM runtime projects image references into stable text for that exact request.
- **An unauthenticated route depends on its protocol** — naming no credential resolves the route as configured-but-keyless, but pi-ai's OpenAI-compatible implementation still requires an API key or an `Authorization` header, so a keyless local server needs a placeholder credential referenced by `apiKeyEnv` or an `Authorization` entry in `headers`.
- **`GenerateOptions.stop` is unsupported** — pi-ai's common stream options cannot guarantee stop-sequence behavior across providers, so the adapter rejects the field.
- **Provider HTTP status is unavailable** — pi-ai error events do not expose a stable HTTP status across providers; failures expose only stable harness error codes.
- **Retry policy is provider-owned, not an SDK retry** — each provider profile may supply nested `retryPolicy`; omission resolves to normal mode with five retries, and the effective route policy is what `dsh-llm-retry` executes at the agent failed-step extension point. pi-ai SDK retries stay disabled so durable agent steps and `llm/retry` events own every visible attempt, and direct `ctx.llm.stream()` calls remain single-attempt.
- **SSE JSON repair is string-literal local** — raw C0 controls and an unterminated quote inside JSON strings are escaped or closed, and unmatched `{` / `[` on a truncated event are closed, so the OpenAI SDK can parse the event. The walker does not invent keys or values; a payload that is still not JSON after that pass fails the turn as `PI_AI_ERROR`. Closing a truncated string can yield a partial tool-call argument object, which the tool executor then validates.
