import {FunctionRunData} from '../../services/function/replay.js'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'

export async function selectFunctionRunPrompt(functionRuns: FunctionRunData[]): Promise<FunctionRunData> {
  const toAnswer = (functionRun: FunctionRunData) => {
    return {
      label: `${functionRun.log_timestamp} (${functionRun.status}) - ${functionRun.identifier}`,
      value: functionRun,
    }
  }

  const functionRunsList = functionRuns.map(toAnswer)

  const selectedRun = await renderAutocompletePrompt({
    message: 'Which function run would you like to replay locally?',
    choices: functionRunsList,
  })
  return selectedRun
}
