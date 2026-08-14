import { describe, expect, it } from 'vitest'
import {
  TITLEBAR_HEIGHT_PX,
  TITLEBAR_ID,
  loadingPage,
  titlebarInjectScript,
  titlebarMarkup,
  titlebarStyles,
} from '../src/titlebar.ts'

describe('titlebar chrome', () => {
  it('reserves a drag region and three window buttons', () => {
    const markup = titlebarMarkup()
    expect(markup).toContain(`id="${TITLEBAR_ID}"`)
    expect(markup).toContain('data-dsh-desktop-drag="true"')
    expect(markup.match(/data-dsh-desktop-action="/gu)).toHaveLength(3)
    expect(markup).toContain('data-dsh-desktop-action="minimize"')
    expect(markup).toContain('data-dsh-desktop-action="maximize"')
    expect(markup).toContain('data-dsh-desktop-action="close"')
    expect(titlebarStyles()).toContain('height: var(--dsh-desktop-titlebar)')
    expect(titlebarStyles()).toContain(`${String(TITLEBAR_HEIGHT_PX)}px`)
    expect(titlebarStyles()).toContain('-webkit-app-region: drag')
    expect(titlebarStyles()).toContain('-webkit-app-region: no-drag')
    expect(titlebarStyles()).toContain('padding-top: var(--dsh-desktop-titlebar)')
  })

  it('keeps the inject script from covering page content below the reserved strip', () => {
    const script = titlebarInjectScript()
    expect(script).toContain(TITLEBAR_ID)
    expect(script).toContain('data-dsh-desktop-drag')
    expect(script).toContain('querySelectorAll("[data-dsh-desktop-action]").length === 3')
    expect(script).toContain('padding-top')
    expect(loadingPage()).toContain('正在启动 DeepSeek Harness')
    expect(loadingPage()).toContain(titlebarMarkup())
  })
})
