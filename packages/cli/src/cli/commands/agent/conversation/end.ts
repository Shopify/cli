import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'
import {endAgentConversation} from '@shopify/cli-kit/node/agent'

export default class AgentConversationEnd extends Command {
  static summary = 'End a Shopify agent conversation context.'

  static descriptionWithMarkdown = `Removes a Shopify agent conversation context file resolved from \
\`SHOPIFY_CLI_AGENT_CONTEXT\` or an explicit path.`

  static description = this.descriptionWithoutMarkdown()

  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --json']

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    context: Flags.string({
      description: 'Path to a Shopify agent conversation context file.',
      env: 'SHOPIFY_CLI_AGENT_CONTEXT',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AgentConversationEnd)
    const conversation = await endAgentConversation({contextPath: flags.context})
    const result = {...conversation, ended: true}

    if (flags.json) {
      return outputResult(JSON.stringify(result, null, 2))
    }

    return outputResult(
      [
        `Ended Shopify agent conversation ${conversation.conversationId}.`,
        `Removed context path: ${conversation.contextPath}`,
      ].join('\n'),
    )
  }
}
