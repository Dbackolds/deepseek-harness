/** `settings.session-history-gate` namespace dictionaries (the gate Settings row). */

/** Locale namespace owning this feature's row copy. */
export const NS = 'settings.session-history-gate'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '会话历史工具',
  'description': '允许 agent 检索历史会话（agent_session_search 等）。默认关闭；任务确实需要回顾历史对话时再打开。',
} satisfies Record<string, string>

/** The settings.session-history-gate namespace key union. */
export type SessionHistoryGateKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'Session history tools',
  'description':
    'Let the agent search and read past sessions (agent_session_search etc.). '
    + 'Off by default; turn on when a task needs prior-conversation recall.',
} satisfies Record<SessionHistoryGateKey, string>
