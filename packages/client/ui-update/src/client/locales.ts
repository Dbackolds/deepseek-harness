/** `settings.productUpdate` namespace dictionaries (the Settings row and overlay toast). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  title: '产品更新',
  description: '向 GitHub Releases 查询是否有更新的 dsh 或桌面端版本。查询不会下载或安装任何内容。',
  currentVersion: '当前版本：{version}',
  lastChecked: '上次检查：{time}',
  neverChecked: '尚未检查',
  checkNow: '立即检查',
  checking: '正在检查…',
  upToDate: '已是最新版本。',
  available: '有可用更新：{version}',
  dismissed: '已忽略此版本。',
  openRelease: '打开发行说明',
  dismiss: '忽略',
  checkFailed: '无法检查更新。',
  toastTitle: '有可用更新',
  toastBody: '版本 {version} 可用。',
  toastOpen: '发行说明',
  toastDismiss: '忽略',
} satisfies Record<string, string>

/** The settings.productUpdate namespace key union. */
export type ProductUpdateLocaleKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  title: 'Product updates',
  description: 'Checks GitHub Releases for a newer dsh or desktop build. Checking does not download or install anything.',
  currentVersion: 'Installed version: {version}',
  lastChecked: 'Last checked: {time}',
  neverChecked: 'Not checked yet',
  checkNow: 'Check now',
  checking: 'Checking…',
  upToDate: 'You are on the latest release.',
  available: 'Update available: {version}',
  dismissed: 'This release was dismissed.',
  openRelease: 'Open release notes',
  dismiss: 'Dismiss',
  checkFailed: 'Could not check for updates.',
  toastTitle: 'Update available',
  toastBody: 'Version {version} is available.',
  toastOpen: 'Release notes',
  toastDismiss: 'Dismiss',
} satisfies Record<ProductUpdateLocaleKey, string>
