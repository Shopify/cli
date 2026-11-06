import {useFunctionWatcher} from './useFunctionWatcher.js'
import {FunctionRunData} from '../../../../replay.js'
import {watchReplay, ReplayWatchEvent} from '../../../../replay/watch.js'
import {testAppLinked, testFunctionExtension} from '../../../../../../models/app/app.test-data.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import * as localContext from '@shopify/cli-kit/node/context/local'
import {treeKill} from '@shopify/cli-kit/node/tree-kill'
import {render} from '@shopify/cli-kit/node/testing/ui'
import {test, vi, expect, onTestFinished} from 'vitest'
import React from 'react'

vi.mock('../../../../replay/watch.js')
vi.mock('@shopify/cli-kit/node/tree-kill')

test('maps replay events to text logs, status, and the two most recent runs', async () => {
  const {renderHook, emit, nativeResult, options} = await fixture()
  const hook = renderHook()
  await vi.waitFor(() => expect(watchReplay).toHaveBeenCalledOnce())
  expect(watchReplay).toHaveBeenCalledWith({
    ...options,
    abortController: expect.any(AbortController),
    onEvent: expect.any(Function),
  })
  expect(hook.lastResult?.recentFunctionRuns[0].instructions).toBe(options.selectedRun.payload.fuelConsumed)
  emit({type: 'status', status: 'watching'})
  emit({type: 'status', status: 'running'})
  await vi.waitFor(() => expect(hook.lastResult?.statusMessage).toBe('Replaying log with local function...'))
  emit({type: 'diagnostic', message: 'Runner warning'})
  emit({type: 'execution', resultJson: JSON.stringify(nativeResult), exitCode: 0})
  await vi.waitFor(() => expect(hook.lastResult?.statusMessage).toBe('Watching for changes to product-discount...'))
  emit({type: 'status', status: 'running'})
  await vi.waitFor(() => expect(hook.lastResult?.statusMessage).toBe('Re-running with latest changes...'))
  const failedResult = {...nativeResult, instructions: 10, output: null, success: false}
  emit({type: 'execution', resultJson: JSON.stringify(failedResult), exitCode: 1})
  await vi.waitFor(() =>
    expect(hook.lastResult?.recentFunctionRuns).toEqual([
      {...failedResult, type: 'functionRun'},
      {...nativeResult, type: 'functionRun'},
    ]),
  )
  expect(hook.lastResult?.logs).toEqual([
    {type: 'systemMessage', message: 'Runner warning'},
    {...nativeResult, type: 'functionRun'},
    {...failedResult, type: 'functionRun'},
  ])
  expect(hook.lastResult?.statusMessage).toBe('Watching for changes to product-discount...')
  expect(hook.lastResult?.error).toBeUndefined()
  hook.rerender()
  await vi.runOnlyPendingTimersAsync()
  expect(watchReplay).toHaveBeenCalledOnce()
})

test('keeps build errors until the next successful build, even when an older execution finishes', async () => {
  const {renderHook, emit, nativeResult} = await fixture()
  const hook = renderHook()
  await vi.waitFor(() => expect(watchReplay).toHaveBeenCalledOnce())
  emit({type: 'build', status: 'failed', error: 'Build failed'})
  await vi.waitFor(() =>
    expect(hook.lastResult?.error).toBe('Error while reloading and building extension: Build failed'),
  )
  emit({type: 'execution', resultJson: JSON.stringify(nativeResult), exitCode: 0})
  await vi.waitFor(() => expect(hook.lastResult?.logs).toHaveLength(1))
  expect(hook.lastResult?.error).toBe('Error while reloading and building extension: Build failed')
  emit({type: 'build', status: 'success'})
  await vi.waitFor(() => expect(hook.lastResult?.error).toBeUndefined())
})

test.each([new Error('Watch failed'), 'Watch failed'])('exits the UI on fatal rejection: %s', async (error) => {
  const {renderHook, options} = await fixture()
  vi.mocked(watchReplay).mockRejectedValue(error)
  const hook = renderHook()
  await expect(hook.waitUntilExit()).rejects.toThrow('Watch failed')
  expect(options.abortController.signal.reason).toBeInstanceOf(Error)
  if (error instanceof Error) expect(options.abortController.signal.reason).toBe(error)
  expect(hook.lastResult?.logs).toEqual([])
})

