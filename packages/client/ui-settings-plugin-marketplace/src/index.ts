/**
 * Plugin marketplace Host half. The browser half lives under `./client`.
 * Discover reads the shipped in-box catalog by default.
 * @module @deepseek-ai/dsh-client-ui-settings-plugin-marketplace
 */

export {
  apply,
  name,
  inject,
  DEFAULT_CATALOG_URL,
  MARKETPLACE_BUNDLE_PACKAGE,
  MARKETPLACE_CLIENT_ENTRY_ID,
  MARKETPLACE_HOST_ENTRY_ID,
  MARKETPLACE_SETTINGS_NAMESPACE,
  type Config,
} from './host/index.ts'
