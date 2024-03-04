import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {buildGraphqlTypes} from '../../../services/function/build.js'
import {appFlags} from '../../../flags.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class FunctionTypegen extends Command {
  static description = 'Generate GraphQL types for a JavaScript function.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
  }

  public async run() {
    const {flags} = await this.parse(FunctionTypegen)
    await inFunctionContext({
      path: flags.path,
      configName: flags.configName,
      callback: async (app, ourFunction) => {
        await buildGraphqlTypes(ourFunction, {stdout: process.stdout, stderr: process.stderr, app})
        renderSuccess({headline: 'GraphQL types generated successfully.'})
      },
    })
  }
}
