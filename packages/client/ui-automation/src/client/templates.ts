/**
 * Built-in Automation create-form starters. They prefill a draft; they do
 * not persist a rule until the person submits the form.
 */

import type { AutomationDraft, ScheduleKind } from './format.ts'
import type { AutomationKey } from './locales.ts'

/** One built-in starter the page can apply to the create draft. */
export interface AutomationTemplate {
  /** Stable id used as the card key and locale-key suffix. */
  readonly id: string
  /** Locale key of the template title, also written into the draft name. */
  readonly titleKey: AutomationKey
  /** Locale key of the one-line description. */
  readonly descriptionKey: AutomationKey
  /** Locale key written into the draft task. */
  readonly taskKey: AutomationKey
  /** Draft fields the starter writes over the empty form. */
  readonly draft: Pick<AutomationDraft, 'schedule'> & Partial<
    Pick<AutomationDraft, 'afterSeconds' | 'everySeconds' | 'clockTime' | 'weekdays' | 'onOverlap'>
  >
}

const CLOCK: ScheduleKind = 'clock'

/** Built-in starters shown under the rule list. */
export const AUTOMATION_TEMPLATES: readonly AutomationTemplate[] = [
  {
    id: 'morning-digest',
    titleKey: 'template.morning.title',
    descriptionKey: 'template.morning.description',
    taskKey: 'template.morning.task',
    draft: {
      schedule: CLOCK,
      clockTime: '09:00',
      weekdays: [1, 2, 3, 4, 5],
    },
  },
  {
    id: 'risk-scan',
    titleKey: 'template.risk.title',
    descriptionKey: 'template.risk.description',
    taskKey: 'template.risk.task',
    draft: {
      schedule: CLOCK,
      clockTime: '02:00',
    },
  },
]

/**
 * Overlay one starter onto a draft, keeping workspace, zone, and overlap
 * unless the starter names them.
 * @param draft - current form fields.
 * @param template - starter to apply.
 * @returns the next draft.
 */
export function applyTemplate(
  draft: AutomationDraft,
  template: AutomationTemplate,
  t: (key: AutomationKey) => string,
): AutomationDraft {
  return {
    ...draft,
    ...template.draft,
    name: t(template.titleKey),
    task: t(template.taskKey),
    weekdays: template.draft.weekdays === undefined ? draft.weekdays : [...template.draft.weekdays],
  }
}
