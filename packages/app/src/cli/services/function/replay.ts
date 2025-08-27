import {renderReplay} from './ui.js'
import {runFunction} from './runner.js'
import {FunctionRunData, getFunctionRunData, getRunFromIdentifier} from './common.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/select-run.js'

import {joinPath} from '@shopify/cli-kit/node/path'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'

// Re-export FunctionRunData for backward compatibility
export {FunctionRunData}

interface ReplayOptions {
  app: AppLinkedInterface
  extension: ExtensionInstance<FunctionConfigType>
  stdout?: boolean
  path: string
  json: boolean
  watch: boolean
  log?: string
}

export async function replay(options: ReplayOptions) {
  const {watch, extension, app} = options
  const abortController = new AbortController()

  try {
    const apiKey = options.app.configuration.client_id
    const functionRunsDir = joinPath(getLogsDir(), apiKey)

    const selectedRun = options.log
      ? await getRunFromIdentifier(functionRunsDir, extension.handle, options.log)
      : await getRunFromSelector(functionRunsDir, extension.handle)

    const {input, export: runExport} = selectedRun.payload

    if (watch) {
      await renderReplay({
        selectedRun,
        abortController,
        app,
        extension,
      })
    } else {
      await runFunction({
        functionExtension: extension,
        json: options.json,
        input: JSON.stringify(input),
        export: runExport,
      })
    }
  } catch (error) {
    abortController.abort()
    throw error
  }
}

async function getRunFromSelector(functionRunsDir: string, functionHandle: string): Promise<FunctionRunData> {
  const functionRuns = await getFunctionRunData(functionRunsDir, functionHandle)
  const selectedRun = await selectFunctionRunPrompt(
    functionRuns,
    'Which function run would you like to replay locally?',
  )

  if (selectedRun === undefined) {
    throw new AbortError(`No logs found in ${functionRunsDir}`)
  }
  return selectedRun
}
