import {appFlags} from '../../flags.js'
import {runFunctionRunner} from '../../services/function/build.js'
import {AppInterface} from '../../models/app/app.js'
import {load as loadApp} from '../../models/app/loader.js'
import {loadExtensionsSpecifications} from '../../models/extensions/specifications.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {error} from '@shopify/cli-kit'
import {renderFatalError} from '@shopify/cli-kit/node/ui'

export default class FunctionRun extends Command {
  static description = 'Run a Shopify function locally.'

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run() {
    const {flags} = await this.parse(FunctionRun)
    const input = await this.readStdin()
    const directory = flags.path ? resolvePath(flags.path) : process.cwd()

    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({directory, specifications})

    const ourFunction = app.extensions.function.find((fun) => fun.directory === directory)
    if (ourFunction) {
      const input = await this.readStdin()
      await runFunctionRunner(ourFunction, input)
    } else {
      const err = new error.Bug('You should run this command from the root of a function.')
      err.stack = undefined
      renderFatalError(err)
    }
  }

  // from: https://stackoverflow.com/a/54565854
  private async readStdin(): Promise<string> {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf8')
  }
}
