/**
 * Git branch chip, browser half — one chip on the new-session screen that
 * lists the workspace repository and switches this session overlay.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { GitBranchSeat } from './GitBranchSeat.tsx'
import type { GitBranchSeatInjected } from './GitBranchSeat.tsx'
import { GitBranchSeatController } from './seat-store.ts'
import { en, NS, zh, type GitBranchKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Git branch chip copy. */
    'gitBranch': GitBranchKey
  }
}

export type { GitBranchSeatInjected, GitBranchSeatProps } from './GitBranchSeat.tsx'
export type { GitBranchSeatState } from './seat-store.ts'

/** Required services for locale registration and hero-slot contribution. */
export const inject = ['slots', 'locale', 'connection', 'sessions', 'workspaces']

/**
 * Client plugin body: register the dictionaries and the hero chip.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-git-branch: dictionaries')
  ctx.inject(['slots', 'conversation', 'sessions', 'workspaces'], (scope: ClientContext) => {
    const api = (scope.get('connection') as ConnectionHandle).api
    const currentWorkspaceId = (): string | undefined => {
      const sessionId = scope.sessions.list.getSnapshot().current
      const workspaces = scope.workspaces.list.getSnapshot()
      if (sessionId !== undefined) {
        const owning = workspaces.items.find(item => item.sessionIds.includes(sessionId))
        if (owning !== undefined) return owning.workspaceId
      }
      return workspaces.recentWorkspaceId ?? workspaces.items[0]?.workspaceId
    }
    const seat = new GitBranchSeatController(
      api,
      () => scope.sessions.list.getSnapshot().current,
      currentWorkspaceId,
    )
    const seatInjected = (): GitBranchSeatInjected => ({
      hooks: { gitBranchSeat: seat.store },
      load: () => seat.load(),
      checkout: (branch: string) => seat.checkout(branch),
      createBranch: (branch: string) => seat.createBranch(branch),
    })
    scope.effect(() => {
      const stopSessions = scope.sessions.list.subscribe(() => { void seat.load() })
      const stopWorkspaces = scope.workspaces.list.subscribe(() => { void seat.load() })
      const chip = scope.slots.inject(
        'conversation.hero.branch',
        () => scope.slots.register({
          name: 'conversation.hero.branch',
          locale: NS,
          inject: seatInjected,
        }, GitBranchSeat),
      )
      return () => {
        stopSessions()
        stopWorkspaces()
        chip()
      }
    }, 'ui-git-branch: hero chip')
  })
}
