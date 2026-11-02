import {useFunctionWatcher} from './useFunctionWatcher.js'
import {FunctionRunData} from '../../../../replay.js'
import {testAppLinked, testFunctionExtension} from '../../../../../../models/app/app.test-data.js'
import {captureFunctionRun, FunctionExecution} from '../../../../runner.js'
import {AppEventWatcher, EventType} from '../../../../../dev/app-events/app-event-watcher.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {render} from '@shopify/cli-kit/node/testing/ui'
import {test, describe, vi, expect, onTestFinished} from 'vitest'
import React from 'react'

vi.mock('../../../../runner.js')

describe('useFunctionWatcher', () => {
  test('waits for watcher readiness, executes the selected log, and returns to watching', async () => {
    const context = await fixture()
    let finishStartup!: () => void
    context.startWatcher.mockReturnValue(
      new Promise<void>((resolve) => {
        finishStartup = resolve
      }),
    )
    let finishExecution!: (execution: FunctionExecution) => void
    vi.mocked(captureFunctionRun).mockReturnValueOnce(
      new Promise<FunctionExecution>((resolve) => {
        finishExecution = resolve
      }),
    )
    const hook = context.render()

    await vi.waitFor(() => expect(context.startWatcher).toHaveBeenCalledOnce())
    expect(captureFunctionRun).not.toHaveBeenCalled()
    expect(hook.lastResult?.statusMessage).toBe('Watching for changes to product-discount...')

    finishStartup()
    await vi.waitFor(() => expect(hook.lastResult?.statusMessage).toBe('Replaying log with local function...'))
    expect(captureFunctionRun).toHaveBeenCalledWith({
      functionExtension: context.extension,
      input: JSON.stringify(context.selectedRun.payload.input),
      export: context.selectedRun.payload.export,
      json: true,
    })

    finishExecution(context.execution)
    await vi.waitFor(() => expect(hook.lastResult?.logs).toEqual([{...context.nativeResult, type: 'functionRun'}]))
    expect(hook.lastResult?.recentFunctionRuns[0]).toEqual({...context.nativeResult, type: 'functionRun'})
    expect(hook.lastResult?.recentFunctionRuns[1]).toMatchObject({
      instructions: context.selectedRun.payload.fuelConsumed,
    })
    expect(hook.lastResult?.statusMessage).toBe('Watching for changes to product-discount...')
    expect(hook.lastResult?.error).toBeUndefined()
  })

  test('replays rebuilds and keeps the two most recent runs for instruction statistics', async () => {
    const context = await fixture()
    const hook = context.render()
    await vi.waitFor(() => expect(hook.lastResult?.logs).toHaveLength(1))

    const updatedResult = {...context.nativeResult, size: 1, memory_usage: 1, instructions: 532800}
    let finishExecution!: (execution: FunctionExecution) => void
    vi.mocked(captureFunctionRun).mockReturnValueOnce(
      new Promise<FunctionExecution>((resolve) => {
        finishExecution = resolve
      }),
    )
    context.update()
    await vi.waitFor(() => expect(hook.lastResult?.statusMessage).toBe('Re-running with latest changes...'))

    finishExecution({...context.execution, resultJson: JSON.stringify(updatedResult)})
    await vi.waitFor(() =>
      expect(hook.lastResult?.recentFunctionRuns).toEqual([
        {...updatedResult, type: 'functionRun'},
        {...context.nativeResult, type: 'functionRun'},
      ]),
    )
    expect(hook.lastResult?.logs).toEqual([
      {...context.nativeResult, type: 'functionRun'},
      {...updatedResult, type: 'functionRun'},
    ])
    expect(hook.lastResult?.statusMessage).toBe('Watching for changes to product-discount...')
    expect(captureFunctionRun).toHaveBeenCalledTimes(2)
  })

  test('shows build failures without running and clears the error after a successful rebuild', async () => {
    const context = await fixture()
    const hook = context.render()
    await vi.waitFor(() => expect(hook.lastResult?.logs).toHaveLength(1))
    const previousRuns = hook.lastResult?.recentFunctionRuns

    context.update('Build failed')
    await vi.waitFor(() =>
      expect(hook.lastResult?.error).toBe('Error while reloading and building extension: Build failed'),
    )
    expect(captureFunctionRun).toHaveBeenCalledOnce()
    expect(hook.lastResult?.recentFunctionRuns).toEqual(previousRuns)
    expect(hook.lastResult?.logs).toHaveLength(1)

    context.update()
    await vi.waitFor(() => expect(hook.lastResult?.logs).toHaveLength(2))
    expect(hook.lastResult?.error).toBeUndefined()
    expect(hook.lastResult?.statusMessage).toBe('Watching for changes to product-discount...')
    expect(captureFunctionRun).toHaveBeenCalledTimes(2)
  })

  test('keeps a newer build error when an older execution finishes', async () => {
    const context = await fixture()
    const hook = context.render()
    await vi.waitFor(() => expect(hook.lastResult?.logs).toHaveLength(1))
    let finishExecution!: (execution: FunctionExecution) => void
    vi.mocked(captureFunctionRun).mockReturnValueOnce(
      new Promise<FunctionExecution>((resolve) => {
        finishExecution = resolve
      }),
    )

    context.update()
    await vi.waitFor(() => expect(hook.lastResult?.statusMessage).toBe('Re-running with latest changes...'))
    context.update('Newer build failed')
    await vi.waitFor(() =>
      expect(hook.lastResult?.error).toBe('Error while reloading and building extension: Newer build failed'),
    )

    finishExecution(context.execution)
    await vi.waitFor(() => expect(hook.lastResult?.logs).toHaveLength(2))
    expect(hook.lastResult?.error).toBe('Error while reloading and building extension: Newer build failed')
    expect(captureFunctionRun).toHaveBeenCalledTimes(2)
  })

  test('keeps build output and runner diagnostics in the text log before the execution', async () => {
    const context = await fixture()
    context.startWatcher.mockImplementation(async (options) => {
      options?.stdout?.write('Build output')
      options?.stderr?.write('Build warning')
    })
    vi.mocked(captureFunctionRun).mockResolvedValue({...context.execution, diagnostics: ['Runner warning']})
    const hook = context.render()

    await vi.waitFor(() =>
      expect(hook.lastResult?.logs).toEqual([
        {type: 'systemMessage', message: 'Build output'},
        {type: 'systemMessage', message: 'Build warning'},
        {type: 'systemMessage', message: 'Runner warning'},
        {...context.nativeResult, type: 'functionRun'},
      ]),
    )
  })

  test('shows a native unsuccessful result without treating it as a fatal runner error', async () => {
    const context = await fixture()
    const nativeResult = {...context.nativeResult, output: null, success: false}
    vi.mocked(captureFunctionRun).mockResolvedValue({
      ...context.execution,
      resultJson: JSON.stringify(nativeResult),
      exitCode: 1,
    })
    const hook = context.render()

    await vi.waitFor(() => expect(hook.lastResult?.logs).toEqual([{...nativeResult, type: 'functionRun'}]))
    expect(hook.lastResult?.error).toBeUndefined()
    expect(hook.lastResult?.statusMessage).toBe('Watching for changes to product-discount...')
    expect(context.abortController.signal.aborted).toBe(false)
  })

  test.each([new Error('Watcher startup failed'), 'Watcher startup failed'])(
    'catches a fatal watcher startup rejection: %s',
    async (error) => {
      const context = await fixture()
      context.startWatcher.mockRejectedValue(error)
      const hook = context.render()

      await vi.waitFor(() => expect(hook.lastResult?.error).toBe('Watcher startup failed'))
      expect(captureFunctionRun).not.toHaveBeenCalled()
      expect(context.watchSignal()?.aborted).toBe(true)
      expect(context.abortController.signal.aborted).toBe(false)
    },
  )

  test('catches fatal runner failures', async () => {
    const context = await fixture()
    vi.mocked(captureFunctionRun).mockRejectedValue(new Error('Runner failed'))
    const hook = context.render()

    await vi.waitFor(() => expect(hook.lastResult?.error).toBe('Runner failed'))
    expect(hook.lastResult?.logs).toEqual([])
    expect(context.watchSignal()?.aborted).toBe(true)
    expect(context.abortController.signal.aborted).toBe(false)
  })

  test('catches fatal watcher errors after the initial execution', async () => {
    const context = await fixture()
    const hook = context.render()
    await vi.waitFor(() => expect(hook.lastResult?.logs).toHaveLength(1))

    context.watcher().emit('error', new Error('Watcher failed'))

    await vi.waitFor(() => expect(hook.lastResult?.error).toBe('Watcher failed'))
    expect(captureFunctionRun).toHaveBeenCalledOnce()
    expect(context.watchSignal()?.aborted).toBe(true)
    expect(context.abortController.signal.aborted).toBe(false)
  })

  test('does not restart the shared loop when the hook re-renders', async () => {
    const context = await fixture()
    const hook = context.render()
    await vi.waitFor(() => expect(hook.lastResult?.logs).toHaveLength(1))

    hook.rerender()
    await vi.runOnlyPendingTimersAsync()

    expect(context.startWatcher).toHaveBeenCalledOnce()
    expect(captureFunctionRun).toHaveBeenCalledOnce()
    expect(context.abortController.signal.aborted).toBe(false)
  })

  test('does not start watching or executing when the parent is already aborted', async () => {
    const context = await fixture()
    context.abortController.abort()
    const hook = context.render()

    await vi.advanceTimersByTimeAsync(10)
    await vi.runOnlyPendingTimersAsync()

    expect(context.startWatcher).not.toHaveBeenCalled()
    expect(captureFunctionRun).not.toHaveBeenCalled()
    expect(hook.lastResult?.logs).toEqual([])
    expect(hook.lastResult?.error).toBeUndefined()
  })

  test('forwards parent cancellation to the shared loop', async () => {
    const context = await fixture()
    const hook = context.render()
    await vi.waitFor(() => expect(hook.lastResult?.logs).toHaveLength(1))

    context.abortController.abort()
    await vi.runOnlyPendingTimersAsync()

    expect(context.watchSignal()?.aborted).toBe(true)
    context.update()
    await vi.runOnlyPendingTimersAsync()
    expect(captureFunctionRun).toHaveBeenCalledOnce()
  })

  test('aborts the shared loop on unmount and discards an in-flight execution', async () => {
    const context = await fixture()
    const removeEventListener = vi.spyOn(context.abortController.signal, 'removeEventListener')
    let finishExecution!: (execution: FunctionExecution) => void
    vi.mocked(captureFunctionRun).mockReturnValueOnce(
      new Promise<FunctionExecution>((resolve) => {
        finishExecution = resolve
      }),
    )
    const hook = context.render()
    await vi.waitFor(() => expect(captureFunctionRun).toHaveBeenCalledOnce())

    hook.unmount()
    await vi.runOnlyPendingTimersAsync()

    expect(context.abortController.signal.aborted).toBe(false)
    expect(context.watchSignal()?.aborted).toBe(true)
    expect(removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function))
    finishExecution(context.execution)
    context.update()
    await vi.runOnlyPendingTimersAsync()
    expect(hook.lastResult?.logs).toEqual([])
    expect(captureFunctionRun).toHaveBeenCalledOnce()
  })
})

