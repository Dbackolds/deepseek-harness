// Web e2e scenario: the read-only model-identity surfaces — the session
// header chip (the LAST dispatched request/header, via the requestRoute
// projection) and the per-step model line under each assistant clock — both
// read the durable session log, never the composer selector's staged state.
// Keyless and fixture-less: the two-turn history (a mid-session model
// switch) is seeded cold through the real persistence API under the borrowed
// seeded-history recording's header, the catalog is a settings-declared
// llm-pi-ai profile (two Acme models), and zero model calls are issued — a
// stray stream fails loud on the scaffold's route-only seam.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { createMessage, createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden, fixtureUserPrompts,
  launchWebScaffold, parseSeedFixture, renderSeedFixture, seedSession, watchConsole,
  webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/model-identity', import.meta.url))
const UI_EXPECTED = join(SNAPSHOT_DIR, 'ui.expected.md')
// Borrowed read-only: only the recording's session header line (its
// {{sessionId}}/{{cwd}} tokens), so the cold seed realizes against this world
// exactly like every other borrowed-seed scenario.
const BORROWED_SEED = fileURLToPath(new URL('./snapshots/seeded-history/seed.jsonl', import.meta.url))
const MODE = webSnapshotMode()
const SEED_ID = 'model-identity-web-e2e'

const PROMPT_ONE = 'Reply with the single word ALPHA and stop.'
const PROMPT_TWO = 'Reply with the single word BETA and stop.'
const TURN_ONE_TEXT = 'ALPHA'
const TURN_TWO_TEXT = 'BETA'
/** Declared catalog names the labels must resolve (raw-id fallback fails the scenario). */
const THINK_LABEL = 'Acme Think · High'
const FLASH_LABEL = 'Acme Flash'

const THINK_HEADER = {
  config: {
    provider: 'acme-gateway',
    model: 'acme-think',
    reasoningEffort: ReasoningEffortId('high'),
  },
}
const FLASH_HEADER = {
  config: { provider: 'acme-gateway', model: 'acme-flash' },
}

const USAGE = { inputTokens: 12, outputTokens: 3, cacheReadTokens: 96 } as const

/**
 * Build the two-turn route-switch fixture: turn 1 dispatched on Acme Think
 * with a logged high effort; turn 2 opens with a reason-change header that
 * switches the route to Acme Flash. Both assistant messages report their own
 * serving source, so provenance and joined config agree per step — the
 * discrimination the clock lines assert.
 * @param headerLine - the borrowed recording's session header line.
 * @returns the seeded-history-layout fixture text.
 */
function routeSwitchFixture(headerLine: string): string {
  const session = Session.create(SessionId('model-identity-source'))
  session.append('turn/start', { turn: 1 })
  const first = session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: PROMPT_ONE }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('session/title', {
    title: 'Model route switch',
    messageSeqs: [first.seq],
    source: { kind: 'fallback' },
  })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('request/header', { header: THINK_HEADER, reason: 'initial' })
  session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'text', text: TURN_ONE_TEXT }],
      source: { kind: 'model', provider: 'acme-gateway', model: 'acme-think' },
    }),
    usage: USAGE,
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  session.append('turn/start', { turn: 2 })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: PROMPT_TWO }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('step/start', { turn: 2, step: 1 })
  session.append('request/header', { header: FLASH_HEADER, reason: 'change' })
  session.append('assistant/message', {
    turn: 2,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'text', text: TURN_TWO_TEXT }],
      source: { kind: 'model', provider: 'acme-gateway', model: 'acme-flash' },
    }),
    usage: USAGE,
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn: 2, step: 1 })
  session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
  return renderSeedFixture(headerLine, session.events)
}

