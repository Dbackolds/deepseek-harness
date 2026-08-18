/** `settings.llm-policy` namespace dictionaries (the retry/timeout settings row). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '模型请求重试',
  'description': '提供方未单独配置时使用。无限重试会持续重试每次失败，直到成功或取消。',
  'retries': '重试次数',
  'retriesHint': '首次请求之后再试的次数。',
  'unlimited': '无限',
  'timeout': '超时时间（秒）',
  'timeoutHint': '单次读取无新数据时的最长等待。',
  'invalidRetries': '请输入 0 或更大的整数。',
  'invalidTimeout': '请输入大于 0 的秒数。',
} satisfies Record<string, string>

/** The settings.llm-policy namespace key union. */
export type LlmPolicySettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'Model request retries',
  'description': 'Used when a provider does not set its own values. Unlimited retries every failure until success or cancellation.',
  'retries': 'Retry count',
  'retriesHint': 'Additional attempts after the first request.',
  'unlimited': 'Unlimited',
  'timeout': 'Timeout (seconds)',
  'timeoutHint': 'Longest wait with no new data on one read.',
  'invalidRetries': 'Enter an integer of 0 or greater.',
  'invalidTimeout': 'Enter a number of seconds greater than 0.',
} satisfies Record<LlmPolicySettingsKey, string>