async function fixture() {
  const selectedRun = {
    payload: {
      export: 'run',
      input: {someInput: 'someInput'},
      output: {someOutput: 'someOutput'},
      logs: 'First log\nSecond log',
      fuelConsumed: 532632,
    },
    source: 'product-discount',
  } as FunctionRunData
  const abortController = new AbortController()
  const app = testAppLinked()
  const extension = await testFunctionExtension()
  const nativeResult = {
    input: selectedRun.payload.input,
    output: selectedRun.payload.output,
    logs: selectedRun.payload.logs,
    name: selectedRun.source,
    size: 0,
    memory_usage: 0,
    instructions: 532700,
    success: true,
  }
  const execution = {
    state: 'completed',
    resultJson: JSON.stringify(nativeResult),
    exitCode: 0,
    diagnostics: [],
  } satisfies FunctionExecution
  const startWatcher = vi.spyOn(AppEventWatcher.prototype, 'start').mockResolvedValue(undefined)
  vi.mocked(captureFunctionRun).mockResolvedValue(execution)
  vi.useFakeTimers()

  let hook: {unmount: () => void} | undefined
  onTestFinished(async () => {
    hook?.unmount()
    await vi.runOnlyPendingTimersAsync()
    vi.clearAllTimers()
    vi.useRealTimers()
    startWatcher.mockRestore()
  })

  const watcher = () => startWatcher.mock.instances[0] as AppEventWatcher
  return {
    selectedRun,
    abortController,
    extension,
    nativeResult,
    execution,
    startWatcher,
    watcher,
    watchSignal: () => startWatcher.mock.calls[0]?.[0]?.signal,
    update: (error?: string) =>
      watcher().emit('all', {
        extensionEvents: [
          {
            type: EventType.Updated,
            extension,
            buildResult: error ? {status: 'error', error} : {status: 'ok'},
          },
        ],
      }),
    render: () => {
      const rendered = renderHook(() => useFunctionWatcher({selectedRun, abortController, app, extension}))
      hook = rendered
      return rendered
    },
  }
}

function renderHook<THookResult>(renderHookCallback: () => THookResult) {
  const result: {lastResult: THookResult | undefined} = {lastResult: undefined}
  const MockComponent = () => {
    result.lastResult = renderHookCallback()
    return null
  }
  const instance = render(<MockComponent />)

  return {
    get lastResult() {
      return result.lastResult
    },
    unmount: instance.unmount,
    rerender: () => instance.rerender(<MockComponent />),
  }
}
