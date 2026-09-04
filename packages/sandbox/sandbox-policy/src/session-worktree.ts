/**
 * Per-session working-directory overlays: the session log as the store.
 * A Git branch pick is one `git/worktree` event; a project rehome is one
 * `workspace/home` event. Tool cwd folds the later of those two by log
 * time, otherwise `SessionHeader.cwd`. Birth cwd stays the persistence
 * identity; workspace membership follows last `workspace/home`, else header cwd.
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
    /**
     * The session's workspace home was switched — log-only. The last
     * `workspace/home` or `git/worktree` by log time is the effective
     * working directory ({@link sessionWorkingDirectory}). Birth
     * `SessionHeader.cwd` is unchanged.
     */
    'workspace/home': {
      /** Absolute directory this session should operate in. */
      path: string
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
 * THE write path for a session's workspace home: appends exactly one
 * `workspace/home` event. The switch IS its event. Takes effect on the
 * session's next cwd-sensitive call because consumers fold on every read.
 * @param session - the session the home belongs to.
 * @param path - absolute directory this session should operate in.
 */
export function setSessionHome(session: Session, path: string): void {
  session.append('workspace/home', { path })
}

/**
 * Last project-home or git-worktree overlay by log time.
 * @param events - session events in log order.
 * @returns the last overlay path, or undefined without one.
 */
export function effectiveHome(events: readonly SessionEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index] as SessionEvent
    if (event.type === 'workspace/home' || event.type === 'git/worktree') return event.data.path
  }
  return undefined
}

/**
 * Working directory a session should use for tools and `{{cwd}}`: the last
 * `workspace/home` or `git/worktree` by log time, otherwise the immutable
 * header cwd.
 * @param session - session whose log and header supply the path.
 * @returns the overlay path, the header cwd, or undefined when neither exists.
 */
export function sessionWorkingDirectory(session: {
  header: { cwd?: string }
  snapshotEvents?: () => readonly SessionEvent[]
  events?: readonly SessionEvent[]
}): string | undefined {
  const events = session.snapshotEvents?.() ?? session.events ?? []
  return effectiveHome(events) ?? session.header.cwd
}
