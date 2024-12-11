import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class Demo extends Command {
  static summary = 'Demo command to showcase CLI functionality'

  static description = 'A sample command that demonstrates how to build CLI commands'

  static flags = {
    ...globalFlags,
    name: Flags.string({
      char: 'n',
      description: 'Name to demo with',
      env: 'SHOPIFY_FLAG_DEMO_NAME',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Demo)
    const name = flags.name ?? 'Shopify Developer'
    outputInfo(`Hello ${name}! This is a demo command.`)
  }
}
