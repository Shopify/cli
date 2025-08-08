import {FunctionRunData} from '../../services/function/replay.js'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'

export async function selectFunctionRunPrompt(
  functionRuns: FunctionRunData[],
  message: string,
): Promise<FunctionRunData | undefined> {
  if (functionRuns.length === 0) return undefined
  const toAnswer = (functionRun: FunctionRunData) => {
    return {
      label: `${functionRun.logTimestamp} (${functionRun.status}) - ${functionRun.identifier}`,
      value: functionRun,
    }
  }

  const functionRunsList = functionRuns.map(toAnswer)

  const selectedRun = await renderAutocompletePrompt({
    message,
    choices: functionRunsList,
  })
  return selectedRun
}
