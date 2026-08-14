/**
 * Stable Automation error types.
 * @module @deepseek-ai/dsh-automation
 */
/** Error from a caller-supplied Automation request that cannot become a record. */
export type AutomationErrorCode =
  | 'invalid_task'
  | 'invalid_name'
  | 'invalid_selector'
  | 'invalid_time_zone'
  | 'not_future'
  | 'time_out_of_range'
  | 'frequency_too_high'
  | 'workspace_not_found'
  | 'agent_preset_not_found'
  | 'permission_preset_not_found'
  | 'rule_not_found'
  | 'persistence_uncertain'
  | 'internal_error'

export class AutomationInputError extends Error {
  readonly code: AutomationErrorCode
  constructor(code: AutomationErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AutomationInputError'
    this.code = code
  }
}
/** Error from a durable Automation medium that cannot be trusted. */
export class AutomationPersistenceError extends Error {
  /** Stable machine-readable error code. */
  code = 'persistence_uncertain'
  /**
     * Construct a persistence-barrier failure.
     * @param message - Package-specific violated invariant.
     * @param options - Optional contained implementation cause.
     */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AutomationPersistenceError'
  }
}
