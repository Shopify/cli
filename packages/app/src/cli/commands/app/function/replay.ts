import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {replay} from '../../../services/function/replay.js'
import {functionReplayJsonOutputSchema} from '../../../services/function/replay/types.js'
import {presentFunctionExecution} from '../../../services/function/runner/result.js'
import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class FunctionReplay extends AppLinkedCommand {
  public static get requiresSyncAnalytics(): boolean {
    return true
  }

  static jsonOutputSchema = functionReplayJsonOutputSchema

  static summary = 'Replays a function run from an app log.'

  static descriptionWithMarkdown = `Runs the function from your current directory for [testing purposes](https://shopify.dev/docs/apps/functions/testing-and-debugging). To learn how you can monitor and debug functions when errors occur, refer to [Shopify Functions error handling](https://shopify.dev/docs/api/functions/errors).

Watch mode is enabled by default. With --json, writes one JSONL record per lifecycle update, rebuild, and execution. Execution records preserve the native Function runner result under result. Diagnostics and prompts use stderr. Recoverable build and Function execution failures keep watching; fatal CLI failures end the stream with the standard error document. Ctrl-C stops watching and exits with code 130. Use --no-input for unattended replay.

With --no-watch --json, writes one native Function runner result and exits, preserving the finite result contract.`

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

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    const execution = await replay({
      app,
      extension: ourFunction,
      path: flags.path,
      log: flags.log,
      json: flags.json,
      watch: flags.watch,
    })
    if (execution) presentFunctionExecution(execution)

    return {app}
  }
}
