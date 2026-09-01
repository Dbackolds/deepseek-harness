/** Browser half: Settings row, overlay toast, and RPC caller. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { isGithubHttpsUrl } from '../github-url.ts'
import { PRODUCT_UPDATE_RPC_CHANNEL } from '../rpc-channel.ts'
import {
  PRODUCT_UPDATE_SETTINGS_NAMESPACE,
  type ProductCheckResult,
  type ProductUpdateSettings,
} from '../update-settings.ts'
import { UpdateRow, type ProductUpdateUiStatus, type UpdateRowInjected } from './UpdateRow.tsx'
import { UpdateToast, type UpdateToastInjected } from './UpdateToast.tsx'
import { en, zh, type ProductUpdateLocaleKey } from './locales.ts'

export type { ProductUpdateLocaleKey } from './locales.ts'

export const NS = 'settings.productUpdate'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Product-update Settings row and overlay toast copy. */
    'settings.productUpdate': ProductUpdateLocaleKey
  }
}

/** Cordis plugin name. */
export const name = 'client-ui-update'
export const inject = ['slots', 'locale', 'settingsScope', 'connection']

/**
 * Register dictionaries, the General Settings row, and the overlay toast.
 * The row hydrates from the Host settings cache; Check now is the only
 * client-initiated poll.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'product-update: dictionaries')
  const status = createSnapshotStore<ProductUpdateUiStatus>({
    checking: false,
    error: false,
    result: undefined,
  })
  const scope = ctx.settingsScope.bind<ProductUpdateSettings>({
    namespace: PRODUCT_UPDATE_SETTINGS_NAMESPACE,
  })
  const adopt = (): void => {
    const lastResult = scope.getSnapshot().value?.lastResult
    if (lastResult !== undefined) {
      status.update((draft) => {
        draft.result = lastResult
        draft.error = false
      })
    }
  }
  adopt()
  ctx.effect(() => scope.subscribe(adopt), 'product-update: settings')

  const rpc = (ctx.get('connection') as ConnectionHandle).rpc

  const checkNow = (): void => {
    status.update((draft) => {
      draft.checking = true
      draft.error = false
    })
    void rpc.call(PRODUCT_UPDATE_RPC_CHANNEL, 'check', { force: true }).then((payload) => {
      if (!payload.ok) {
        status.update((draft) => {
          draft.checking = false
          draft.error = true
        })
        return
      }
      status.update((draft) => {
        draft.checking = false
        draft.error = false
        draft.result = payload.value as ProductCheckResult
      })
    }, () => {
      status.update((draft) => {
        draft.checking = false
        draft.error = true
      })
    })
  }

  const dismiss = (): void => {
    const tag = status.getSnapshot().result?.latest?.tag
    if (tag === undefined) return
    void rpc.call(PRODUCT_UPDATE_RPC_CHANNEL, 'dismiss', { tag }).then((payload) => {
      if (!payload.ok) return
      status.update((draft) => {
        if (draft.result !== undefined) draft.result.available = false
      })
    })
  }

  const openRelease = (): void => {
    const url = status.getSnapshot().result?.latest?.url
    if (url === undefined || !isGithubHttpsUrl(url)) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const rowInjected = (): UpdateRowInjected => ({
    hooks: { status },
    checkNow,
    dismiss,
    openRelease,
  })
  const toastInjected = (): UpdateToastInjected => ({
    hooks: { status },
    dismiss,
    openRelease,
  })

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'product-update',
    order: 25,
    locale: NS,
    inject: rowInjected,
  }, UpdateRow))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'product-update',
    locale: NS,
    inject: toastInjected,
  }, UpdateToast))
}