describe.skipIf(MODE === 'record')('web e2e: model identity labels read the session log', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    // Same settings seam as declared-reasoning: the catalog is two declared
    // models on one gateway — Acme Think offers High, Acme Flash offers no
    // efforts — so display-name and effort resolution both come from the
    // settings profile, with zero adapter traffic.
    await scaffold.ctx.settings.update(settingsNamespace('llm-pi-ai'), {
      providers: {
        'acme-gateway': {
          displayName: 'Acme Gateway',
          api: 'openai-completions',
          baseURL: 'https://gateway.acme.example/v1',
          models: [
            {
              id: 'acme-think',
              name: 'Acme Think',
              reasoningEfforts: { high: 'high' },
            },
            {
              id: 'acme-flash',
              name: 'Acme Flash',
            },
          ],
        },
      },
    })
    const borrowed = parseSeedFixture(await readFile(BORROWED_SEED, 'utf8'))
    const raw = routeSwitchFixture(borrowed.headerLine)
    expect(fixtureUserPrompts(raw), 'route-switch seed must carry both prompts')
      .toEqual([PROMPT_ONE, PROMPT_TWO])
    await seedSession(scaffold, raw, SEED_ID, 'standard')
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('names the last dispatched route in the header and each step under its clock', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-model-identity'))
    // The sidebar leads with the ungrouped "Chat" section before the seeded
    // session's workspace group, so navigate by identity, not position: open
    // the workspace row (collapsed), then the session row by its title.
    const workspaceRow = page.getByRole('treeitem', {
      name: scaffold.workspaceCwd.split('/').pop()!,
    })
    await workspaceRow.waitFor({ timeout: 15_000 })
    await workspaceRow.click()
    const sessionRow = page.getByRole('treeitem', { name: 'Model route switch' })
    await sessionRow.waitFor({ timeout: 10_000 })
    await sessionRow.click()
    await expect.poll(() => page.getByText(TURN_TWO_TEXT, { exact: true }).count(), { timeout: 15_000 }).toBe(1)

    // (a) The header chip names the LAST dispatched route — turn 2's switch
    // to Acme Flash — beside the preset label, and never a staged default
    // (the route-only seam's DeepSeek catalog stays out of the header).
    const banner = page.getByRole('banner')
    await expect
      .poll(() => banner.getByText(FLASH_LABEL, { exact: true }).count(), { timeout: 10_000 })
      .toBe(1)
    expect(await banner.getByText('Standard mode', { exact: true }).count()).toBe(1)
    expect(await banner.getByText('DeepSeek-V4-Flash').count()).toBe(0)
    expect(
      await banner.locator('[title="Last dispatched request: acme-gateway / acme-flash"]').count(),
    ).toBe(1)
    // The composer trigger honestly reports the resumed session's current
    // selection (the host derives it from the log too), so the split the chip
    // must prove is the SPEC's "selector changed but not sent": stage a
    // different model through the menu — a settings selection, zero dispatch —
    // and the chip must keep naming the last dispatched route.
    const trigger = page.getByRole('button', { name: /^Select model/ })
    await trigger.click()
    // The menu opens pane-first: enter the model pane, then pick the radio.
    await page.getByRole('menuitem', { name: /^Model / }).click()
    await page.getByRole('menuitemradio', { name: 'Acme Think', exact: true }).click()
    await expect
      .poll(async () => trigger.getAttribute('aria-label'), { timeout: 10_000 })
      .toContain('Acme Think')
    expect(await trigger.getAttribute('aria-label')).not.toContain('Acme Flash')
    expect(
      await banner.locator('[title="Last dispatched request: acme-gateway / acme-flash"]').count(),
    ).toBe(1)

    // (b) Each assistant row's clock line names THAT step's route: the
    // turn-1 effort segment rides only its own header's logged effort.
    const routeLines = page.locator('[data-chat-flow-kind="assistant-step"] [class*="route"]')
    await expect.poll(() => routeLines.allTextContents(), { timeout: 10_000 })
      .toEqual([THINK_LABEL, FLASH_LABEL])
    expect(
      await routeLines.locator('[title="Step request route: acme-gateway / acme-think"]').count(),
    ).toBe(1)
    expect(
      await routeLines.locator('[title="Step request route: acme-gateway / acme-flash"]').count(),
    ).toBe(1)
  }, 60_000)

  it('matches the conversation aria golden with both identity surfaces', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-model-identity-aria'))
    await page.getByRole('button', { name: /^Select model, current/ }).waitFor({ timeout: 10_000 })
    await page.getByText(/Cache hit \d+%/u).first().waitFor({ timeout: 10_000 })
    // Keep a footer focused so opacity-hidden actions stay in the a11y tree
    // as an active/focused control during the capture.
    await page.getByRole('button', { name: 'Copy' }).first().focus()
    const snapshot = (await captureStableAria(page, '[class*="centerCol"]', scaffold.workspaceCwd))
      .split(SEED_ID).join('{{seededId}}')
    await compareOrRefreshGolden(UI_EXPECTED, snapshot, MODE)
  })

  it('renders no chip on a fresh blank session', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-model-identity-blank'))
    await page.getByRole('button', { name: 'New session' }).last().click()
    await page.getByText('Into the Unknown', { exact: true }).waitFor({ timeout: 15_000 })
    // The fresh session dispatched nothing, so no identity exists to claim:
    // the header carries no model text at all — neither the previous turn's
    // Acme route nor a raw-id fallback for the staged selection.
    const banner = page.getByRole('banner')
    await expect.poll(() => banner.getByText(/Acme|DeepSeek/).count(), { timeout: 10_000 }).toBe(0)
  }, 60_000)

  it('issued zero model calls and kept a closed inventory', async () => {
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['ui.expected.md'])
  })
})
