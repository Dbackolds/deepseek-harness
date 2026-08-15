# @deepseek-ai/dsh-client-ui-automation

English | [中文](README.zh.md)

Web Host Automation feature owner: occupies `sidebar.automation` under the sidebar New Session control with a clock-icon trigger that matches that control's geometry, and occupies `shell.overlay` with a center-column page listing Host Automation rules and creating one. Data arrives through the Host `automation.*` wire; this package holds no durable state beyond the page snapshot and the create-form draft. [ui-sidebar](../ui-sidebar/README.md) declares the seat and passes only the column `wide` flag.

The trigger is always present so a Host with no rules still has an entry. Opening the page loads the list once; later opens reuse the snapshot until a mutation or a connection reset refetches. A row shows the rule name, derived delivery state, selector summary, next fire instant, workspace title when the list mirror has it, and the task text. Enable, disable, run-now, and delete write through the same Host service the model tools and Host RPC use. Create accepts exactly one selector: a one-shot delay, a UTC instant, a fixed interval of at least 300 seconds, or a local clock with an IANA zone and optional ISO weekdays.

Styling uses tokens only. Copy goes through the package's own `automation` locale namespace. The Host contract is [Host-owned Automation](../../../docs/subsystems/automation.md); the [Host-owned Automation runs Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-host-owned-automation-runs.md) owns the service decision, and the [Web Automation sidebar Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-automation-sidebar.md) owns this presentation.

## Model Experience

None, as this package renders Host Automation records for a human and touches no prompt, message, schema, stream, or tool result. The model's own view of the same rules stays with [`dsh-tool-automation`](../../automation/tool-automation/README.md).

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **The panel does not edit an existing selector** — update still requires the Host RPC or a model tool. The create form covers the four selectors the service accepts.
- **A stopped Host does not fire** — the list still shows next-fire instants derived by the last live Host; this package does not recompute them.
