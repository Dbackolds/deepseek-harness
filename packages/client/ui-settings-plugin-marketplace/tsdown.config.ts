import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace',
  ['lib/types/index.js', 'lib/types/invariant.js'],
  {
    companions: [{
      name: '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/reboot-watchdog',
      entry: { 'reboot-watchdog': 'lib/types/host/reboot-watchdog.js' },
      outDir: 'lib',
      format: ['esm'],
      platform: 'node',
      target: 'es2024',
      fixedExtension: false,
      dts: false,
      clean: false,
    }],
  },
)
