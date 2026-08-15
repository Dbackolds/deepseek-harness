// @vitest-environment jsdom
/** Sidebar trigger, list, create, and row actions over a scripted store. */
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { AutomationPanel } from '../src/client/AutomationPanel.tsx'
import type { AutomationPanelProps } from '../src/client/AutomationPanel.tsx'
import { AutomationStore } from '../src/client/store.ts'
import type { AutomationRuleView } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'
import type { RpcResponse } from '@deepseek-ai/dsh-api-remotes/client'

afterEach(cleanup)

let nextRpc = 0
function ok<T>(value: T): RpcResponse<T> {
  return { rpcId: ('r-' + String(nextRpc++)) as never, result: { ok: true, value } }
}

function rule(over: Partial<AutomationRuleView> = {}): AutomationRuleView {
  return {
    id: 'rule-1' as AutomationRuleView['id'],
    name: 'morning',
    enabled: true,
    task: 'summarize inbox',
    workspaceId: 'ws-1' as AutomationRuleView['workspaceId'],
    onOverlap: 'skip',
    selector: { kind: 'after', afterSeconds: 60 },
    scheduledAt: '2026-08-15T12:01:00.000Z',
    createdAt: '2026-08-15T12:00:00.000Z',
    updatedAt: '2026-08-15T12:00:00.000Z',
    state: 'scheduled',
    nextAt: '2026-08-15T12:01:00.000Z',
    ...over,
  }
}

const workspace = {
  workspaceId: 'ws-1' as AutomationRuleView['workspaceId'],
  path: '/tmp/ws',
  folders: [],
  title: 'Inbox',
  sessionIds: [],
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T12:00:00.000Z',
}

function t(key: keyof typeof en, vars?: Record<string, string | number>): string {
  let text: string = en[key]
  if (vars === undefined) return text
  for (const [name, value] of Object.entries(vars)) text = text.replace('{' + name + '}', String(value))
  return text
}

function fail(message: string): RpcResponse<never> {
  return { rpcId: ('r-' + String(nextRpc++)) as never, result: { ok: false, error: { code: 'internal', message, details: {} } } }
}

function mount(options: {
  items?: AutomationRuleView[]
  workspaces?: typeof workspace[]
  wide?: boolean
  listError?: string
  deleteError?: string
  createError?: string
} = {}) {
  const items = options.items ?? [rule()]
  const calls: Array<{ name: string; payload: unknown }> = []
  const face = {
    automation: {
      list: () => {
        calls.push({ name: 'list', payload: {} })
        if (options.listError !== undefined) return Promise.resolve(fail(options.listError))
        return Promise.resolve(ok({ items }))
      },
      create: (payload: unknown) => {
        calls.push({ name: 'create', payload })
        if (options.createError !== undefined) {
          return Promise.resolve({
            rpcId: ('r-' + String(nextRpc++)) as never,
            result: { ok: false as const, error: { code: 'internal', message: options.createError, details: {} } },
          })
        }
        return Promise.resolve(ok({ rule: rule({ name: 'created', task: 'ping' }) }))
      },
      setEnabled: (payload: unknown) => {
        calls.push({ name: 'setEnabled', payload })
        return Promise.resolve(ok({ rule: rule({ enabled: false, state: 'disabled' as const }) }))
      },
      runNow: (payload: unknown) => {
        calls.push({ name: 'runNow', payload })
        return Promise.resolve(ok({ run: { id: 'run-1' } }))
      },
      delete: (payload: unknown) => {
        calls.push({ name: 'delete', payload })
        if (options.deleteError !== undefined) {
          return Promise.resolve({
            rpcId: ('r-' + String(nextRpc++)) as never,
            result: { ok: false as const, error: { code: 'internal', message: options.deleteError, details: {} } },
          })
        }
        return Promise.resolve(ok({ id: 'rule-1', deleted: true }))
      },
    },
  }
  const controller = new AutomationStore(face as never)
  const unused = (() => { throw new Error('unused') }) as never
  const props: AutomationPanelProps = {
    wide: options.wide ?? true,
    useSessions: unused,
    useWorkspaces: select => select({
      items: options.workspaces ?? [workspace],
      archivedSessionIds: [],
      state: 'idle',
      phase: 'ready',
      error: null,
      baselinesReady: true,
      recentWorkspaceId: workspace.workspaceId,
    }),
    useAutomation: bindSnapshotSelector(controller.store),
    load: () => controller.load(),
    create: input => controller.create(input),
    setEnabled: (id, enabled) => controller.setEnabled(id, enabled),
    runNow: id => controller.runNow(id),
    remove: id => controller.remove(id),
    t,
  }
  render(<AutomationPanel {...props} />)
  return { calls, controller }
}

