/**
 * Subagent settings section: the user definition library.
 */

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  Button,
  IconEditOutline16,
  IconPlusOutline16,
  IconTrashOutline16,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SubagentsState } from './store.ts'
import css from './SubagentsSection.module.css'

/** Registration-side business face for the section. */
export interface SubagentsSectionInjected {
  hooks: {
    /** Page snapshot bound by the renderer as useSubagents. */
    subagents: SnapshotStore<SubagentsState>
  }
  /** Read the library. */
  load: () => Promise<void>
  /** Open a create draft. */
  beginCreate: () => void
  /** Open an edit draft. */
  beginEdit: (id: string) => void
  /** Close the draft dialog. */
  cancelDraft: () => void
  /** Update the draft name. */
  setDraftName: (name: string) => void
  /** Update the draft description. */
  setDraftDescription: (description: string) => void
  /** Update the draft persona. */
  setDraftPersona: (persona: string) => void
  /** Update the draft allow list. */
  setDraftAllow: (allow: string) => void
  /** Update the draft deny list. */
  setDraftDeny: (deny: string) => void
  /** Persist the open draft. */
  saveDraft: () => Promise<void>
  /** Ask for delete confirmation, or dismiss it with null. */
  confirmDelete: (id: string | null) => void
  /** Delete the definition awaiting confirmation. */
  remove: () => Promise<void>
}

/** Full component props. */
export type SubagentsSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.subagents'>
  & InjectFace<SubagentsSectionInjected>

/**
 * Render the Subagents section content column.
 * @param props - composed slot props.
 * @returns the section.
 */
export function SubagentsSection(props: SubagentsSectionProps): ReactNode {
  const { useSubagents, t, load } = props
  const state = useSubagents(snapshot => snapshot)

  useEffect(() => {
    void load()
  }, [load])

  if (state.status === 'unavailable') {
    return (
      <div className={css.section}>
        <p className={css.empty}>{t('unavailable')}</p>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className={css.section}>
        <p className={css.error} role="alert">{t('error') + ' ' + String(state.error)}</p>
        <button type="button" className={css.secondaryButton} onClick={() => { void load() }}>
          {t('retry')}
        </button>
      </div>
    )
  }

  const draftError = state.draft?.error
  const draftMessage = draftError === 'nameRequired' || draftError === 'personaRequired'
    ? t(draftError)
    : draftError

  return (
    <div className={css.section}>
      <h2 className={css.title}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      {state.error === null ? null : <p className={css.error} role="alert">{state.error}</p>}
      {!state.writable && state.status === 'ready' ? <p className={css.empty}>{t('readOnly')}</p> : null}

      <section className={css.group}>
        <h3 className={css.groupHead}>{t('libraryGroup')}</h3>
        {state.definitions.length === 0
          ? <p className={css.empty}>{t('emptyLibrary')}</p>
          : (
            <ul className={css.cards}>
              {state.definitions.map(definition => (
                <li key={definition.id} className={css.card}>
                  <div className={css.cardHead}>
                    <span className={css.cardName}>{definition.name}</span>
                    <span className={css.cardMeta}>{definition.id}</span>
                  </div>
                  <p className={css.cardPreview}>
                    {definition.description.length === 0 ? t('emptySection') : definition.description}
                  </p>
                  <div className={css.cardFoot}>
                    <button
                      type="button"
                      className={css.iconButton}
                      disabled={!state.writable}
                      aria-label={t('edit') + ': ' + definition.name}
                      onClick={() => { props.beginEdit(definition.id) }}
                    >
                      <IconEditOutline16 />
                    </button>
                    <button
                      type="button"
                      className={css.iconButton + ' ' + css.iconDanger}
                      disabled={!state.writable}
                      aria-label={t('delete') + ': ' + definition.name}
                      onClick={() => { props.confirmDelete(definition.id) }}
                    >
                      <IconTrashOutline16 />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        <button
          type="button"
          className={css.creatorButton}
          disabled={!state.writable}
          onClick={() => { props.beginCreate() }}
        >
          <IconPlusOutline16 size={14} />
          {t('addDefinition')}
        </button>
      </section>

      <Modal
        open={state.draft !== null}
        onClose={() => { props.cancelDraft() }}
        title={state.draft?.id === null ? t('addDefinition') : t('edit')}
        closeLabel={t('close')}
        className={css.dialog as string}
        footer={(
          <>
            <Button
              variant="outline"
              disabled={state.draft?.saving === true}
              onClick={() => { props.cancelDraft() }}
            >
              {t('cancel')}
            </Button>
            <Button
              disabled={state.draft?.saving === true}
              onClick={() => { void props.saveDraft() }}
            >
              {state.draft?.saving === true ? t('saving') : t('save')}
            </Button>
          </>
        )}
      >
        {state.draft === null
          ? null
          : (
            <div className={css.dialogFields}>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('definitionName')}</span>
                <input
                  className={css.input}
                  value={state.draft.name}
                  placeholder={t('definitionNamePlaceholder')}
                  onChange={(event) => { props.setDraftName(event.target.value) }}
                />
              </label>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('definitionDescription')}</span>
                <input
                  className={css.input}
                  value={state.draft.description}
                  placeholder={t('definitionDescriptionPlaceholder')}
                  onChange={(event) => { props.setDraftDescription(event.target.value) }}
                />
              </label>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('persona')}</span>
                <textarea
                  className={css.textarea}
                  value={state.draft.persona}
                  spellCheck={false}
                  placeholder={t('personaPlaceholder')}
                  onChange={(event) => { props.setDraftPersona(event.target.value) }}
                />
              </label>
              <p className={css.empty}>{t('filterHint')}</p>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('allow')}</span>
                <input
                  className={css.input}
                  value={state.draft.allow}
                  placeholder={t('allowPlaceholder')}
                  onChange={(event) => { props.setDraftAllow(event.target.value) }}
                />
              </label>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('deny')}</span>
                <input
                  className={css.input}
                  value={state.draft.deny}
                  placeholder={t('denyPlaceholder')}
                  onChange={(event) => { props.setDraftDeny(event.target.value) }}
                />
              </label>
              {draftMessage === null || draftMessage === undefined
                ? null
                : <p className={css.error} role="alert">{draftMessage}</p>}
            </div>
          )}
      </Modal>

      <Modal
        open={state.pendingDelete !== null}
        onClose={() => { props.confirmDelete(null) }}
        title={t('deleteTitle')}
        closeLabel={t('close')}
        description={t('deleteDescription')}
        className={css.deleteDialog as string}
        footer={(
          <>
            <Button
              variant="outline"
              autoFocus
              disabled={state.deleting}
              onClick={() => { props.confirmDelete(null) }}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="outline"
              className={css.deleteConfirm}
              disabled={state.deleting}
              onClick={() => { void props.remove() }}
            >
              {state.deleting ? t('deleting') : t('deleteConfirm')}
            </Button>
          </>
        )}
      />
    </div>
  )
}
