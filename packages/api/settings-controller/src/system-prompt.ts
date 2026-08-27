/** Host Remote owner for the deployment-wide system-prompt registry listing. */

import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteFailure, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

import type { SystemPromptListValue } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    systemPromptCatalog: SystemPromptCatalog
  }
}

/** Host service backing ctx.remote.systemPrompt. */
export class SystemPromptCatalog extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'systemPromptCatalog', { namespace: 'systemPrompt' })
  }

  @Remote('list')
  list(): SystemPromptListValue {
    const systemPrompt = this.ctx.get('systemPrompt')
    if (systemPrompt === undefined) {
      throw new TypertRemoteFailure({
        code: 'internal',
        message: 'system-prompt registry is absent: this composition does not mount @deepseek-ai/dsh-system-prompt',
        details: {},
      })
    }
    return { sections: systemPrompt.listSections() }
  }
}

export default SystemPromptCatalog
