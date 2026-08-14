# Agent Note: Shipped FAC provider route

Status: implemented

English | [中文](2026-08-15-fac-provider-route.zh.md)

## Problem

The Models page can add any installed pi-ai catalog provider or a fully declared custom gateway. FastAI Code (`fac`) is an OpenAI-compatible endpoint at a known public URL, but pi-ai does not ship it. Users had to create a custom provider and type the URL every time.

## Decision

`dsh-base` mounts a composition `fac` profile so the Models page shows FAC as a first-class card above DeepSeek. The route key is `fac`, the display name is `FAC`, the default endpoint is `https://new.fastaicode.top/v1`, and the wire protocol is `openai-completions`. `dsh-llm-pi-ai` also declares FAC first in the configurable-provider directory. A settings profile with no `api`, `baseURL`, or `models` is serviceable: the adapter registers the route, discovery asks that default URL, and unlisted model ids still fail at request time with `UNKNOWN_MODEL` until the user fetches or enters them. `declared` is false, so the Models page treats FAC as a shipped provider rather than a custom one. The editor placeholder for an unset FAC `baseURL` is that same default URL.

## Alternatives considered

**Leave FAC only in the dormant add-provider list.** Rejected because the request is a first-class card at DeepSeek's rank, not a catalog option the user has to add.

**Give FAC its own adapter package beside `llm-deepseek`.** Rejected because the endpoint is OpenAI-compatible and already served by the pi-ai adapter once the route, protocol, and URL are known.

**Keep FAC as a custom-provider recipe only.** Rejected because the URL is a product default, not a per-deployment invention, and the custom card would keep asking for a protocol and at least one model before save.

## Consequences

The Models page always shows FAC above DeepSeek. Saving a key-only FAC profile records `providers.fac` (plus `apiKeyEnv` when a key is stored) and leaves models empty until the user fetches or enters them. A later custom `baseURL` still overrides the default. An empty FAC model list does not appear in the composer until the user fetches or enters models.

## Testing

`packages/llm/llm-pi-ai/tests/catalog.spec.ts` pins FAC first in the directory and a key-only profile's default endpoint. `discovery.spec.ts` stubs `fetch` and asserts the listing URL. `packages/client/ui-settings-models/tests/components.client.spec.tsx` pins the FAC placeholder and composition-owned setup-card posture. `apps/web/tests/models-settings.e2e.ts` and the Models-page snapshots show the FAC card above DeepSeek.
