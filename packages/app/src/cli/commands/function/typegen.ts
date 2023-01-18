import {appFlags} from '../../flags.js'
import {buildGraphqlTypes} from '../../services/function/build.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'

export default class FunctionTypegen extends Command {
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
    const {flags} = await this.parse(FunctionTypegen)
    const directory = flags.path ? resolvePath(flags.path) : process.cwd()
    await buildGraphqlTypes(directory)
  }
}
