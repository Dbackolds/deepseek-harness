/** `settings.hmr` namespace dictionaries (the plugin-reload settings row). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '插件热重载',
  'description': '关闭后，保存源码不会替换正在运行的插件。改完后再手动重载。',
  'autoReload': '自动热重载',
  'reload': '重载插件',
  'reloading': '正在重载…',
  'reloaded': '已重载 {count} 个插件',
  'reloadFailed': '重载失败',
} satisfies Record<string, string>

/** The settings.hmr namespace key union. */
export type HmrSettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'Plugin hot reload',
  'description': 'When off, saving source does not replace running plugins. Reload manually after you finish editing.',
  'autoReload': 'Automatic hot reload',
  'reload': 'Reload plugins',
  'reloading': 'Reloading…',
  'reloaded': 'Reloaded {count} plugins',
  'reloadFailed': 'Reload failed',
} satisfies Record<HmrSettingsKey, string>
