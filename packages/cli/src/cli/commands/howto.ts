import {howtoService} from '../services/commands/howto.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class Howto extends Command {
  static description =
    "Ask how to accomplish a task using Shopify CLI. The answer comes from Shopify's AI assistant, grounded in shopify.dev, and only covers Shopify development topics."

  static examples = [
    `# ask how to accomplish a task with Shopify CLI
    shopify howto --task "Create an app with a checkout extension"
    `,
  ]

  static flags = {
    ...globalFlags,
    task: Flags.string({
      description: 'The task you want to accomplish using Shopify CLI.',
      env: 'SHOPIFY_FLAG_TASK',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Howto)
    await howtoService(flags.task)
  }
}
