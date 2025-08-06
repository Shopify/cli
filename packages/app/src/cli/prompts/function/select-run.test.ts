import {selectFunctionRunPrompt} from './select-run.js'
import {FunctionRunData} from '../../services/function/replay.js'
import {describe, expect, vi, test} from 'vitest'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

const RUN1: FunctionRunData = {
  shopId: 69665030382,
  apiClientId: 124042444801,
  payload: {
    input: {},
    inputBytes: 136,
    output: {},
    outputBytes: 195,
    functionId: '34236fa9-42f5-4bb6-adaf-956e12fff0b0',
    export: 'run',
    logs: '',
    fuelConsumed: 458206,
  },
  logType: 'function_run',
  cursor: '2024-05-31T15:29:47.291530Z',
  status: 'success',
  source: 'my-function',
  sourceNamespace: 'extensions',
  logTimestamp: '2024-05-31T15:29:46.741270Z',
  identifier: 'abcdef',
}

const RUN2: FunctionRunData = {
  shopId: 69665030382,
  apiClientId: 124042444801,
  payload: {
    input: {},
    inputBytes: 136,
    output: {},
    outputBytes: 195,
    functionId: '34236fa9-42f5-4bb6-adaf-956e12fff0b0',
    export: 'run',
    logs: '',
    fuelConsumed: 458206,
  },
  logType: 'function_run',
  cursor: '2024-05-31T15:29:47.291530Z',
  status: 'success',
  source: 'my-function',
  sourceNamespace: 'extensions',
  logTimestamp: '2024-05-31T15:29:46.741270Z',
  identifier: 'abc123',
}

describe('selectFunctionRun', () => {
  test('returns run if user selects one', async () => {
    // Given
    const runs = [RUN1, RUN2]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(RUN2)

    // When
    const got = await selectFunctionRunPrompt(runs, 'Which function run would you like to replay locally?')

    // Then
    expect(got).toEqual(RUN2)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which function run would you like to replay locally?',
      choices: [
        {label: `${RUN1.logTimestamp} (${RUN1.status}) - ${RUN1.identifier}`, value: RUN1},
        {label: `${RUN2.logTimestamp} (${RUN2.status}) - ${RUN2.identifier}`, value: RUN2},
      ],
    })
  })

  test('returns undefined if no runs', async () => {
    // Given
    const runs: FunctionRunData[] = []

    // When
    const got = await selectFunctionRunPrompt(runs, 'Which function run would you like to replay locally?')

    // Then
    expect(got).toEqual(undefined)
  })
})
