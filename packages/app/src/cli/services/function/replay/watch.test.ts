import {watchReplay} from './watch.js'
import {functionReplayEventSchema} from './types.js'
import {captureFunctionRun, type FunctionExecution} from '../runner.js'
import {type FunctionRunData} from '../replay.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AppEventWatcher, EventType} from '../../dev/app-events/app-event-watcher.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEvents, renderCommandEventAsJson} from '@shopify/cli-kit/node/command-events'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import {handler} from '@shopify/cli-kit/node/error'
import {expect, test, vi} from 'vitest'

vi.mock('../runner.js')

const nativeResult = {
  name: 'function.wasm',
  size: 1,
  memory_usage: 64,
  instructions: 1000,
  logs: 'first\nsecond',
  input: {native_key: true},
  output: {operations: []},
  success: true,
}

function execution(resultJson = JSON.stringify(nativeResult), exitCode = 0): FunctionExecution {
  return {state: 'completed', resultJson, exitCode, diagnostics: ['Runner diagnostic']}
}

async function fixture(directory: string) {
  const app = testAppLinked({directory})
  const extension = await testFunctionExtension({dir: directory})
  const abortController = new AbortController()
  const startWatcher = vi.spyOn(AppEventWatcher.prototype, 'start').mockResolvedValue(undefined)
  const stop = vi.spyOn(AppEventWatcher.prototype, 'stop').mockImplementation(async function (this: AppEventWatcher) {
    this.removeAllListeners()
  })
  const selectedRun = {payload: {input: nativeResult.input, export: 'run'}} as FunctionRunData
  const start = () =>
    runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () =>
      watchReplay({app, extension, abortController, selectedRun}),
    )
  const update = (error?: string) => {
    runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () =>
      (startWatcher.mock.instances[0] as AppEventWatcher).emit('all', {
        extensionEvents: [
          {
            extension,
            type: EventType.Updated,
            buildResult: error ? {status: 'error', error} : {status: 'ok'},
          },
        ],
      }),
    )
  }
  return {abortController, start, update, stop, watcher: () => startWatcher.mock.instances[0] as AppEventWatcher}
}

function records(stdout: string) {
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

test('streams startup, rebuilds, native results, and cancellation separately from diagnostics', async () => {
  await inTemporaryDirectory(async (directory) => {
    const context = await fixture(directory)
    const previousSignalListeners = process.listenerCount('shopify:signal')
    vi.mocked(captureFunctionRun).mockResolvedValue(execution())

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const running = context.start()
      try {
        await flushPromises()
        context.update()
        await flushPromises()
        context.abortController.abort()
        await running

        const events = records(stdout())
        expect(events.map(({type}) => type)).toEqual(['status', 'execution', 'build', 'execution', 'status'])
        for (const event of events) expect(() => functionReplayEventSchema.validate(event)).not.toThrow()
        expect(events[0]).toMatchObject({status: 'watching'})
        expect(events[1]).toMatchObject({result: nativeResult, exitCode: 0})
        expect(events.at(-1)).toMatchObject({status: 'cancelled'})
        expect(records(stderr())).toEqual([
          expect.objectContaining({type: 'diagnostic', message: 'Runner diagnostic'}),
          expect.objectContaining({type: 'diagnostic', message: 'Runner diagnostic'}),
        ])
        expect(stdout()).not.toContain('Runner diagnostic')
      } finally {
        context.abortController.abort()
        await running
      }
    })
    expect(context.stop).toHaveBeenCalledOnce()
    expect(context.watcher().listenerCount('all')).toBe(0)
    expect(process.listenerCount('shopify:signal')).toBe(previousSignalListeners)
  })
})

test.each([
  {signal: 'SIGINT', exitCode: 130},
  {signal: 'SIGTERM', exitCode: 143},
  {signal: 'SIGQUIT', exitCode: 131},
])('handles the CLI shutdown event for $signal and releases its listener', async ({signal, exitCode}) => {
  await inTemporaryDirectory(async (directory) => {
    const context = await fixture(directory)
    vi.mocked(captureFunctionRun).mockResolvedValue(execution())
    const previousExitCode = process.exitCode
    const previousListeners = process.listenerCount('shopify:signal')
    const processEvents: NodeJS.EventEmitter = process
    await withCapturedStandardStreams(async ({stdout}) => {
      const running = context.start()
      try {
        await flushPromises()
        expect(processEvents.emit('shopify:signal', signal)).toBe(true)
        await running
        expect(context.stop).toHaveBeenCalledOnce()
        expect(records(stdout()).at(-1)).toMatchObject({type: 'status', status: 'cancelled'})
        expect(process.exitCode).toBe(exitCode)
        expect(process.listenerCount('shopify:signal')).toBe(previousListeners)
      } finally {
        context.abortController.abort()
        await running
        // eslint-disable-next-line require-atomic-updates
        process.exitCode = previousExitCode
      }
    })
  })
})

