import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'
import {startAgentConversation} from '@shopify/cli-kit/node/agent'

export default class AgentConversationStart extends Command {
  static summary = 'Start a Shopify agent conversation context for later CLI commands.'

  static descriptionWithMarkdown = `Starts a conversation-scoped Shopify agent context and writes it to a temporary context file.

Pass \
\`--conversation-id\` when your host already has a broader conversation identifier, or omit it and let Shopify CLI generate one.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --agent pi --provider shopify --model gpt-5 --json',
    '<%= config.bin %> <%= command.id %> --conversation-id conv_123 --agent claude-code --provider anthropic',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    'conversation-id': Flags.string({
      description: 'Conversation identifier to reuse. If omitted, Shopify CLI generates one.',
      env: 'CONVERSATION_ID',
    }),
    agent: Flags.string({
      description: 'Agent name to associate with the conversation.',
      env: 'SHOPIFY_CLI_AGENT',
    }),
    'agent-version': Flags.string({
      description: 'Agent version to associate with the conversation.',
      env: 'SHOPIFY_CLI_AGENT_VERSION',
    }),
    provider: Flags.string({
      description: 'Agent provider to associate with the conversation.',
      env: 'SHOPIFY_CLI_AGENT_PROVIDER',
    }),
    harness: Flags.string({
      description: 'Harness or host app running the agent conversation.',
      env: 'SHOPIFY_CLI_AGENT_HARNESS',
    }),
    model: Flags.string({
      description: 'Model identifier to associate with the conversation.',
      env: 'SHOPIFY_CLI_AGENT_MODEL',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AgentConversationStart)
    const conversation = await startAgentConversation({
      conversationId: flags['conversation-id'],
      agent: flags.agent,
      agentVersion: flags['agent-version'],
      provider: flags.provider,
      harness: flags.harness,
      model: flags.model,
    })

    if (flags.json) {
      return outputResult(JSON.stringify(conversation, null, 2))
    }

    return outputResult(
      [
        `Started Shopify agent conversation ${conversation.conversationId}.`,
        `Context path: ${conversation.contextPath}`,
        'Reuse the context path as SHOPIFY_CLI_AGENT_CONTEXT on later shopify commands.',
      ].join('\n'),
    )
  }
}
