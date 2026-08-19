# Host-owned Automation

English | [中文](automation.zh.md)

Automation owns durable rules that return as **new Sessions**, not as later turns of an existing conversation. The Session event log is not the rule table: rules live in the `automation` storage domain. The [package README](../../packages/automation/automation/README.md) owns composition, fire behavior, and overlap policy.

## Durable records

`AutomationRuleId` and `AutomationRunId` are branded ids, unique and never reused. Version 1 stores an enabled flag, task text, workspace id, optional preset names, `onOverlap`, one selector, and a canonical UTC `scheduledAt`.

```ts type-equiv
/** Stable Automation rule identity. Never reused after delete. */
type AutomationRuleId = Branded<'AutomationRuleId'>
```

```ts type-equiv
/** What to do when this rule's previous started session is still running. */
type AutomationOverlapPolicy = 'skip' | 'replace'
```

```ts type-equiv
/** Closed durable selector union stored on a rule. */
type AutomationSelector =
  | AfterAutomationSelector
  | AtAutomationSelector
  | EveryAutomationSelector
  | LocalClockAutomationSelector
```

```ts type-equiv
/** Create request: exactly one time selector field must be present. */
interface CreateAutomationRuleRequest {
  readonly name?: string
  readonly task: string
  readonly workspaceId: WorkspaceId
  readonly agentPreset?: string
  readonly permissionPreset?: string
  readonly onOverlap?: AutomationOverlapPolicy
  readonly afterSeconds?: number
  readonly at?: AtInput
  readonly everySeconds?: number
  readonly localClock?: LocalClockInput
}
```

```ts type-equiv
/** Sparse update. Changing the selector still requires exactly one selector field. */
interface UpdateAutomationRuleRequest {
  readonly name?: string
  readonly task?: string
  readonly workspaceId?: WorkspaceId
  readonly agentPreset?: string | null
  readonly permissionPreset?: string | null
  readonly onOverlap?: AutomationOverlapPolicy
  readonly enabled?: boolean
  readonly afterSeconds?: number
  readonly at?: AtInput
  readonly everySeconds?: number
  readonly localClock?: LocalClockInput
}
```

```ts type-equiv
/** Durable rule record. */
interface AutomationRuleRecord {
  readonly id: AutomationRuleId
  readonly name: string
  readonly enabled: boolean
  readonly task: string
  readonly workspaceId: WorkspaceId
  readonly agentPreset?: string
  readonly permissionPreset?: string
  readonly onOverlap: AutomationOverlapPolicy
  readonly selector: AutomationSelector
  readonly scheduledAt: string
  readonly createdAt: string
  readonly updatedAt: string
}
```

```ts type-equiv
/** Model- and UI-facing view of one rule. */
interface AutomationRuleView extends AutomationRuleRecord {
  readonly state: AutomationRuleState
  readonly nextAt: string
}
```

```ts type-equiv
/** Durable fire attempt. */
interface AutomationRunRecord {
  readonly id: AutomationRunId
  readonly ruleId: AutomationRuleId
  readonly sessionId?: SessionId
  readonly startedAt: string
  readonly outcome: AutomationRunOutcome
  readonly errorCode?: string
}
```

A fire writes one run (`started`, `skipped_busy`, `replaced`, or `failed`) and, on a started Session, a log-only `automation/start` event. The model-visible input remains the ordinary `user/message`.

## Live delivery

The process-local owner derives its earliest timer from enabled rules and rereads the wall clock after every bounded wait. Cold Hosts do no work. Due rules occupy one Host-wide queue. `skip` waits for the previous Agent to leave `running`; `replace` cancels that Agent and opens the next Session immediately.

Session headers created by a fire carry `origin: 'automation'`.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxautomation--automationservice"></a>

### `ctx.automation` — `AutomationService`

Host-owned Automation service. CRUD, listing, and fire all go through this object; tools and Host RPC must not write the domain tables themselves.

```ts cordis-catalog
/**
   * List every rule in creation order with derived delivery state.
   * @returns detached rule views.
   */
list(): AutomationRuleView[]

/**
   * Read one rule.
   * @param id - Rule id.
   * @returns the view, or `undefined` when unknown.
   */
get(id: AutomationRuleId): AutomationRuleView | undefined

/**
   * Create one enabled rule and arm its first target.
   * @param request - Caller-supplied fields; exactly one time selector.
   * @returns the created view.
   */
create(request: CreateAutomationRuleRequest): Promise<AutomationRuleView>

/**
   * Apply a sparse patch. Selector fields replace the whole selector.
   * @param id - Existing rule.
   * @param patch - Fields to change.
   * @returns the updated view.
   */
update(id: AutomationRuleId, patch: UpdateAutomationRuleRequest): Promise<AutomationRuleView>

/**
   * Delete one rule. Its id is never reused. Runs stay for history.
   * @param id - Rule to remove.
   * @returns `true` when a record was deleted.
   */
delete(id: AutomationRuleId): Promise<boolean>

/**
   * Enable or disable one rule without rewriting its selector.
   * @param id - Existing rule.
   * @param enabled - Next armed state.
   * @returns the updated view.
   */
setEnabled(id: AutomationRuleId, enabled: boolean): Promise<AutomationRuleView>

/**
   * Fire one rule immediately without moving its next scheduled target.
   * @param id - Existing rule.
   * @returns the run written for this attempt.
   */
runNow(id: AutomationRuleId): Promise<AutomationRunRecord>

/**
   * Recent runs for one rule, newest first.
   * @param id - Existing rule.
   * @param limit - Maximum rows; defaults to 20.
   * @returns detached run records.
   */
listRuns(id: AutomationRuleId, limit: number = 20): AutomationRunRecord[]

/**
   * Delete one past run. Its id is never reused.
   * @param id - Run to remove.
   * @returns `true` when a record was deleted.
   */
deleteRun(id: AutomationRunId): Promise<boolean>

/**
   * Enabled rules whose target is due at `now`.
   * @param now - Wall-clock decision time.
   * @returns due records in target then create order.
   */
dueRules(now: number): readonly AutomationRuleRecord[]

/**
   * Earliest future target among enabled rules.
   * @param now - Wall-clock decision time.
   * @returns epoch milliseconds, or `undefined` when nothing is armed.
   */
nextWakeAt(now: number): number | undefined

/**
   * Admit one due rule from the timer owner.
   * @param id - Due rule.
   * @param now - Shared decision time for this batch.
   * @returns the run written for this attempt.
   */
fireDue(id: AutomationRuleId, now: number): Promise<AutomationRunRecord>
```

Source: [`packages/automation/automation/src/index.ts:120`](../../packages/automation/automation/src/index.ts)
<!-- END GENERATED cordis-surface -->