test.each(['cancelled', 'unmounted'])('ignores a shared-loop rejection after the effect is %s', async (state) => {
  const {renderHook, options} = await fixture()
  let rejectWatch!: (error: Error) => void
  vi.mocked(watchReplay).mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectWatch = reject
      }),
  )
  const hook = renderHook()
  await vi.waitFor(() => expect(watchReplay).toHaveBeenCalledOnce())
  if (state === 'cancelled') options.abortController.abort()
  else hook.unmount()
  rejectWatch(new Error('Late watch failure'))
  await expect(hook.waitUntilExit()).resolves.toBeUndefined()
  expect(options.abortController.signal.aborted).toBe(state === 'cancelled')
  expect(options.abortController.signal.reason?.message).not.toBe('Late watch failure')
})

test.each([false, true])('keeps the delayed shutdown exit code when fatal is %s', async (fatal) => {
  const {renderHook, options} = await fixture()
  const isUnitTest = vi.spyOn(localContext, 'isUnitTest').mockReturnValue(false)
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  onTestFinished(() => {
    isUnitTest.mockRestore()
    exit.mockRestore()
  })
  const hook = renderHook()
  await vi.waitFor(() => expect(watchReplay).toHaveBeenCalledOnce())
  options.abortController.abort(fatal ? new Error('Watch failed') : undefined)
  if (fatal) await expect(hook.waitUntilExit()).rejects.toThrow('Watch failed')
  else await expect(hook.waitUntilExit()).resolves.toBeUndefined()
  await vi.advanceTimersByTimeAsync(1999)
  expect(treeKill).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(treeKill).toHaveBeenCalledWith(process.pid, 'SIGINT', false, expect.any(Function))
  vi.mocked(treeKill).mock.calls[0]![3]!()
  expect(exit).toHaveBeenCalledWith(fatal ? 1 : 0)
})

test.each([false, true])('forwards parent cancellation when already aborted is %s', async (alreadyAborted) => {
  const {renderHook, options} = await fixture()
  if (alreadyAborted) options.abortController.abort()
  renderHook()
  await vi.waitFor(() => expect(watchReplay).toHaveBeenCalledOnce())
  const signal = vi.mocked(watchReplay).mock.calls[0]![0].abortController.signal
  expect(signal).not.toBe(options.abortController.signal)
  expect(signal.aborted).toBe(alreadyAborted)
  options.abortController.abort()
  expect(signal.aborted).toBe(true)
})

test('aborts only its own loop and removes the parent listener on unmount', async () => {
  const {renderHook, options} = await fixture()
  const removeEventListener = vi.spyOn(options.abortController.signal, 'removeEventListener')
  const hook = renderHook()
  await vi.waitFor(() => expect(watchReplay).toHaveBeenCalledOnce())
  const {abortController} = vi.mocked(watchReplay).mock.calls[0]![0]
  hook.unmount()
  expect(abortController.signal.aborted).toBe(true)
  expect(options.abortController.signal.aborted).toBe(false)
  expect(removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function))
})

async function fixture() {
  const options = {
    selectedRun: {
      payload: {input: {}, output: {}, logs: '', fuelConsumed: 20},
      source: 'product-discount',
    } as FunctionRunData,
    abortController: new AbortController(),
    app: testAppLinked(),
    extension: await testFunctionExtension(),
  }
  const nativeResult = {
    input: {},
    output: {},
    logs: '',
    name: 'function',
    size: 0,
    memory_usage: 0,
    instructions: 30,
    success: true,
  }
  vi.mocked(watchReplay).mockResolvedValue(undefined)
  vi.useFakeTimers()
  let hook: {unmount: () => void} | undefined
  onTestFinished(async () => {
    hook?.unmount()
    await vi.runOnlyPendingTimersAsync()
    vi.useRealTimers()
  })
  return {
    options,
    nativeResult,
    emit: (event: ReplayWatchEvent) => vi.mocked(watchReplay).mock.calls[0]![0].onEvent(event),
    renderHook: () => {
      const result: {lastResult: ReturnType<typeof useFunctionWatcher> | undefined} = {lastResult: undefined}
      const MockComponent = () => {
        result.lastResult = useFunctionWatcher(options)
        return null
      }
      const instance = render(<MockComponent />)
      hook = instance
      return {
        get lastResult() {
          return result.lastResult
        },
        unmount: instance.unmount,
        waitUntilExit: instance.waitUntilExit,
        rerender: () => instance.rerender(<MockComponent />),
      }
    },
  }
}
