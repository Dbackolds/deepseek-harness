/** `gitBranch` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'gitBranch'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'seat.hint': '当前会话使用的 Git 分支',
  'seat.unavailable': '当前工作区不是 Git 仓库',
  'menu.local': '本地分支',
  'menu.remote': '远程分支',
  'menu.create': '新建分支…',
  'create.title': '新建分支',
  'create.close': '关闭',
  'create.name': '分支名',
  'create.placeholder': 'feature/my-change',
  'create.confirm': '创建并切换',
  'create.cancel': '取消',
  'error.generic': '无法切换分支',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<GitBranchKey, string> = {
  'seat.hint': 'Git branch this session uses',
  'seat.unavailable': 'This workspace is not a Git repository',
  'menu.local': 'Local branches',
  'menu.remote': 'Remote branches',
  'menu.create': 'Create branch…',
  'create.title': 'Create branch',
  'create.close': 'Close',
  'create.name': 'Branch name',
  'create.placeholder': 'feature/my-change',
  'create.confirm': 'Create and switch',
  'create.cancel': 'Cancel',
  'error.generic': 'Could not switch branch',
}

/** Key domain of the `gitBranch` namespace (zh is the source of truth). */
export type GitBranchKey = keyof typeof zh
