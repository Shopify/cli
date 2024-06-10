import {selectFunctionRunPrompt} from './replay.js'
import {FunctionRunData} from '../../services/function/replay.js'
import {describe, expect, vi, test} from 'vitest'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

const RUN1: FunctionRunData = {
  shop_id: 69665030382,
  api_client_id: 124042444801,
  payload: {
    input: '{}',
    input_bytes: 136,
    output: '{}',
    output_bytes: 195,
    function_id: '34236fa9-42f5-4bb6-adaf-956e12fff0b0',
    export: 'run',
    logs: '',
    fuel_consumed: 458206,
  },
  event_type: 'function_run',
  cursor: '2024-05-31T15:29:47.291530Z',
  status: 'success',
  source: 'my-function',
  source_namespace: 'extensions',
  log_timestamp: '2024-05-31T15:29:46.741270Z',
  identifier: 'abcdef',
}

const RUN2: FunctionRunData = {
  shop_id: 69665030382,
  api_client_id: 124042444801,
  payload: {
    input: '{}',
    input_bytes: 136,
    output: '{}',
    output_bytes: 195,
    function_id: '34236fa9-42f5-4bb6-adaf-956e12fff0b0',
    export: 'run',
    logs: '',
    fuel_consumed: 458206,
  },
  event_type: 'function_run',
  cursor: '2024-05-31T15:29:47.291530Z',
  status: 'success',
  source: 'my-function',
  source_namespace: 'extensions',
  log_timestamp: '2024-05-31T15:29:46.741270Z',
  identifier: 'abc123',
}

describe('selectFunctionRun', () => {
  test('returns run if user selects one', async () => {
    // Given
    const runs = [RUN1, RUN2]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(RUN2)

    // When
    const got = await selectFunctionRunPrompt(runs)

    // Then
    expect(got).toEqual(RUN2)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which function run would you like to replay locally?',
      choices: [
        {label: `${RUN1.log_timestamp} (${RUN1.status}) - ${RUN1.identifier}`, value: RUN1},
        {label: `${RUN2.log_timestamp} (${RUN2.status}) - ${RUN2.identifier}`, value: RUN2},
      ],
    })
  })

  test('returns undefined if no runs', async () => {
    // Given
    const runs: FunctionRunData[] = []

    // When
    const got = await selectFunctionRunPrompt(runs)

    // Then
    expect(got).toEqual(undefined)
  })
})
