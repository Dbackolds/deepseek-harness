/** Built-in starters overlay schedule fields and localized copy. */
import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from '../src/client/format.ts'
import { en } from '../src/client/locales.ts'
import { AUTOMATION_TEMPLATES, applyTemplate } from '../src/client/templates.ts'

const t = (key: keyof typeof en): string => en[key]

describe('automation templates', () => {
  it('keeps two complete starters', () => {
    expect(AUTOMATION_TEMPLATES.map(template => template.id)).toEqual(['morning-digest', 'risk-scan'])
  })

  it('writes localized name and task over an empty draft', () => {
    const morning = AUTOMATION_TEMPLATES[0]!
    const next = applyTemplate({ ...EMPTY_DRAFT, workspaceId: 'ws-1', clockZone: 'UTC' }, morning, t)
    expect(next).toMatchObject({
      name: 'Morning digest',
      task: 'Summarize commits, module changes, and follow-ups since the last working day.',
      workspaceId: 'ws-1',
      schedule: 'clock',
      clockTime: '09:00',
      clockZone: 'UTC',
      weekdays: [1, 2, 3, 4, 5],
    })
  })

  it('keeps existing weekdays when the starter does not name them', () => {
    const risk = AUTOMATION_TEMPLATES[1]!
    const next = applyTemplate({ ...EMPTY_DRAFT, weekdays: [7], clockZone: 'UTC' }, risk, t)
    expect(next.weekdays).toEqual([7])
    expect(next.clockTime).toBe('02:00')
    expect(next.name).toBe('Risk scan')
  })
})