describe('AutomationPanel', () => {
  it('renders the trigger and opens the empty panel', async () => {
    mount({ items: [] })
    const trigger = screen.getByRole('button', { name: 'Automation' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Automation' })).toBeTruthy()
    })
    expect(screen.getByText('No rules yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New rule' })).toBeTruthy()
  })

  it('closes the panel from the dialog close control', async () => {
    mount({ items: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByRole('dialog', { name: 'Automation' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Automation' })).toBeNull() })
  })

  it('lists a disabled rule without a workspace title', async () => {
    mount({
      items: [rule({ enabled: false, state: 'disabled', workspaceId: 'missing' as AutomationRuleView['workspaceId'] })],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByText('morning')).toBeTruthy() })
    expect(screen.getByRole('button', { name: 'Enable' })).toBeTruthy()
    expect(screen.queryByText('Inbox')).toBeNull()
  })

  it('keeps the delete dialog open when the Host rejects the delete', async () => {
    mount({ deleteError: 'still referenced' })
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByText('morning')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule' }))
    await waitFor(() => { expect(screen.getByText('still referenced')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete this rule?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Close' }))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Delete this rule?' })).toBeNull() })
  })

  it('lists a rule and runs enable / run-now / delete', async () => {
    const { calls } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByText('morning')).toBeTruthy() })
    expect(screen.getByText('summarize inbox')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    await waitFor(() => { expect(calls.some(call => call.name === 'setEnabled')).toBe(true) })
    fireEvent.click(screen.getByRole('button', { name: 'Run now' }))
    await waitFor(() => { expect(calls.some(call => call.name === 'runNow')).toBe(true) })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule' }))
    await waitFor(() => { expect(calls.some(call => call.name === 'delete')).toBe(true) })
  })

  it('creates an after rule from the form', async () => {
    const { calls } = mount({ items: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByRole('button', { name: 'New rule' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'New rule' }))
    fireEvent.change(screen.getByPlaceholderText('The task the new session should run'), {
      target: { value: 'ping host' },
    })
    fireEvent.change(screen.getByLabelText('Delay in seconds'), { target: { value: '90' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => {
      const created = calls.find(call => call.name === 'create')
      expect(created?.payload).toMatchObject({
        task: 'ping host',
        workspaceId: 'ws-1',
        afterSeconds: 90,
        onOverlap: 'skip',
      })
    })
  })

  it('hides the label on the rail', () => {
    mount({ wide: false })
    expect(screen.getByRole('button', { name: 'Automation' }).textContent).toBe('')
  })

  it('keeps last-good rows and shows a refresh notice', async () => {
    const controllerHolder: { current?: AutomationStore } = {}
    const items = [rule()]
    let lists = 0
    const face = {
      automation: {
        list: () => {
          lists += 1
          return lists === 1
            ? Promise.resolve(ok({ items }))
            : Promise.resolve({
              rpcId: ('r-' + String(nextRpc++)) as never,
              result: { ok: false as const, error: { code: 'internal', message: 'stale host', details: {} } },
            })
        },
        create: () => Promise.resolve(ok({ rule: rule() })),
        setEnabled: () => Promise.resolve(ok({ rule: rule() })),
        runNow: () => Promise.resolve(ok({ run: { id: 'run-1' } })),
        delete: () => Promise.resolve(ok({ id: 'rule-1', deleted: true })),
      },
    }
    const controller = new AutomationStore(face as never)
    controllerHolder.current = controller
    const unused = (() => { throw new Error('unused') }) as never
    render(<AutomationPanel
      wide
      useSessions={unused}
      useWorkspaces={select => select({
        items: [workspace],
        archivedSessionIds: [],
        state: 'idle',
        phase: 'ready',
        error: null,
        baselinesReady: true,
        recentWorkspaceId: workspace.workspaceId,
      })}
      useAutomation={bindSnapshotSelector(controller.store)}
      load={() => controller.load()}
      create={input => controller.create(input)}
      setEnabled={(id, enabled) => controller.setEnabled(id, enabled)}
      runNow={id => controller.runNow(id)}
      remove={id => controller.remove(id)}
      t={t}
    />)
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByText('morning')).toBeTruthy() })
    await controller.load()
    await waitFor(() => { expect(screen.getByText('stale host')).toBeTruthy() })
    expect(screen.getByText('morning')).toBeTruthy()
  })

  it('retries a failed first load', async () => {
    mount({ listError: 'down' })
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByText(/Loading automation rules failed/)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => { expect(screen.getByText(/Loading automation rules failed/)).toBeTruthy() })
  })

  it('creates a local-clock rule after visiting the other schedule fields', async () => {
    const { calls } = mount({ items: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByRole('button', { name: 'New rule' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'New rule' }))
    fireEvent.change(screen.getByPlaceholderText('Optional; defaults to the start of the task'), {
      target: { value: 'morning ping' },
    })
    fireEvent.change(screen.getByPlaceholderText('The task the new session should run'), {
      target: { value: 'clock task' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Once at a time' }))
    fireEvent.change(screen.getByLabelText('Instant (UTC)'), { target: { value: '2026-08-16T09:00:00.000Z' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fixed interval' }))
    fireEvent.change(screen.getByLabelText('Interval in seconds (at least 300)'), { target: { value: '600' } })
    fireEvent.click(screen.getByRole('button', { name: 'Daily or weekly' }))
    fireEvent.change(screen.getByLabelText('Local time'), { target: { value: '09:30' } })
    const zone = screen.getByRole('textbox', { name: 'Time zone' })
    fireEvent.change(zone, { target: { value: 'UTC' } })
    fireEvent.change(zone, { target: { value: 'Asia/Shanghai' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }))
    fireEvent.change(screen.getByLabelText('If the previous session is still running'), { target: { value: 'replace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => {
      const created = calls.find(call => call.name === 'create')
      expect(created?.payload).toMatchObject({
        name: 'morning ping',
        task: 'clock task',
        onOverlap: 'replace',
        localClock: { time: '09:30', time_zone: 'Asia/Shanghai', weekdays: [1] },
      })
    })
  })

  it('blocks create without a workspace and shows draft validation', async () => {
    mount({ items: [], workspaces: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByRole('button', { name: 'New rule' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'New rule' }))
    expect(screen.getByText('Add a workspace before creating a rule.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create' })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByPlaceholderText('The task the new session should run')).toBeNull()
  })

  it('keeps the create form open when the Host rejects the write', async () => {
    mount({ items: [], createError: 'selector conflict' })
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByRole('button', { name: 'New rule' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'New rule' }))
    fireEvent.change(screen.getByPlaceholderText('The task the new session should run'), {
      target: { value: 'ping host' },
    })
    fireEvent.submit(screen.getByPlaceholderText('The task the new session should run').closest('form')!)
    await waitFor(() => { expect(screen.getByText('selector conflict')).toBeTruthy() })
  })

  it('switches workspace and overlap back to skip', async () => {
    const extra = {
      ...workspace,
      workspaceId: 'ws-2' as AutomationRuleView['workspaceId'],
      title: 'Notes',
    }
    const { calls } = mount({ items: [], workspaces: [workspace, extra] })
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByRole('button', { name: 'New rule' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'New rule' }))
    fireEvent.change(screen.getByPlaceholderText('The task the new session should run'), {
      target: { value: 'switch workspace' },
    })
    fireEvent.change(screen.getByLabelText('Workspace'), { target: { value: 'ws-2' } })
    fireEvent.change(screen.getByLabelText('If the previous session is still running'), { target: { value: 'replace' } })
    fireEvent.change(screen.getByLabelText('If the previous session is still running'), { target: { value: 'skip' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => {
      expect(calls.find(call => call.name === 'create')?.payload).toMatchObject({
        workspaceId: 'ws-2',
        onOverlap: 'skip',
      })
    })
  })

  it('shows draft validation when the task is blank', async () => {
    mount({ items: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }))
    await waitFor(() => { expect(screen.getByRole('button', { name: 'New rule' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'New rule' }))
    fireEvent.change(screen.getByPlaceholderText('The task the new session should run'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => { expect(screen.getByText('Enter a task.')).toBeTruthy() })
  })
})
