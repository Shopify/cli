import {useFunctionWatcher} from './useFunctionWatcher.js'
import {FunctionRunData} from '../../../../replay.js'
import {testAppLinked, testFunctionExtension} from '../../../../../../models/app/app.test-data.js'
import {runFunction} from '../../../../runner.js'
import {AppEventWatcher, EventType} from '../../../../../dev/app-events/app-event-watcher.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {render} from '@shopify/cli-kit/node/testing/ui'
import {test, describe, vi, beforeEach, afterEach, expect} from 'vitest'
import React from 'react'
import {Writable} from 'stream'

vi.mock('../../../../../dev/extension/bundler.js')
vi.mock('../../../../runner.js')

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

const ABORT_CONTROLLER = new AbortController()
const APP = testAppLinked()
const EXTENSION = await testFunctionExtension()

const EXEC_RESPONSE = {
  input: SELECTED_RUN.payload.input,
  output: SELECTED_RUN.payload.output,
  logs: SELECTED_RUN.payload.logs,
  name: SELECTED_RUN.source,
  size: 0,
  memory_usage: 0,
  instructions: SELECTED_RUN.payload.fuelConsumed,
}

const SECOND_EXEC_RESPONSE = {
  input: SELECTED_RUN.payload.input,
  output: SELECTED_RUN.payload.output,
  logs: SELECTED_RUN.payload.logs,
  name: SELECTED_RUN.source,
  size: 1,
  memory_usage: 1,
  instructions: SELECTED_RUN.payload.fuelConsumed,
}

describe('useFunctionWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  test('runs function once in watch mode without changes', async () => {
    // Given
    vi.mocked(runFunction).mockImplementation(runFunctionMockImplementation(EXEC_RESPONSE))

    // When
    const hook = renderHook(() =>
      useFunctionWatcher({
        selectedRun: SELECTED_RUN,
        abortController: ABORT_CONTROLLER,
        app: APP,
        extension: EXTENSION,
        appWatcher: new AppEventWatcher(APP),
      }),
    )
    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    // Then
    expect(runFunction).toHaveBeenCalledOnce()
    expect(hook.lastResult?.recentFunctionRuns[0]).toEqual({...EXEC_RESPONSE, type: 'functionRun'})
  })

  test('file watcher onChange re-runs function', async () => {
    // Given
    vi.mocked(runFunction)
      .mockImplementationOnce(runFunctionMockImplementation(EXEC_RESPONSE))
      .mockImplementationOnce(runFunctionMockImplementation(SECOND_EXEC_RESPONSE))
    const appWatcher = new AppEventWatcher(APP)
    const event = {extensionEvents: [{type: EventType.Updated, extension: EXTENSION}]}

    // When
    const hook = renderHook(() =>
      useFunctionWatcher({
        selectedRun: SELECTED_RUN,
        abortController: ABORT_CONTROLLER,
        app: APP,
        extension: EXTENSION,
        appWatcher,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    expect(hook.lastResult?.recentFunctionRuns[0]).toEqual({...EXEC_RESPONSE, type: 'functionRun'})
    expect(hook.lastResult?.recentFunctionRuns[1]).toEqual({...EXEC_RESPONSE, type: 'functionRun'})

    appWatcher.emit('all', event)
    await vi.advanceTimersByTimeAsync(0)

    expect(hook.lastResult?.recentFunctionRuns[0]).toEqual({...SECOND_EXEC_RESPONSE, type: 'functionRun'})
    expect(hook.lastResult?.recentFunctionRuns[1]).toEqual({...EXEC_RESPONSE, type: 'functionRun'})

    // Then
    expect(runFunction).toHaveBeenCalledTimes(2)
  })

  test('renders error in onReloadAndBuildError', async () => {
    // Given
    const expectedError = new Error('error!')
    vi.mocked(runFunction).mockImplementationOnce(runFunctionMockImplementation(EXEC_RESPONSE))
    const appWatcher = new AppEventWatcher(APP)
    const event = {
      extensionEvents: [
        {type: EventType.Updated, extension: EXTENSION, buildResult: {status: 'error', error: expectedError.message}},
      ],
    }

    // When
    const hook = renderHook(() =>
      useFunctionWatcher({
        selectedRun: SELECTED_RUN,
        abortController: ABORT_CONTROLLER,
        app: APP,
        extension: EXTENSION,
        appWatcher,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    appWatcher.emit('all', event)
    await vi.advanceTimersByTimeAsync(0)

    // Then
    expect(runFunction).toHaveBeenCalledOnce()
    expect(hook.lastResult?.error).toEqual('Error while reloading and building extension: error!')
  })
})

function renderHook<THookResult>(renderHookCallback: () => THookResult) {
  const result: {
    lastResult: THookResult | undefined
  } = {
    lastResult: undefined,
  }

  const MockComponent = () => {
    const hookResult = renderHookCallback()
    result.lastResult = hookResult

    return null
  }

  render(<MockComponent />)

  return result
}

function runFunctionMockImplementation(output: unknown): typeof runFunction {
  return async (options) => {
    if (options.stdout instanceof Writable) {
      options.stdout.write(JSON.stringify(output))
    }
  }
}
