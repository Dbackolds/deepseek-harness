/**
 * Product version the update checker compares against GitHub tags.
 *
 * Resolution is env-first so a packaged desktop can stamp Electron's
 * `app.getVersion()` without the Host process importing Electron.
 */

import { createRequire } from 'node:module'

/** Node `require` rooted at this module; tests inject a fake. */
export type ProductVersionRequire = (id: string) => unknown

/**
 * Read the product version compared against GitHub release tags.
 *
 * Resolution: `DSH_PRODUCT_VERSION` wins, then the published CLI
 * `@deepseek-ai/dsh` package, then this package's own `package.json`
 * (a checkout that has not installed the published CLI).
 *
 * @param env - process environment.
 * @param requireFn - Node `require` rooted at this module, overridable in tests.
 * @returns a non-empty version string, or `'0.0.0'` when none of the sources exist.
 */
export function readProductVersion(
  env: NodeJS.ProcessEnv = process.env,
  requireFn: ProductVersionRequire = createRequire(import.meta.url),
): string {
  const override = env.DSH_PRODUCT_VERSION
  if (typeof override === 'string' && override !== '') return override

  const fromManifest = (id: string): string | undefined => {
    try {
      const manifest = requireFn(id) as { version?: unknown }
      return typeof manifest.version === 'string' && manifest.version !== ''
        ? manifest.version
        : undefined
    } catch {
      // The published CLI is absent from a source checkout; this package
      // still has a local package.json.
      return undefined
    }
  }

  return fromManifest('@deepseek-ai/dsh/package.json')
    ?? fromManifest('../package.json')
    ?? '0.0.0'
}
