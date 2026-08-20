// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SkillsSection } from '../src/client/SkillsSection.tsx'
import type { SkillsSectionInjected, SkillsSectionProps } from '../src/client/SkillsSection.tsx'
import { en, type SkillsSettingsKey } from '../src/client/locales.ts'
import { matchesSkill, sourceLabelKey } from '../src/client/catalog.ts'
import type { SkillCatalogEntry } from '@deepseek-ai/dsh-api-remotes/client'

afterEach(cleanup)

const t = ((key: SkillsSettingsKey): string => en[key]) as SkillsSectionProps['t']

function props(list: SkillsSectionInjected['list']): SkillsSectionProps {
  return {
    t,
    list,
  } as SkillsSectionProps
}

const CATALOG: readonly SkillCatalogEntry[] = [
  {
    name: 'dsh-badge',
    description: 'Official powered-by-dsh badge',
    modelInvocable: true,
    userInvocable: true,
    source: 'bundled',
    provider: 'dsh-badge',
  },
  {
    name: 'review-pr',
    description: 'Review a pull request',
    whenToUse: 'when reviewing',
    modelInvocable: false,
    userInvocable: true,
    source: 'user-dsh',
    provider: 'filesystem',
  },
  {
    name: 'custom-root',
    description: 'From an extra directory',
    modelInvocable: true,
    userInvocable: false,
    source: 'vendor-pack',
    provider: 'custom-provider',
  },
]

describe('source labels', () => {
  it('maps known origin buckets and leaves unknown sources verbatim', () => {
    expect(sourceLabelKey('bundled')).toBe('sourceBundled')
    expect(sourceLabelKey('runtime')).toBe('sourceRuntime')
    expect(sourceLabelKey('user-dsh')).toBe('sourceUserDsh')
    expect(sourceLabelKey('user-agents')).toBe('sourceUserAgents')
    expect(sourceLabelKey('project-dsh')).toBe('sourceProjectDsh')
    expect(sourceLabelKey('project-agents')).toBe('sourceProjectAgents')
    expect(sourceLabelKey('project-codex')).toBe('sourceProjectCodex')
    expect(sourceLabelKey('project-claude')).toBe('sourceProjectClaude')
    expect(sourceLabelKey('custom')).toBe('sourceCustom')
    expect(sourceLabelKey('vendor-pack')).toBeUndefined()
  })

  it('matches name, description, source, and provider', () => {
    const skill = CATALOG[0]!
    expect(matchesSkill(skill, '')).toBe(true)
    expect(matchesSkill(skill, 'badge')).toBe(true)
    expect(matchesSkill(skill, 'bundled')).toBe(true)
    expect(matchesSkill(skill, 'missing')).toBe(false)
    expect(matchesSkill(CATALOG[1]!, 'reviewing')).toBe(true)
  })
})

describe('SkillsSection', () => {
  it('renders built-in and user skills as disclosure cards', async () => {
    const deferred = Promise.withResolvers<readonly SkillCatalogEntry[]>()
    const list = vi.fn(() => deferred.promise)
    const view = render(<SkillsSection {...props(list)} />)
    expect(screen.getByText(en.loading)).toBeTruthy()

    await act(async () => { deferred.resolve(CATALOG) })
    expect(list).toHaveBeenCalledOnce()
    expect(screen.getByRole('searchbox', { name: en.search })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.catalog })).toBeTruthy()
    expect(view.container.querySelector('[data-skill-count]')?.textContent).toBe('3')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText(en.sourceBundled)).toBeTruthy()
    expect(screen.getByText(en.sourceUserDsh)).toBeTruthy()
    expect(screen.getByText('vendor-pack')).toBeTruthy()

    const builtin = screen.getByRole('button', { name: 'dsh-badge, Built-in' })
    expect(builtin.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(builtin)
    expect(builtin.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(en.source)).toBeTruthy()
    expect(screen.getByText(en.provider)).toBeTruthy()
    expect(screen.getByText('dsh-badge', { selector: 'dd' })).toBeTruthy()
    expect(screen.getByText(en.modelYes)).toBeTruthy()
    expect(screen.getByText(en.userYes)).toBeTruthy()
    fireEvent.click(builtin)
    expect(view.container.querySelector('[data-open]')).toBeNull()
  })

  it('filters by name or description and collapses a hidden card', async () => {
    render(<SkillsSection {...props(async () => CATALOG)} />)
    const search = await screen.findByRole('searchbox', { name: en.search })
    fireEvent.click(screen.getByRole('button', { name: 'dsh-badge, Built-in' }))

    fireEvent.change(search, { target: { value: 'review-pr' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('review-pr')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'dsh-badge, Built-in' })).toBeNull()

    fireEvent.change(search, { target: { value: 'not-a-skill' } })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(en.emptySearch)).toBeTruthy()
  })

  it('shows a generic failure and retries into the empty state', async () => {
    const list = vi.fn<SkillsSectionInjected['list']>()
      .mockRejectedValueOnce(new Error('private transport detail'))
      .mockResolvedValueOnce([])
    render(<SkillsSection {...props(list)} />)

    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    expect(screen.queryByText('private transport detail')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(await screen.findByText(en.empty)).toBeTruthy()
  })

  it('contains a synchronous Remote failure and ignores a result after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as SkillsSectionInjected['list']
    const failed = render(<SkillsSection {...props(syncFailure)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<readonly SkillCatalogEntry[]>()
    const pending = render(<SkillsSection {...props(() => deferred.promise)} />)
    pending.unmount()
    await act(async () => { deferred.resolve(CATALOG) })

    const deferredFailure = Promise.withResolvers<readonly SkillCatalogEntry[]>()
    const pendingFailure = render(<SkillsSection {...props(() => deferredFailure.promise)} />)
    pendingFailure.unmount()
    await act(async () => { deferredFailure.reject(new Error('late failure')) })
  })
})
