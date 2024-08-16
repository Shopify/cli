import {useFunctionWatcher} from './useFunctionWatcher.js'
import {FunctionRunData} from '../../../replay.js'
import {testApp, testFunctionExtension} from '../../../../../models/app/app.test-data.js'
import {setupExtensionWatcher} from '../../../../dev/extension/bundler.js'
import {Replay} from '../Replay.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {render, sendInputAndWait, waitForInputsToBeReady} from '@shopify/cli-kit/node/testing/ui'
import {outputWarn} from '@shopify/cli-kit/node/output'
import * as ui from '@shopify/cli-kit/node/ui'
import * as system from '@shopify/cli-kit/node/system'

import {test, describe, vi, beforeEach, afterEach, expect} from 'vitest'
import React from 'react'

vi.mock('fs')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('../generate-schema.js')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('../../../../dev/extension/bundler.js')
vi.mock('@shopify/cli-kit/node/output')

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
const APP = testApp()
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

describe('setupExtensionWatcherForReplay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  test('runs function once in watch mode without changes', async () => {
    // Given
    const execSpy = vi.spyOn(system, 'exec')
    const mockExecFn = vi.fn().mockImplementation((_a, _b, {_cwd, _input, stdout, _stderr}) => {
      stdout.write(JSON.stringify(EXEC_RESPONSE))
      return EXEC_RESPONSE
    })
    execSpy.mockImplementationOnce(mockExecFn)

    // When
    const hook = renderHook(() =>
      useFunctionWatcher({
        selectedRun: SELECTED_RUN,
        abortController: ABORT_CONTROLLER,
        app: APP,
        extension: EXTENSION,
      }),
    )
    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    // Then
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expect(execSpy).toHaveBeenCalledOnce()
    expect(hook.lastResult?.recentFunctionRuns[0]).toEqual({...EXEC_RESPONSE, type: 'functionRun'})
  })

  test('file watcher onChange re-runs function', async () => {
    // Given
    const execSpy = vi.spyOn(system, 'exec')
    const mockExecFnFirst = vi.fn().mockImplementation((_a, _b, {_cwd, _input, stdout, _stderr}) => {
      stdout.write(JSON.stringify(EXEC_RESPONSE))
      return EXEC_RESPONSE
    })
    const mockExecFnSecond = vi.fn().mockImplementation((_a, _b, {_cwd, _input, stdout, _stderr}) => {
      stdout.write(JSON.stringify(SECOND_EXEC_RESPONSE))
      return SECOND_EXEC_RESPONSE
    })
    execSpy.mockImplementationOnce(mockExecFnFirst).mockImplementationOnce(mockExecFnSecond)

    // When
    const hook = renderHook(() =>
      useFunctionWatcher({
        selectedRun: SELECTED_RUN,
        abortController: ABORT_CONTROLLER,
        app: APP,
        extension: EXTENSION,
      }),
    )
    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    expect(hook.lastResult?.recentFunctionRuns[0]).toEqual({...EXEC_RESPONSE, type: 'functionRun'})

    await vi.mocked(setupExtensionWatcher).mock.calls[0]![0].onChange()

    expect(hook.lastResult?.recentFunctionRuns[0]).toEqual({...SECOND_EXEC_RESPONSE, type: 'functionRun'})
    expect(hook.lastResult?.recentFunctionRuns[1]).toEqual({...EXEC_RESPONSE, type: 'functionRun'})

    // Then
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expect(execSpy).toHaveBeenCalledTimes(2)
  })

  test('renders fatal error in onReloadAndBuildError', async () => {
    // Given
    const rfeSpy = vi.spyOn(ui, 'renderFatalError')
    const expectedError = new AbortError('abort!')

    const execSpy = vi.spyOn(system, 'exec')
    const mockExecFn = vi.fn().mockImplementation((_a, _b, {_cwd, _input, stdout, _stderr}) => {
      stdout.write(JSON.stringify(EXEC_RESPONSE))
      return EXEC_RESPONSE
    })
    execSpy.mockImplementationOnce(mockExecFn)

    // When
    renderHook(() =>
      useFunctionWatcher({
        selectedRun: SELECTED_RUN,
        abortController: ABORT_CONTROLLER,
        app: APP,
        extension: EXTENSION,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    await vi.mocked(setupExtensionWatcher).mock.calls[0]![0].onReloadAndBuildError(expectedError)

    // Then
    expect(execSpy).toHaveBeenCalledOnce()
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expect(rfeSpy).toHaveBeenCalledWith(expectedError)
  })

  test('outputs non-fatal error in onReloadAndBuildError', async () => {
    // Given
    const expectedError = new Error('non-fatal error')

    const execSpy = vi.spyOn(system, 'exec')
    const mockExecFn = vi.fn().mockImplementation((_a, _b, {_cwd, _input, stdout, _stderr}) => {
      stdout.write(JSON.stringify(EXEC_RESPONSE))
      return EXEC_RESPONSE
    })
    execSpy.mockImplementationOnce(mockExecFn)

    // When
    renderHook(() =>
      useFunctionWatcher({
        selectedRun: SELECTED_RUN,
        abortController: ABORT_CONTROLLER,
        app: APP,
        extension: EXTENSION,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    await vi.mocked(setupExtensionWatcher).mock.calls[0]![0].onReloadAndBuildError(expectedError)

    // Then
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expect(outputWarn).toHaveBeenCalledWith(`Failed to replay function: ${expectedError.message}`)
  })

  test('quits when q is pressed', async () => {
    vi.useRealTimers()

    // Given
    const abortController = new AbortController()
    const abortSpy = vi.spyOn(abortController, 'abort')
    const extension = await testFunctionExtension()

    const execSpy = vi.spyOn(system, 'exec')
    const mockExecFn = vi.fn().mockImplementation((_a, _b, {_cwd, _input, stdout, _stderr}) => {
      stdout.write(JSON.stringify(EXEC_RESPONSE))
      return EXEC_RESPONSE
    })
    execSpy.mockImplementationOnce(mockExecFn)

    const renderInstanceReplay = render(
      <Replay selectedRun={SELECTED_RUN} abortController={abortController} app={testApp()} extension={extension} />,
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
    vi.useRealTimers()

    // Given
    const abortController = new AbortController()
    const abortSpy = vi.spyOn(abortController, 'abort')
    const extension = await testFunctionExtension()

    const execSpy = vi.spyOn(system, 'exec')
    const mockExecFn = vi.fn().mockImplementation((_a, _b, {_cwd, _input, stdout, _stderr}) => {
      stdout.write(JSON.stringify(EXEC_RESPONSE))
      return EXEC_RESPONSE
    })
    execSpy.mockImplementationOnce(mockExecFn)

    const renderInstanceReplay = render(
      <Replay selectedRun={SELECTED_RUN} abortController={abortController} app={testApp()} extension={extension} />,
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
