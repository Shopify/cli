import Command from '@shopify/cli-kit/node/base-command'
import {startAgentSession, AgentSession} from '@shopify/cli-kit/node/agent'
import {jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult, outputInfo} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'
import {randomUUID} from 'crypto'

export default class AgentSessionStart extends Command {
  static summary = 'Start a new agent session.'

  static description = 'Initializes and persists a new agent session with the specified configuration.'

  static examples = [
    '<%= config.bin %> <%= command.id %> --agent river --agent-version 1.0.0 --provider openai --metrics on',
    '<%= config.bin %> <%= command.id %> --agent river --agent-version 1.0.0 --provider openai --metrics off --default-non-interactive',
    '<%= config.bin %> <%= command.id %> --agent river --agent-version 1.0.0 --provider openai --metrics on --json',
  ]

  static flags = {
    ...jsonFlag,
    agent: Flags.string({
      description: 'Agent name.',
      required: true,
      env: 'SHOPIFY_FLAG_AGENT_NAME',
    }),
    'agent-version': Flags.string({
      description: 'Agent version.',
      required: true,
      env: 'SHOPIFY_FLAG_AGENT_VERSION',
    }),
    provider: Flags.string({
      description: 'Agent provider.',
      required: true,
      env: 'SHOPIFY_FLAG_AGENT_PROVIDER',
    }),
    metrics: Flags.string({
      description: 'Metrics mode (on or off).',
      required: true,
      options: ['on', 'off'],
      env: 'SHOPIFY_FLAG_AGENT_METRICS',
    }),
    'default-non-interactive': Flags.boolean({
      description: 'Set default non-interactive mode.',
      default: false,
      env: 'SHOPIFY_FLAG_AGENT_DEFAULT_NON_INTERACTIVE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AgentSessionStart)

    const sessionId = `conv_${randomUUID()}`

    const session = startAgentSession({
      sessionId,
      agentName: flags.agent,
      agentVersion: flags['agent-version'],
      agentProvider: flags.provider,
      metricsMode: flags.metrics as 'on' | 'off',
      defaultNonInteractive: flags['default-non-interactive'],
    })

    if (flags.json) {
      outputResult(JSON.stringify(session, null, 2))
      return
    }

    outputInfo(formatSessionOutput(session))
  }
}

function formatSessionOutput(session: AgentSession): string {
  return [
    `Agent session started:`,
    `  Session ID: ${session.sessionId}`,
    `  Agent: ${session.agentName}`,
    `  Version: ${session.agentVersion}`,
    `  Provider: ${session.agentProvider}`,
    `  Metrics: ${session.metricsMode}`,
    `  Default non-interactive: ${session.defaultNonInteractive}`,
    `  Started at: ${session.startedAt}`,
  ].join('\n')
}
