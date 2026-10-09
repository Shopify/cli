import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {replay, replayFunction} from '../../../services/function/replay.js'
import {functionRunJsonOutputSchema} from '../../../services/function/runner/types.js'
import {presentFunctionExecution} from '../../../services/function/runner/result.js'
import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class FunctionReplay extends AppLinkedCommand {
  public static get requiresSyncAnalytics(): boolean {
    return true
  }

  static get jsonOutputSchema() {
    return functionRunJsonOutputSchema
  }

  static summary = 'Replays a function run from an app log.'

  static descriptionWithMarkdown = `Runs the function from your current directory for [testing purposes](https://shopify.dev/docs/apps/functions/testing-and-debugging). To learn how you can monitor and debug functions when errors occur, refer to [Shopify Functions error handling](https://shopify.dev/docs/api/functions/errors).

Use \`--no-watch --json\` for one finite replay in the native Function runner 7.x/9.x JSON format. JSON output is not supported in watch mode. Use \`--log\` to select a saved run without prompting.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    ...jsonFlag,
    log: requiredIfNonInteractive(
      Flags.string({
        char: 'l',
        description:
          'Specifies a log identifier to replay instead of selecting from a list. The identifier is provided in the output of `shopify app dev` and is the suffix of the log file name.',
        env: 'SHOPIFY_FLAG_LOG',
      }),
    ),
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
    if (flags.json && flags.watch) {
      throw new AbortError('JSON output requires a finite replay. Use --no-watch with --json.')
    }

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    if (flags.json) {
      presentFunctionExecution(await replayFunction({app, extension: ourFunction, log: flags.log}))
    } else {
      await replay({
        app,
        extension: ourFunction,
        path: flags.path,
        log: flags.log,
        json: false,
        watch: flags.watch,
      })
    }

    return {app}
  }
}