test('preserves native numeric tokens and escaped strings inside one JSONL record', async () => {
  await inTemporaryDirectory(async (directory) => {
    const context = await fixture(directory)
    const raw = JSON.stringify(nativeResult, null, 2).replace('1000', '9007199254740993')
    vi.mocked(captureFunctionRun).mockResolvedValue(execution(raw))
    await withCapturedStandardStreams(async ({stdout}) => {
      const running = context.start()
      await flushPromises()
      context.abortController.abort()
      await running
      expect(stdout()).toContain('"instructions":9007199254740993')
      expect(records(stdout())).toHaveLength(3)
      expect(records(stdout())[1].result.logs).toBe('first\nsecond')
    })
  })
})

test('keeps watching after rebuild and completed Function failures', async () => {
  await inTemporaryDirectory(async (directory) => {
    const context = await fixture(directory)
    vi.mocked(captureFunctionRun)
      .mockResolvedValueOnce(execution(JSON.stringify({...nativeResult, success: false}), 1))
      .mockResolvedValue(execution())
    const previousExitCode = process.exitCode
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const running = context.start()
      await flushPromises()
      context.update('Compilation failed')
      await flushPromises()
      expect(captureFunctionRun).toHaveBeenCalledOnce()
      context.update()
      await flushPromises()
      context.abortController.abort()
      await running
      expect(
        records(stdout())
          .filter(({type}) => type === 'build')
          .map(({status}) => status),
      ).toEqual(['failed', 'success'])
      expect(
        records(stdout())
          .filter(({type}) => type === 'execution')
          .map(({exitCode}) => exitCode),
      ).toEqual([1, 0])
      expect(records(stderr())).toContainEqual(expect.objectContaining({level: 'error', message: 'Compilation failed'}))
      expect(process.exitCode).toBe(previousExitCode)
    })
  })
})

test('ends fatal runner failures with the shared error envelope after cleanup', async () => {
  await inTemporaryDirectory(async (directory) => {
    const context = await fixture(directory)
    vi.mocked(captureFunctionRun).mockResolvedValue({
      state: 'failed',
      message: 'Invalid runner result',
      command: '/runner',
      args: [],
      exitCode: 1,
      stderr: 'Runner failed',
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, async () => {
        try {
          await context.start()
          // The command boundary converts fatal failures through the shared handler.
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (error) {
          expect(context.stop).toHaveBeenCalledOnce()
          await handler(error)
        }
      })
      expect(records(stdout())).toEqual([
        expect.objectContaining({type: 'status', status: 'watching'}),
        {error: expect.objectContaining({type: 'external', message: 'Invalid runner result'})},
      ])
      expect(stderr()).toBe('')
    })
  })
})

test('cancels an active execution and waits for it before returning', async () => {
  await inTemporaryDirectory(async (directory) => {
    const context = await fixture(directory)
    let rejectExecution: (error: Error) => void = () => {}
    vi.mocked(captureFunctionRun).mockImplementation(async ({signal}) => {
      return new Promise<FunctionExecution>((_resolve, reject) => {
        rejectExecution = reject
        expect(signal).toBe(context.abortController.signal)
      })
    })
    await withCapturedStandardStreams(async ({stdout}) => {
      let settled = false
      const running = context.start().then(() => {
        settled = true
      })
      await flushPromises()
      context.abortController.abort()
      context.watcher().emit('error', new Error('Build cancelled'))
      await flushPromises()
      expect(settled).toBe(false)
      rejectExecution(new Error('Runner aborted'))
      await running
      expect(records(stdout()).map(({type}) => type)).toEqual(['status', 'status'])
    })
  })
})

test('cleans up a startup failure without emitting a success record', async () => {
  await inTemporaryDirectory(async (directory) => {
    const context = await fixture(directory)
    vi.mocked(AppEventWatcher.prototype.start).mockRejectedValue(new Error('Watcher unavailable'))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(context.start()).rejects.toThrow('Watcher unavailable')
      expect(stdout()).toBe('')
    })
    expect(context.stop).toHaveBeenCalledOnce()
    expect(captureFunctionRun).not.toHaveBeenCalled()
  })
})
