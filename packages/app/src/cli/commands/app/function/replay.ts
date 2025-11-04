import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {replay} from '../../../services/function/replay.js'
import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class FunctionReplay extends AppLinkedCommand {
  static summary = 'Replays a function run from an app log.'

  static descriptionWithMarkdown = `Runs the function from your current directory for [testing purposes](https://shopify.dev/docs/apps/functions/testing-and-debugging). To learn how you can monitor and debug functions when errors occur, refer to [Shopify Functions error handling](https://shopify.dev/docs/api/functions/errors).`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    ...jsonFlag,
    log: Flags.string({
      char: 'l',
      description:
        'Specifies a log identifier to replay instead of selecting from a list. The identifier is provided in the output of `shopify app dev` and is the suffix of the log file name.',
      env: 'SHOPIFY_FLAG_LOG',
    }),
    watch: Flags.boolean({
      char: 'w',
      hidden: false,
      allowNo: true,
      default: true,
      description: 'Re-run the function when the source code changes.',
      env: 'SHOPIFY_FLAG_WATCH',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(FunctionReplay)

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    await replay({
      app,
      extension: ourFunction,
      path: flags.path,
      log: flags.log,
      json: flags.json,
      watch: flags.watch,
    })

    return {app}
  }
}
