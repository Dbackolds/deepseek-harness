/** Configuration and stable diagnostics for trusted session control. */

/** Default number of directory rows returned by one search. */
export const DEFAULT_SEARCH_LIMIT = 50

/** Trusted session-control service configuration. */
export interface Config {
  /** Default search result cap. */
  searchLimit?: number
}

/** Stable failure codes exposed to in-process callers. */
export type SessionControlErrorCode =
  | 'SESSION_CONTROL_INVALID_CONFIG'
  | 'SESSION_CONTROL_INVALID_REQUEST'
  | 'SESSION_CONTROL_SESSION_NOT_FOUND'
  | 'SESSION_CONTROL_NOT_ATTACHED'
  | 'SESSION_CONTROL_RESUME_REQUIRED'
  | 'SESSION_CONTROL_DELIVERY_FAILED'
  | 'SESSION_CONTROL_CANCELLED'

/** Typed session-control failure suitable for host protocol error mapping. */
export class SessionControlError extends Error {
  /**
   * @param message Human-readable diagnosis.
   * @param code Stable routing code.
   * @param options Optional cause.
   */
  constructor(
    message: string,
    readonly code: SessionControlErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'SessionControlError'
  }
}
