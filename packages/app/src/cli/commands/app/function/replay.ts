import {functionFlags, inFunctionContext} from '../../../services/function/common.js'
import {runFunctionRunner} from '../../../services/function/build.js'
import {appFlags} from '../../../flags.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {readFile, writeFile, inTemporaryDirectory, fileExists, touchFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readdirSync} from 'fs'
import {selectRunPrompt} from '../../../prompts/dev.js'

export default class FunctionReplay extends Command {
  static summary = 'Replays a function locally based on a FunctionRunEvent.'

  static descriptionWithMarkdown = `Runs the function from your current directory for [testing purposes](https://shopify.dev/docs/apps/functions/testing-and-debugging). To learn how you can monitor and debug functions when errors occur, refer to [Shopify Functions error handling](https://shopify.dev/docs/api/functions/errors).`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    input: Flags.string({
      char: 'i',
      description: 'The input JSON to pass to the function. This should be a json file read.',
      env: 'SHOPIFY_FLAG_INPUT',
    }),
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
    const appPath = flags.path // TODO: default to current directory if path arg not provided
    // console.log(appPath)

    // Determine folder to read for runs
    const runsFolder = joinPath(appPath, 'runs')

    // Read file names
    const runFileNames = readdirSync(runsFolder)

    // full paths to read file
    const runFilePaths = runFileNames.map((runFile) => joinPath(runsFolder, runFile))

    // read contents
    const runData = await Promise.all(
      runFilePaths.map((runFile) => {
        return readFile(runFile)
      }),
    )

    // console.log('=== runData')
    // console.log(runData)

    // convert promise'd strings to json
    const runs = runData.map((run) => JSON.parse(run))

    // console.log('=== runs')
    // console.log(runs)

    // read contents into object that can be presented to the autocomplete prompt
    // const runs = runFilePaths.map((runFile) => {
    //   const data = await readFile(runFile)
    //   const run = JSON.parse(data)
    // })

    // Present selector for runs
    const selectedRun = await selectRunPrompt(runs)
    // console.log('=== after awaiting selectRunPrompt')
    // console.log(selectedRun)

    const input = selectedRun.payload.input

    // dump the output to a file
    await inTemporaryDirectory(async (tmpDir) => {
      // console.log('=== inTmpDir')
      // console.log(tmpDir)

      // create file to pass to runner
      const input_path = joinPath(tmpDir, 'input_for_runner.json')
      await writeFile(input_path, input)

      // console.log('=== exists?')
      // console.log(await fileExists(input_path))

      // invoke the existing run command with the input from the file
      await inFunctionContext({
        path: flags.path,
        configName: flags.config,
        callback: async (_app, ourFunction) => {
          await runFunctionRunner(ourFunction, {
            json: true,
            input: input_path,
            export: 'run',
          })
        },
      })
    })
  }
}
