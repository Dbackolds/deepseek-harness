import { describe, expect, it } from 'vitest'
import {
  PRODUCT_CHANNEL_CONFIGS, PRODUCT_CHANNELS, releaseTagPrefix, resolveProductChannel,
} from '../src/channel.ts'

describe('PRODUCT_CHANNELS', () => {
  it('lists the concrete channels and the auto config option', () => {
    expect(PRODUCT_CHANNELS).toEqual(['dsh', 'desktop'])
    expect(PRODUCT_CHANNEL_CONFIGS).toEqual(['auto', 'dsh', 'desktop'])
  })
})

describe('resolveProductChannel', () => {
  it('honors an explicit config and treats auto as desktop only when the env says so', () => {
    expect(resolveProductChannel('dsh', { DSH_PRODUCT_CHANNEL: 'desktop' })).toBe('dsh')
    expect(resolveProductChannel('desktop', {})).toBe('desktop')
    expect(resolveProductChannel('auto', { DSH_PRODUCT_CHANNEL: 'desktop' })).toBe('desktop')
    expect(resolveProductChannel('auto', { DSH_PRODUCT_CHANNEL: 'dsh' })).toBe('dsh')
    expect(resolveProductChannel('auto', {})).toBe('dsh')
  })
})

describe('releaseTagPrefix', () => {
  it('maps each channel to its GitHub tag prefix', () => {
    expect(releaseTagPrefix('desktop')).toBe('desktop-v')
    expect(releaseTagPrefix('dsh')).toBe('dsh-v')
  })
})
