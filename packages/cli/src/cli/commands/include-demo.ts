import {includeDemoService} from '../services/commands/include-demo.js'
import Command from '@shopify/cli-kit/node/base-command'
import {Flags} from '@oclif/core'
import {outputInfo, outputContent} from '@shopify/cli-kit/node/output'

export default class IncludeDemo extends Command {
  static description = 'Demo command for showing how config files can be composed through directives.'

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to the TOML file',
      required: true,
      env: 'SHOPIFY_FLAG_PATH',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(IncludeDemo)
    const decodedContent = await includeDemoService(flags.path)
    outputInfo(outputContent`Decoded TOML content:`)
    outputInfo(outputContent`${JSON.stringify(decodedContent, null, 2)}`)
  }
}
