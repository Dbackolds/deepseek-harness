// Web e2e: the sidebar Automation entry under New Session lists Host rules
// and creates one `after` rule through the real Host RPC. Zero model calls.
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import type {} from '@deepseek-ai/dsh-automation'
import { launchWebScaffold, watchConsole, type WebScaffold } from './scaffold.ts'
import { connectFreshWorkspaceZh, saveFailureShot, ZH_BROWSER_LOCALE } from './support.ts'

describe('web e2e: sidebar Automation under New Session', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    await connectFreshWorkspaceZh(page, scaffold.workspaceCwd)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('opens the panel under 新会话 and creates an after rule', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-automation-sidebar'))
    const trigger = page.getByRole('button', { name: '自动化', exact: true })
    await trigger.waitFor({ timeout: 10_000 })
    await trigger.click()
    const pageView = page.getByRole('region', { name: '自动化' })
    await pageView.waitFor({ timeout: 10_000 })
    await pageView.getByRole('button', { name: '新建规则' }).click()
    await pageView.getByPlaceholder('新会话要执行的任务').fill('ping from automation e2e')
    await pageView.getByLabel('延迟秒数').fill('3600')
    await pageView.getByRole('button', { name: '创建' }).click()
    await expect.poll(() => scaffold.ctx.automation.list().length, { timeout: 10_000 }).toBe(1)
    const created = scaffold.ctx.automation.list()[0]!
    expect(created.task).toBe('ping from automation e2e')
    expect(created.selector).toEqual({ kind: 'after', afterSeconds: 3600 })
    await expect.poll(() => pageView.getByText('ping from automation e2e').count(), { timeout: 10_000 }).toBe(1)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  })
})
