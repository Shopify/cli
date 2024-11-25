import {Replay} from './Replay.js'
import {useFunctionWatcher} from './hooks/useFunctionWatcher.js'
import {FunctionRunFromRunner} from './types.js'
import {testFunctionExtension, testAppLinked} from '../../../../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../../../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../../../../models/extensions/specifications/function.js'
import {FunctionRunData} from '../../../replay.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {beforeAll, describe, expect, test, vi} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'
import {render, sendInputAndWait, waitForInputsToBeReady} from '@shopify/cli-kit/node/testing/ui'

vi.mock('./hooks/useFunctionWatcher.js')

const SELECTED_RUN = {
  shopId: 69665030382,
  apiClientId: 124042444801,
  payload: {
    export: 'run',
    input: {
      someInput: 'someInput',
    },
    inputBytes: 136,
    output: {
      someOutput: 'someOutput',
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
} as FunctionRunFromRunner

const FUNCTION_RUN_FROM_SELECTED_RUN2 = {
  type: 'functionRun',
  input: SELECTED_RUN.payload.input,
  output: SELECTED_RUN.payload.output,
  logs: SELECTED_RUN.payload.logs,
  name: SELECTED_RUN.source,
  size: 1,
  memory_usage: 1,
  instructions: SELECTED_RUN.payload.fuelConsumed + 1,
} as FunctionRunFromRunner

const WATCHER_RETURN_VALUE = {
  logs: [FUNCTION_RUN_FROM_SELECTED_RUN2, FUNCTION_RUN_FROM_SELECTED_RUN],
  isAborted: false,
  canUseShortcuts: true,
  statusMessage: `Watching for changes to ${SELECTED_RUN.source}...`,
  recentFunctionRuns: [FUNCTION_RUN_FROM_SELECTED_RUN2, FUNCTION_RUN_FROM_SELECTED_RUN],
  error: '',
}

let extension: ExtensionInstance<FunctionConfigType>

beforeAll(async () => {
  extension = await testFunctionExtension()
})

describe('Replay', () => {
  test('renders a stream of lines from function-runner output, and shortcuts', async () => {
    const mockedUseFunctionWatcher = vi.fn().mockReturnValue(WATCHER_RETURN_VALUE)
    vi.mocked(useFunctionWatcher).mockImplementation(mockedUseFunctionWatcher)

    const renderInstanceReplay = render(
      <Replay
        selectedRun={SELECTED_RUN}
        abortController={new AbortController()}
        app={testAppLinked()}
        extension={extension}
      />,
    )

    // Then
    expect(unstyled(renderInstanceReplay.lastFrame()!)).toMatchSnapshot()

    // unmount so that polling is cleared after every test
    renderInstanceReplay.unmount()
  })

  test('renders error in the bottom bar when present', async () => {
    const watcherReturnValueWithError = {
      ...WATCHER_RETURN_VALUE,
      error: 'some error',
    }
    const mockedUseFunctionWatcher = vi.fn().mockReturnValue(watcherReturnValueWithError)
    vi.mocked(useFunctionWatcher).mockImplementation(mockedUseFunctionWatcher)

    const renderInstanceReplay = render(
      <Replay
        selectedRun={SELECTED_RUN}
        abortController={new AbortController()}
        app={testAppLinked()}
        extension={extension}
      />,
    )

    // Then
    expect(unstyled(renderInstanceReplay.lastFrame()!)).toMatchSnapshot()

    // unmount so that polling is cleared after every test
    renderInstanceReplay.unmount()
  })

  test('quits when q is pressed', async () => {
    const abortController = new AbortController()
    const abortSpy = vi.spyOn(abortController, 'abort')

    const mockedUseFunctionWatcher = vi.fn().mockReturnValue(WATCHER_RETURN_VALUE)
    vi.mocked(useFunctionWatcher).mockImplementation(mockedUseFunctionWatcher)

    const renderInstanceReplay = render(
      <Replay
        selectedRun={SELECTED_RUN}
        abortController={abortController}
        app={testAppLinked()}
        extension={extension}
      />,
    )

    const promise = renderInstanceReplay.waitUntilExit()

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstanceReplay, 100, 'q')

    await promise

    // Then
    expect(abortSpy).toHaveBeenCalledOnce()

    // unmount so that polling is cleared after every test
    renderInstanceReplay.unmount()
  })

  test('quits when ctrl+c is pressed', async () => {
    // Given
    const abortController = new AbortController()
    const abortSpy = vi.spyOn(abortController, 'abort')

    const mockedUseFunctionWatcher = vi.fn().mockReturnValue(WATCHER_RETURN_VALUE)
    vi.mocked(useFunctionWatcher).mockImplementation(mockedUseFunctionWatcher)

    const renderInstanceReplay = render(
      <Replay
        selectedRun={SELECTED_RUN}
        abortController={abortController}
        app={testAppLinked()}
        extension={extension}
      />,
    )

    const promise = renderInstanceReplay.waitUntilExit()

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstanceReplay, 100, '\u0003')

    await promise
    // Then
    expect(abortSpy).toHaveBeenCalledOnce()

    // unmount so that polling is cleared after every test
    renderInstanceReplay.unmount()
  })
})
