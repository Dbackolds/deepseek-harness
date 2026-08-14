/**
 * Model-facing Host Automation tools over `ctx.automation`.
 * @module @deepseek-ai/dsh-tool-automation
 */
import { AutomationInputError, AutomationRuleId } from '@deepseek-ai/dsh-automation'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { automationToolExecution, requireDirectHuman } from './authority.ts'
export const name = 'tool-automation'
export const inject = ['agents', 'automation', 'tools', 'workspaceRegistry']
const LIST_DESCRIPTION = 'List every Host Automation rule: name, next fire time, enabled state, overlap policy, and workspace. '
    + 'Call this before updating or deleting a rule.'
const CREATE_DESCRIPTION = 'Create one Host Automation rule that opens a NEW session at a future time and submits task. '
    + 'Use this when the user asks to run work later or on a repeating wall-clock schedule. '
    + 'Do not use session-local reminders. Pass exactly one of after_seconds, at, every_seconds, or local_clock. '
    + 'Unattended writes or commands need permission_preset danger-full-access; omitted permission keeps the user default. '
    + 'on_overlap skip waits if the previous run is still running; replace stops that run and starts a new session. '
    + 'Execution rejects non-human and Automation-sourced turns.'
const UPDATE_DESCRIPTION = 'Update one Host Automation rule by id. Changing the schedule still requires exactly one selector field. '
    + 'Call automation_list first. Execution rejects non-human and Automation-sourced turns.'
const DELETE_DESCRIPTION = 'Delete one Host Automation rule by id. Past runs remain. Execution rejects non-human and Automation-sourced turns.'
const ENABLE_DESCRIPTION = 'Enable or disable one Host Automation rule without rewriting its schedule. '
    + 'Execution rejects non-human and Automation-sourced turns.'
const AFTER_SELECTOR = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', required: true, const: 'after' },
    afterSeconds: { type: 'integer', required: true },
  },
}
const AT_SELECTOR = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', required: true, const: 'at' },
  },
}
const EVERY_SELECTOR = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', required: true, const: 'every' },
    everySeconds: { type: 'integer', required: true },
  },
}
const LOCAL_CLOCK_SELECTOR = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', required: true, const: 'local-clock' },
    time: { type: 'string', required: true },
    timeZone: { type: 'string', required: true },
  },
}
const RULE_VIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    enabled: { type: 'boolean', required: true },
    task: { type: 'string', required: true },
    workspaceId: { type: 'string', required: true },
    agentPreset: { type: 'string' },
    permissionPreset: { type: 'string' },
    onOverlap: { type: 'string', required: true, enum: ['skip', 'replace'] },
    selector: { oneOf: [AFTER_SELECTOR, AT_SELECTOR, EVERY_SELECTOR, LOCAL_CLOCK_SELECTOR], required: true },
    scheduledAt: { type: 'string', required: true },
    createdAt: { type: 'string', required: true },
    updatedAt: { type: 'string', required: true },
    state: { type: 'string', required: true, enum: ['scheduled', 'overdue', 'disabled'] },
    nextAt: { type: 'string', required: true },
  },
}
const AT_INPUT_SCHEMA = {
  oneOf: [
    { type: 'string' },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        date: { type: 'string', required: true },
        time: { type: 'string', required: true },
        time_zone: { type: 'string', required: true },
      },
    },
  ],
}
/**
 * Register the five Automation tools on one Agent context.
 * @param ctx - plugin context carrying automation and the tool registry.
 * @param agentCtx - the live root Agent context that receives the tools.
 */
