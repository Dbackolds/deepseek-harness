# automation/ — Host-owned timed new sessions

English | [中文](README.zh.md)

The Automation family owns process-level rules that create a **fresh Session** when a timer fires. Durable state lives in the storage domain, not in any Session log. A process-local owner waits only while the Web Host is live; cold Hosts do no external notification.

| Package | Role | ctx key |
|---|---|---|
| [`automation/`](automation/README.md) | Rule table, timer owner, and fire path | `ctx.automation` |
| [`tool-automation/`](tool-automation/README.md) | Model-facing create/list/update/delete tools | — |

Settings, Host RPC, and model tools must call `ctx.automation`. They must not write the domain tables themselves.

See [Host-owned Automation](../../docs/subsystems/automation.md) for the durable record, overlap policy, and fire contracts.
