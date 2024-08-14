import {Replay} from './Replay.js'
import {testFunctionExtension, testApp} from '../../../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../../../models/extensions/specifications/function.js'
import {render} from '@shopify/cli-kit/node/testing/ui'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {beforeAll, describe, expect, test, vi} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'
import { setupExtensionWatcherForReplay } from './hooks/extension-watcher.js'
import { FunctionRunData } from '../../replay.js'

vi.mock('./hooks/extension-watcher.js')

interface FunctionRun {
  type: 'functionRun'
  input: string
  output: string
  logs: string
  name: string
  size: number
  memory_usage: number
  instructions: number
}

const defaultConfig = {
  name: 'MyFunction',
  type: 'product_discounts',
  build: {
    command: 'make build',
    path: 'dist/index.wasm',
  },
  configuration_ui: true,
  api_version: '2022-07',
  metafields: [],
  handle: 'function-handle',
}

let extension: ExtensionInstance<FunctionConfigType>

beforeAll(async () => {
  extension = await testFunctionExtension({config: defaultConfig})
})

const SELECTED_RUN = {
  shopId: 69665030382,
  apiClientId: 124042444801,
  payload: {
    export: 'run',
    input: {
      someInput: "someInput"
    },
    inputBytes: 136,
    output: {
      someOutput: "someOutput"
    },
    outputBytes: 195,
    logs: 'First Log\nLog the second!,\n1,\nfourth line, length should be above!,\nFifth line!',
    functionId: '34236fa9-42f5-4bb6-adaf-956e12fff0b0',
    fuelConsumed: 532632,
  },
  logType: 'function_run',
  cursor: '2024-08-02T17:45:27.683139Z',
  status: 'success',
  source: 'product-discount',
  sourceNamespace: 'extensions',
  logTimestamp: '2024-08-02T17:45:27.382075Z',
  identifier: '123456',
} as FunctionRunData

const FUNCTION_RUN_FROM_SELECTED_RUN = {
  type: 'functionRun',
  input: SELECTED_RUN.payload.input,
  output: SELECTED_RUN.payload.output,
  logs: SELECTED_RUN.payload.logs,
  name: SELECTED_RUN.source,
  size: 0,
  memory_usage: 0,
  instructions: SELECTED_RUN.payload.fuelConsumed,
} as FunctionRun

const WATCHER_RETURN_VALUE = {
  logs: [FUNCTION_RUN_FROM_SELECTED_RUN, FUNCTION_RUN_FROM_SELECTED_RUN],
  isAborted: false,
  canUseShortcuts: true,
  statusMessage: `Watching for changes to ${SELECTED_RUN.source}...`,
  recentFunctionRuns: [FUNCTION_RUN_FROM_SELECTED_RUN, FUNCTION_RUN_FROM_SELECTED_RUN]
}

describe('Replay', () => {
  test('renders a stream of lines from function-runner output, and shortcuts', async () => {
    const mockedsetupExtensionWatcherForReplay = vi.fn().mockReturnValue(WATCHER_RETURN_VALUE)
    vi.mocked(setupExtensionWatcherForReplay).mockImplementation(mockedsetupExtensionWatcherForReplay)


    const renderInstanceReplay = render(
      <Replay
        selectedRun={SELECTED_RUN}
        abortController={new AbortController()}
        app={testApp()}
        extension={extension}
      />,
    )

    // Then
    expect(unstyled(renderInstanceReplay.lastFrame()!)).toMatchInlineSnapshot(`
      "Input
      {
        \\"someInput\\": \\"someInput\\"
      }
      Logs
      First Log
      Log the second!,
      1,
      fourth line, length should be above!,
      Fifth line!
      Output
      {
        \\"someOutput\\": \\"someOutput\\"
      }
      Benchmark Results
      Name: product-discount
      Linear Memory Usage: 0KB
      Instructions: 532.632K
      Size: 0KB
      Input
      {
        \\"someInput\\": \\"someInput\\"
      }
      Logs
      First Log
      Log the second!,
      1,
      fourth line, length should be above!,
      Fifth line!
      Output
      {
        \\"someOutput\\": \\"someOutput\\"
      }
      Benchmark Results
      Name: product-discount
      Linear Memory Usage: 0KB
      Instructions: 532.632K
      Size: 0KB

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Watching for changes to product-discount...
      › Instruction count delta: 0
      › Press q │ quit
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstanceReplay.unmount()
  })
})
