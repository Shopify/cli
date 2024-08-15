import {setupExtensionWatcherForReplay} from './extension-watcher.js'
import {FunctionRunData} from '../../../replay.js'
import {testApp, testFunctionExtension} from '../../../../../models/app/app.test-data.js'
import {setupExtensionWatcher} from '../../../../dev/extension/bundler.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {renderFatalError} from '@shopify/cli-kit/node/ui'

import {render} from '@shopify/cli-kit/node/testing/ui'
import {test, describe, vi, beforeEach, afterEach, expect} from 'vitest'
import React from 'react'
import * as system from '@shopify/cli-kit/node/system'
import {outputWarn} from '@shopify/cli-kit/node/output'

vi.mock('fs')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('../generate-schema.js')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('../../../../dev/extension/bundler.js')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

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
    const selectedRun = SELECTED_RUN
    const abortController = new AbortController()
    const app = testApp()
    const extension = await testFunctionExtension({config: defaultConfig})

    const execSpy = vi.spyOn(system, 'exec')
    const mockExecFn = vi.fn().mockImplementation((_a, _b, {_cwd, _input, stdout, _stderr}) => {
      stdout.write(JSON.stringify(EXEC_RESPONSE))
      return EXEC_RESPONSE
    })
    execSpy.mockImplementationOnce(mockExecFn)

    // When
    const hook = renderHook(() =>
      setupExtensionWatcherForReplay({
        selectedRun,
        abortController,
        app,
        extension,
      }),
    )
    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    // Then
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expect(execSpy).toHaveBeenCalledOnce()
    // {logs, isAborted, canUseShortcuts, statusMessage, recentFunctionRuns, error}
    expect(hook.lastResult?.recentFunctionRuns[0]).toEqual({...EXEC_RESPONSE, type: 'functionRun'})
  })

  test('file watcher onChange re-runs function', async () => {
    // Given
    const selectedRun = SELECTED_RUN
    const abortController = new AbortController()
    const app = testApp()
    const extension = await testFunctionExtension({config: defaultConfig})

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
      setupExtensionWatcherForReplay({
        selectedRun,
        abortController,
        app,
        extension,
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
    // data needed for invoking
    const selectedRun = SELECTED_RUN
    const abortController = new AbortController()
    const app = testApp()
    const extension = await testFunctionExtension({config: defaultConfig})

    // data to trigger the build error
    const expectedError = new AbortError('abort!')

    const execSpy = vi.spyOn(system, 'exec')
    const mockExecFn = vi.fn().mockImplementation((_a, _b, {_cwd, _input, stdout, _stderr}) => {
      stdout.write(JSON.stringify(EXEC_RESPONSE))
      return EXEC_RESPONSE
    })
    execSpy.mockImplementationOnce(mockExecFn)

    // When
    renderHook(() =>
      setupExtensionWatcherForReplay({
        selectedRun,
        abortController,
        app,
        extension,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    const alexMocked = vi.mocked(setupExtensionWatcher)
    await alexMocked.mock.calls[0]![0].onReloadAndBuildError(expectedError)

    // Then
    expect(execSpy).toHaveBeenCalledOnce()
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expect(renderFatalError).toHaveBeenCalledWith(expectedError)
  })

  test('outputs non-fatal error in onReloadAndBuildError', async () => {
    // data needed for invoking
    const selectedRun = SELECTED_RUN
    const abortController = new AbortController()
    const app = testApp()
    const extension = await testFunctionExtension({config: defaultConfig})

    // data to trigger the build error
    const expectedError = new Error('non-fatal error')

    const execSpy = vi.spyOn(system, 'exec')
    const mockExecFn = vi.fn().mockImplementation((_a, _b, {_cwd, _input, stdout, _stderr}) => {
      stdout.write(JSON.stringify(EXEC_RESPONSE))
      return EXEC_RESPONSE
    })
    execSpy.mockImplementationOnce(mockExecFn)

    // When
    renderHook(() =>
      setupExtensionWatcherForReplay({
        selectedRun,
        abortController,
        app,
        extension,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    await vi.mocked(setupExtensionWatcher).mock.calls[0]![0].onReloadAndBuildError(expectedError)

    // Then
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expect(outputWarn).toHaveBeenCalledWith(`Failed to replay function: ${expectedError.message}`)
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
