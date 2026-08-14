/**
 * Parse the web Host readiness line printed by `@deepseek-ai/dsh-web-app`.
 * @module @deepseek-ai/dsh-desktop/ready
 */

/** Canonical loopback URL the desktop window may load. */
export interface ReadyUrl {
  /** Full loopback origin, for example `http://127.0.0.1:3080`. */
  href: string
  /** Listening port from the readiness line. */
  port: number
}

const READY_LINE = /^dsh web: (http:\/\/127\.0\.0\.1:(\d+))(?:\s|$)/u

/**
 * Extract the loopback URL from one Host log line.
 * @param line - one stdout or stderr line, with or without a trailing newline.
 * @returns the parsed URL, or `undefined` when the line is not the readiness signal.
 */
export function parseReadyLine(line: string): ReadyUrl | undefined {
  const match = READY_LINE.exec(line.trimEnd())
  const href = match?.[1]
  const port = match?.[2]
  if (href === undefined || port === undefined) return undefined
  return { href, port: Number(port) }
}

/**
 * Scan a chunk that may contain several lines and return the first readiness URL.
 * @param chunk - raw stdout or stderr bytes decoded as UTF-8.
 * @returns the first parsed URL, or `undefined` when the chunk has none.
 */
export function parseReadyChunk(chunk: string): ReadyUrl | undefined {
  for (const line of chunk.split(/\r?\n/u)) {
    const ready = parseReadyLine(line)
    if (ready !== undefined) return ready
  }
  return undefined
}
