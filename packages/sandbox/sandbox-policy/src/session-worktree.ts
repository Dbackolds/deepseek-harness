/**
 * Per-session Git worktree overlay: the session log as the store. A branch
 * pick is recorded as one `git/worktree` event on the session it applies to.
 * The last event is the overlay; without one, tools keep using
 * `SessionHeader.cwd`. The header stays the Workspace membership key.
 *
 * @module dsh-sandbox-policy/session-worktree
 */

import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * The session's Git worktree overlay was switched — log-only (like
     * `sandbox/mode`; NOT a surface event). The LAST such event is the
     * session's overlay ({@link effectiveWorktree}). `source: 'delegation'`
     * marks an overlay seeded into a child; an absent source is a runtime
     * switch.
     */
    'git/worktree': {
      /** Absolute worktree directory this session should operate in. */
      path: string
      /** Branch name checked out in that worktree. */
      branch: string
      /** Marks an overlay seeded into a child at delegation. */
      source?: 'delegation'
    }
  }
}

/** One recorded worktree overlay. */
export interface SessionWorktree {
  /** Absolute worktree directory. */
  readonly path: string
  /** Branch name checked out in that worktree. */
  readonly branch: string
}

/**
 * The session's Git worktree overlay: the last `git/worktree` event in the
 * log, or undefined when the session never switched. The pure fold — resume
 * needs no catch-up machinery because replaying the log IS the state.
 * @param events - session events in log order (other event types are skipped).
 * @returns the last overlay, or undefined without one.
 */
export function effectiveWorktree(events: readonly SessionEvent[]): SessionWorktree | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index] as SessionEvent
    if (event.type === 'git/worktree') {
      return { path: event.data.path, branch: event.data.branch }
    }
  }
  return undefined
}

/**
 * THE write path for a session's Git worktree overlay: appends exactly one
 * `git/worktree` event — the switch IS its event; nothing mutates overlay
 * state out of band. Takes effect on the session's next cwd-sensitive call
 * because consumers fold on every read.
 * @param session - the session the overlay belongs to.
 * @param overlay - absolute worktree path and the branch checked out there.
 */
export function setSessionWorktree(session: Session, overlay: SessionWorktree): void {
  session.append('git/worktree', { path: overlay.path, branch: overlay.branch })
}

/**
 * Working directory a session should use for tools and `{{cwd}}`: the last
 * worktree overlay when one exists, otherwise the immutable header cwd.
 * @param session - session whose log and header supply the path.
 * @returns the overlay path, the header cwd, or undefined when neither exists.
 */
export function sessionWorkingDirectory(session: {
  header: { cwd?: string }
  events?: readonly SessionEvent[]
}): string | undefined {
  return effectiveWorktree(session.events ?? [])?.path ?? session.header.cwd
}
