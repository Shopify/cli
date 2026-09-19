import {feedbackService, MAX_FEEDBACK_MESSAGE_LENGTH} from '../services/commands/feedback.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class Feedback extends Command {
  // The analytics event carrying the feedback is the whole point of this command, so wait for the
  // delivery attempt instead of detaching it to a background process that might not outlive us.
  public static get requiresSyncAnalytics(): boolean {
    return true
  }

  static summary = 'Send feedback about Shopify CLI.'

  static descriptionWithMarkdown = `Sends feedback about Shopify CLI to the team that builds it. The feedback travels on the usage analytics the CLI already reports, so it makes no separate network request and respects the analytics opt-out. It never prompts, so both humans and AI agents can run it.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --message "The deploy command told me to use a flag that does not exist"',
    '<%= config.bin %> <%= command.id %> --message "dev keeps disconnecting from my store" --sentiment frustrated --category tool_failure',
    'echo "Docs and CLI disagree about theme push" | <%= config.bin %> <%= command.id %> --message -',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    message: Flags.string({
      char: 'm',
      description: `The feedback message. Pass - to read the message from stdin. Messages longer than ${MAX_FEEDBACK_MESSAGE_LENGTH} characters are truncated.`,
      required: true,
      env: 'SHOPIFY_FLAG_MESSAGE',
    }),
    sentiment: Flags.string({
      description: 'How the experience felt.',
      options: ['frustrated', 'blocked', 'confused', 'praise'],
      env: 'SHOPIFY_FLAG_SENTIMENT',
    }),
    category: Flags.string({
      description: 'What the feedback is about.',
      options: ['wrong_guidance', 'missing_capability', 'confusing_docs', 'tool_failure', 'slow', 'other'],
      env: 'SHOPIFY_FLAG_CATEGORY',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Feedback)
    await feedbackService({
      message: flags.message,
      sentiment: flags.sentiment,
      category: flags.category,
      json: flags.json,
    })
  }
}
