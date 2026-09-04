/**
 * Shell chrome content registered into the shell's trigger/header seats: the
 * trigger row (account chip + settings glyph) and the panel title text.
 * The shell renders the surrounding chrome (button, nav heading row) and
 * reads each entry's `label` option for aria text. The settings button's
 * accessible name stays the localized Settings label; the account name is
 * visual only, and the account button uses its own accessible name.
 */
import { IconSettingsOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { accountInitial, accountNameFromHome } from './account-label.ts'
import type { SettingsTriggerInjected } from './shell-contract.ts'
import css from './chrome.module.css'

/** Trigger content props: sidebar column state, Host home, and locale. */
export type TriggerContentProps =
  PropsRuntime<'settings.trigger'>
  & InjectFace<SettingsTriggerInjected>
  & PropsLocale<'settings'>

/** Header content props: the standard locale seat only. */
export type HeaderContentProps = PropsRuntime<'settings.header'> & PropsLocale<'settings'>

/**
 * Render the trigger row: a circular initial chip, the Host account name in
 * the wide column, and a trailing settings glyph. `part` selects the
 * account chip, the settings glyph, or the full row. The localized Settings
 * string stays in the tree except on the account part, and is visually
 * hidden so the shell button's accessible name does not become the account
 * name.
 * @param props - composed slot props.
 * @returns the trigger content fragment.
 */
export function TriggerContent({ wide, part, useConnectionGeneration, t }: TriggerContentProps) {
  const home = useConnectionGeneration(generation => generation?.host.home)
  const account = accountNameFromHome(home) ?? t('account.fallback')
  const initial = accountInitial(account)
  const showAccount = part !== 'settings'
  const showName = wide && part !== 'settings'
  const showGlyph = wide && part !== 'account'
  const showSettingsName = part !== 'account'
  return (
    <>
      {showAccount && <span className={css.avatar} aria-hidden="true">{initial}</span>}
      {showName && <span className={css.accountName} aria-hidden="true">{account}</span>}
      {showGlyph && (
        <span className={css.settingsGlyph} aria-hidden="true">
          <IconSettingsOutline16 size={16} />
        </span>
      )}
      {showSettingsName && <span className={css.hiddenLabel}>{t('trigger')}</span>}
    </>
  )
}

/**
 * Render the panel title text.
 * @param props - composed slot props.
 * @returns the title text node.
 */
export function HeaderContent({ t }: HeaderContentProps) {
  return <>{t('title')}</>
}

/** Close-button label text props: the standard locale seat only. */
export type CloseLabelProps = PropsRuntime<'settings.close'> & PropsLocale<'settings'>

/**
 * Render the close button's visually-hidden label text.
 * @param props - composed slot props.
 * @returns the label text node.
 */
export function CloseLabel({ t }: CloseLabelProps) {
  return <>{t('close')}</>
}
