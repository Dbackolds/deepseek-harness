import { describe, expect, it } from 'vitest'
import {
  MAC_TRAFFIC_LIGHT_WIDTH_PX,
  TITLEBAR_HEIGHT_PX,
  TITLEBAR_ID,
  WINDOWS_OVERLAY_WIDTH_PX,
  loadingPage,
  titlebarInjectScript,
  titlebarMarkup,
  titlebarStyles,
  titlebarVariantForPlatform,
} from '../src/titlebar.ts'

describe('titlebar chrome (windows variant)', () => {
  it('reserves a drag region beside the caption-button overlay', () => {
    const markup = titlebarMarkup('windows')
    expect(markup).toContain(`id="${TITLEBAR_ID}"`)
    expect(markup).toContain('data-dsh-desktop-variant="windows"')
    expect(markup).toContain('data-dsh-desktop-drag="true"')
    expect(markup).not.toContain('data-dsh-desktop-action')
    expect(markup).not.toContain('DeepSeek Harness')
    const styles = titlebarStyles('windows')
    expect(styles).toContain('height: var(--dsh-desktop-titlebar)')
    expect(styles).toContain(`${String(TITLEBAR_HEIGHT_PX)}px`)
    expect(styles).toContain('-webkit-app-region: drag')
    expect(styles).toContain(`padding: 0 ${String(WINDOWS_OVERLAY_WIDTH_PX)}px 0 12px`)
    expect(styles).toContain('body { padding-top: var(--dsh-desktop-titlebar); box-sizing: border-box; }')
    expect(styles).not.toContain('html, body { padding-top')
  })

  it('keeps the inject script from covering page content below the reserved strip', () => {
    const script = titlebarInjectScript('windows')
    expect(script).toContain(TITLEBAR_ID)
    expect(script).toContain('data-dsh-desktop-drag')
    expect(script).toContain('padding-top')
    expect(loadingPage('windows')).toContain('正在启动 DeepSeek Harness')
    expect(loadingPage('windows')).toContain(titlebarMarkup('windows'))
  })
})

describe('titlebar chrome (mac variant)', () => {
  it('reserves traffic-light space on the left of the drag region', () => {
    const markup = titlebarMarkup('mac')
    expect(markup).toContain(`id="${TITLEBAR_ID}"`)
    expect(markup).toContain('data-dsh-desktop-variant="mac"')
    expect(markup).toContain('data-dsh-desktop-drag="true"')
    expect(markup).not.toContain('data-dsh-desktop-action')
    expect(markup).not.toContain('DeepSeek Harness')
    const styles = titlebarStyles('mac')
    expect(styles).toContain(`padding: 0 12px 0 ${String(MAC_TRAFFIC_LIGHT_WIDTH_PX)}px`)
    expect(styles).toContain('-webkit-app-region: drag')
    expect(styles).toContain('padding-top: var(--dsh-desktop-titlebar)')
    expect(styles).not.toContain('html, body { padding-top')
  })

  it('injects and loads with the mac padding', () => {
    const script = titlebarInjectScript('mac')
    expect(script).toContain(TITLEBAR_ID)
    expect(script).toContain('data-dsh-desktop-drag')
    expect(loadingPage('mac')).toContain('正在启动 DeepSeek Harness')
    expect(loadingPage('mac')).toContain(titlebarMarkup('mac'))
  })

  it('maps platforms to variants', () => {
    expect(titlebarVariantForPlatform('darwin')).toBe('mac')
    expect(titlebarVariantForPlatform('win32')).toBe('windows')
    expect(titlebarVariantForPlatform('linux')).toBe('windows')
  })
})
