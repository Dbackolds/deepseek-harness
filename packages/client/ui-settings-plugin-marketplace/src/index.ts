/**
 * Browser marketplace row. Shared identities live in `./ids.ts`; the Host
 * half that owns `/plugin-marketplace` and `/reload` lives under `./host`.
 * @module @deepseek-ai/dsh-client-ui-settings-plugin-marketplace
 */

export {
  MARKETPLACE_BUNDLE_PACKAGE,
  MARKETPLACE_CLIENT_ENTRY_ID,
  MARKETPLACE_HOST_ENTRY_ID,
  MARKETPLACE_SETTINGS_NAMESPACE,
} from './ids.ts'

/**
 * Empty Host body for the browser marketplace row.
 * RPC and slash commands live on the `plugin-marketplace` row.
 */
export function apply(): void {}
