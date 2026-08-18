/** `settings.llm-policy` namespace dictionaries (the retry/timeout settings rows). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'retries.title': '重试次数',
  'retries.description': '提供方未单独配置时，首次请求之后再试的次数。',
  'unlimited': '无限',
  'timeout.title': '请求超时',
  'timeout.description': '单次读取无新数据时的最长等待。',
  'timeout.unit': '秒',
  'invalidRetries': '请输入 0 或更大的整数。',
  'invalidTimeout': '请输入大于 0 的秒数。',
} satisfies Record<string, string>

/** The settings.llm-policy namespace key union. */
export type LlmPolicySettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'retries.title': 'Retry count',
  'retries.description': 'Additional attempts after the first request when a provider has no own policy.',
  'unlimited': 'Unlimited',
  'timeout.title': 'Request timeout',
  'timeout.description': 'Longest wait with no new data on one read.',
  'timeout.unit': 'sec',
  'invalidRetries': 'Enter an integer of 0 or greater.',
  'invalidTimeout': 'Enter a number of seconds greater than 0.',
} satisfies Record<LlmPolicySettingsKey, string>
