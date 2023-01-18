import {appFlags} from '../../flags.js'
import {buildGraphqlTypes} from '../../services/function/build.js'
import {loadExtensionsSpecifications} from '../../models/extensions/specifications.js'
import {load as loadApp} from '../../models/app/loader.js'
import {AppInterface} from '../../models/app/app.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {error} from '@shopify/cli-kit'
import {renderFatalError} from '@shopify/cli-kit/node/ui'

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

    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({directory, specifications})

    const ourFunction = app.extensions.function.find((fun) => fun.directory === directory)
    if (ourFunction) {
      await buildGraphqlTypes(ourFunction.directory)
    } else {
      const err = new error.Bug('You should run this command from the root of a function.')
      err.stack = undefined
      renderFatalError(err)
    }
  }
}
