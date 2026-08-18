# @deepseek-ai/dsh-client-ui-settings-llm-policy

English | [中文](README.zh.md)

General settings row for the product-wide model-request retry budget and stream-idle timeout. The Host schema lives on `@deepseek-ai/dsh-llm-default-policy`; this package only binds that section into `settings.general.item`.

The row edits three fields: finite retry count (default 5), an Unlimited switch that maps onto always-mode recovery, and the outstanding-read idle interval shown in seconds (default 300). A provider that sets its own `retryPolicy` or `streamIdleTimeoutMs` keeps that value.

## Model Experience

Indirectly, through the retry budget and idle interval adapters apply when a provider omits those fields.

#### KV Cache effect

Changing the row affects only later adapter registrations that still omit their own policy or idle interval.

## Known Limitations and Deferred Work

- The row writes one process-wide default; per-provider overrides stay on each adapter's own configuration.
