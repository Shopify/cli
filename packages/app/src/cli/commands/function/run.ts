import {appFlags} from '../../flags.js'
import {runFunctionRunner} from '../../services/function/build.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'

export default class FunctionRun extends Command {
  static description = 'Build a Shopify function written in Javascript or Typescript.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    help: Flags.help({
      required: false,
      hidden: false,
      env: 'SHOPIFY_FLAG_HELP',
      description: `This help. When you run the trigger command the CLI will prompt you for any information that isn't passed using flags.`,
    }),
  }

  public async run() {
    const {flags} = await this.parse(FunctionRun)
    const directory = flags.path ? resolvePath(flags.path) : process.cwd()
    const input = await this.readStdin()
    await runFunctionRunner(directory, input)
  }

  // from: https://stackoverflow.com/a/54565854
  private async readStdin(): Promise<string> {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf8')
  }
}
