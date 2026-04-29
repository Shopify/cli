import {getSelfReviewRequirementsMarkdown} from '../../../services/agent/self-review-requirements.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

export default class AgentGetSelfReviewRequirements extends Command {
  static hidden = true

  static description = 'Agent-only. Not for human use.'

  static flags = {
    ...globalFlags,
  }

  public async run(): Promise<void> {
    const markdown = await getSelfReviewRequirementsMarkdown({cliVersion: CLI_KIT_VERSION})
    outputResult(markdown)
  }
}