export function registerAutomationTools(ctx, agentCtx) {
  agentCtx.tools.register(defineTool({
    name: 'automation_list',
    description: LIST_DESCRIPTION,
    parameters: {},
    output: {
      schema: { type: 'array', items: RULE_VIEW_SCHEMA },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    presentCall: () => ({ card: 'generic', title: 'automation_list', kind: 'search' }),
    async execute() {
      return ctx.automation.list()
    },
  }))
  agentCtx.tools.register(defineTool({
    name: 'automation_create',
    description: CREATE_DESCRIPTION,
    parameters: {
      task: { type: 'string', required: true, description: 'User prompt submitted to the new session.' },
      name: { type: 'string', description: 'Short display name; omitted, derived from task.' },
      workspace_id: { type: 'string', description: 'Workspace id. Omitted, the current session workspace.' },
      agent_preset: { type: 'string' },
      permission_preset: {
        type: 'string',
        description: 'Pin this permission preset on the new session. Unattended writes need danger-full-access.',
      },
      on_overlap: { type: 'string', enum: ['skip', 'replace'] },
      after_seconds: { type: 'integer', description: 'One-shot delay in seconds.' },
      at: { ...AT_INPUT_SCHEMA, description: 'Absolute RFC 3339 instant with offset, or { date, time, time_zone }.' },
      every_seconds: { type: 'integer', description: 'Fixed-rate interval, at least 300 seconds.' },
      local_clock: {
        type: 'object',
        additionalProperties: false,
        properties: {
          time: { type: 'string', required: true, description: 'HH:mm in time_zone.' },
          time_zone: { type: 'string', required: true },
          weekdays: { type: 'array', items: { type: 'integer' }, description: 'ISO 1=Monday … 7=Sunday. Omitted means every day.' },
        },
      },
    },
    output: {
      schema: RULE_VIEW_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    presentCall: () => ({ card: 'generic', title: 'automation_create', kind: 'other' }),
    async execute(args, exec) {
      const execution = automationToolExecution(ctx, exec)
      requireDirectHuman(ctx, execution)
      try {
        return await ctx.automation.create(buildCreate(ctx, execution.agent.session.header.cwd, args))
      }
      catch (error) {
        throw mapAutomationError(error)
      }
    },
  }))
  agentCtx.tools.register(defineTool({
    name: 'automation_update',
    description: UPDATE_DESCRIPTION,
    parameters: {
      id: { type: 'string', required: true },
      task: { type: 'string' },
      name: { type: 'string' },
      workspace_id: { type: 'string' },
      agent_preset: { type: 'string' },
      permission_preset: { type: 'string' },
      on_overlap: { type: 'string', enum: ['skip', 'replace'] },
      enabled: { type: 'boolean' },
      after_seconds: { type: 'integer' },
      at: AT_INPUT_SCHEMA,
      every_seconds: { type: 'integer' },
      local_clock: {
        type: 'object',
        additionalProperties: false,
        properties: {
          time: { type: 'string', required: true },
          time_zone: { type: 'string', required: true },
          weekdays: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
    output: {
      schema: RULE_VIEW_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    presentCall: () => ({ card: 'generic', title: 'automation_update', kind: 'other' }),
    async execute(args, exec) {
      const execution = automationToolExecution(ctx, exec)
      requireDirectHuman(ctx, execution)
      try {
        return await ctx.automation.update(AutomationRuleId(String(args.id)), buildUpdate(args))
      }
      catch (error) {
        throw mapAutomationError(error)
      }
    },
  }))
  agentCtx.tools.register(defineTool({
    name: 'automation_delete',
    description: DELETE_DESCRIPTION,
    parameters: {
      id: { type: 'string', required: true },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          deleted: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    presentCall: () => ({ card: 'generic', title: 'automation_delete', kind: 'other' }),
    async execute(args, exec) {
      requireDirectHuman(ctx, automationToolExecution(ctx, exec))
      try {
        const deleted = await ctx.automation.delete(AutomationRuleId(args.id))
        return { id: args.id, deleted }
      }
      catch (error) {
        throw mapAutomationError(error)
      }
    },
  }))
  agentCtx.tools.register(defineTool({
    name: 'automation_set_enabled',
    description: ENABLE_DESCRIPTION,
    parameters: {
      id: { type: 'string', required: true },
      enabled: { type: 'boolean', required: true },
    },
    output: {
      schema: RULE_VIEW_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    presentCall: () => ({ card: 'generic', title: 'automation_set_enabled', kind: 'other' }),
    async execute(args, exec) {
      requireDirectHuman(ctx, automationToolExecution(ctx, exec))
      try {
        return await ctx.automation.setEnabled(AutomationRuleId(args.id), args.enabled)
      }
      catch (error) {
        throw mapAutomationError(error)
      }
    },
  }))
}
/**
 * Register the five Automation tools on every later runtime-root Agent.
 * @param ctx - plugin context carrying automation and the tool registry.
 */
export function apply(ctx) {
  ctx.effect(() => {
    const stop = ctx.on('agent/created', ({ agent }) => {
      if (!ctx.agents.roots().includes(agent))
        return
      registerAutomationTools(ctx, agent.ctx)
    })
    return stop
  }, 'tool-automation.register()')
}
/** Resolve create args, filling workspace from the current session when omitted. */
function buildCreate(ctx, cwd, args) {
  const workspaceId = typeof args['workspace_id'] === 'string'
    ? WorkspaceId(args['workspace_id'])
    : resolveCurrentWorkspace(ctx, cwd)
  return {
    task: String(args['task'] ?? ''),
    workspaceId,
    ...typeof args['name'] === 'string' ? { name: args['name'] } : {},
    ...typeof args['agent_preset'] === 'string' ? { agentPreset: args['agent_preset'] } : {},
    ...typeof args['permission_preset'] === 'string' ? { permissionPreset: args['permission_preset'] } : {},
    ...args['on_overlap'] === 'skip' || args['on_overlap'] === 'replace' ? { onOverlap: args['on_overlap'] } : {},
    ...typeof args['after_seconds'] === 'number' ? { afterSeconds: args['after_seconds'] } : {},
    ...args['at'] === undefined ? {} : { at: args['at'] },
    ...typeof args['every_seconds'] === 'number' ? { everySeconds: args['every_seconds'] } : {},
    ...args['local_clock'] === undefined
      ? {}
      : { localClock: args['local_clock'] },
  }
}
/** Sparse update patch from model args. */
function buildUpdate(args) {
  return {
    ...typeof args['task'] === 'string' ? { task: args['task'] } : {},
    ...typeof args['name'] === 'string' ? { name: args['name'] } : {},
    ...typeof args['workspace_id'] === 'string' ? { workspaceId: WorkspaceId(args['workspace_id']) } : {},
    ...typeof args['agent_preset'] === 'string' ? { agentPreset: args['agent_preset'] } : {},
    ...typeof args['permission_preset'] === 'string' ? { permissionPreset: args['permission_preset'] } : {},
    ...args['on_overlap'] === 'skip' || args['on_overlap'] === 'replace' ? { onOverlap: args['on_overlap'] } : {},
    ...typeof args['enabled'] === 'boolean' ? { enabled: args['enabled'] } : {},
    ...typeof args['after_seconds'] === 'number' ? { afterSeconds: args['after_seconds'] } : {},
    ...args['at'] === undefined ? {} : { at: args['at'] },
    ...typeof args['every_seconds'] === 'number' ? { everySeconds: args['every_seconds'] } : {},
    ...args['local_clock'] === undefined
      ? {}
      : { localClock: args['local_clock'] },
  }
}
/** Look up the workspace that owns the calling session cwd. */
function resolveCurrentWorkspace(ctx, cwd) {
  if (cwd === undefined) {
    throw new HarnessError('automation_create needs workspace_id because the current session has no workspace', 'AUTOMATION_WORKSPACE_REQUIRED')
  }
  const match = ctx.workspaceRegistry.list().find(workspace => workspace.path === cwd)
  if (match === undefined) {
    throw new HarnessError('automation_create needs workspace_id because the current session workspace is unknown', 'AUTOMATION_WORKSPACE_REQUIRED')
  }
  return match.id
}
/** Map domain errors onto HarnessError so the tool result stays closed. */
function mapAutomationError(error) {
  if (error instanceof AutomationInputError) {
    throw new HarnessError(error.message, `AUTOMATION_${error.code.toUpperCase()}`)
  }
  throw error
}
