import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {runFunctionRunner} from '../../../services/function/build.js'
import {readFunctionRunsDirectory} from '../../../services/function/replay.js'
import {appFlags} from '../../../flags.js'
import {selectRunPrompt} from '../../../prompts/dev.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {writeFile, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

export default class FunctionReplay extends Command {
  static summary = 'Replays a function locally based on a FunctionRunEvent.'

  static descriptionWithMarkdown = `Runs the function from your current directory for [testing purposes](https://shopify.dev/docs/apps/functions/testing-and-debugging). To learn how you can monitor and debug functions when errors occur, refer to [Shopify Functions error handling](https://shopify.dev/docs/api/functions/errors).`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    export: Flags.string({
      char: 'e',
      hidden: false,
      description: 'Name of the wasm export to invoke.',
      default: '_start',
      env: 'SHOPIFY_FLAG_EXPORT',
    }),
    json: Flags.boolean({
      char: 'j',
      hidden: false,
      description: 'Log the run result as a JSON object.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  public async run() {
    const {flags} = await this.parse(FunctionReplay)
    const functionPath = flags.path

    const runs = await readFunctionRunsDirectory(functionPath)

    const selectedRun = await selectRunPrompt(runs)

    const input = selectedRun.payload.input

    // dump the output to a file
    await inTemporaryDirectory(async (tmpDir) => {
      // create file to pass to runner
      const inputPath = joinPath(tmpDir, 'input_for_runner.json')
      await writeFile(inputPath, input)

      // invoke the existing run command with the input from the file
      await inFunctionContext({
        path: flags.path,
        configName: flags.config,
        callback: async (_app, ourFunction) => {
          await runFunctionRunner(ourFunction, {
            json: flags.json,
            input: inputPath,
            export: flags.export,
          })
        },
      })
    })
  }
}
