import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'
import {inspectAgentConversation} from '@shopify/cli-kit/node/agent'

export default class AgentConversationInspect extends Command {
  static summary = 'Inspect the active Shopify agent conversation context.'

  static descriptionWithMarkdown = `Reads the current Shopify agent conversation context from \
\`SHOPIFY_CLI_AGENT_CONTEXT\` or an explicit path.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --context /tmp/shopify-agent-conversation.json --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    context: Flags.string({
      description: 'Path to a Shopify agent conversation context file.',
      env: 'SHOPIFY_CLI_AGENT_CONTEXT',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AgentConversationInspect)
    const conversation = await inspectAgentConversation({contextPath: flags.context})

    if (flags.json) {
      return outputResult(JSON.stringify(conversation, null, 2))
    }

    return outputResult(
      [
        `Shopify agent conversation ${conversation.conversationId}`,
        `Context path: ${conversation.contextPath}`,
        ...(conversation.agent ? [`Agent: ${conversation.agent}`] : []),
        ...(conversation.provider ? [`Provider: ${conversation.provider}`] : []),
        ...(conversation.harness ? [`Harness: ${conversation.harness}`] : []),
        ...(conversation.model ? [`Model: ${conversation.model}`] : []),
        ...(conversation.agentVersion ? [`Agent version: ${conversation.agentVersion}`] : []),
      ].join('\n'),
    )
  }
}
