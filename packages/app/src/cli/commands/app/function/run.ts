import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {runFunctionRunner} from '../../../services/function/build.js'
import {appFlags} from '../../../flags.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class FunctionRun extends Command {
  static description = 'Run a Function locally for testing.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    input: Flags.string({
      char: 'i',
      description: 'The input JSON to pass to the function. If omitted, standard input is used.',
      env: 'SHOPIFY_FLAG_INPUT',
    }),
    json: Flags.boolean({
      char: 'j',
      hidden: false,
      description: 'Log the run result as a JSON object.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  public async run() {
    const {flags} = await this.parse(FunctionRun)
    await inFunctionContext({
      commandConfig: this.config,
      path: flags.path,
      configName: flags.config,
      callback: async (_app, ourFunction) => {
        await runFunctionRunner(ourFunction, {input: flags.input, json: flags.json})
      },
    })
  }
}
