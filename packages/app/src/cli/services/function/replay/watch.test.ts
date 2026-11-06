import {watchReplayJson} from './json.js'
import {watchReplay} from './watch.js'
import {functionReplayEventSchema} from './types.js'
import {type FunctionRunData} from '../replay.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {
  runWithCommandEvents,
  renderCommandEventAsJson,
  commandEventOutputMode,
} from '@shopify/cli-kit/node/command-events'
import {ExternalError, handler} from '@shopify/cli-kit/node/error'
import {expect, test, vi, onTestFinished} from 'vitest'
import {AsyncResource} from 'node:async_hooks'

vi.mock('./watch.js')

async function fixture() {
  const options = {
    app: testAppLinked(),
    extension: await testFunctionExtension(),
    abortController: new AbortController(),
    selectedRun: {payload: {input: {}, export: 'run'}} as FunctionRunData,
  }
  const previousExitCode = process.exitCode
  onTestFinished(() => {
    options.abortController.abort()
    process.exitCode = previousExitCode
  })
  return {
    options,
    start: () =>
      runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => watchReplayJson(options)),
  }
}

function records(stream: string) {
  return stream
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

test('formats watch events as JSONL and keeps diagnostics on stderr', async () => {
  const {options, start} = await fixture()
  const watcherCallback = new AsyncResource('function-replay-watcher')
  onTestFinished(() => {
    watcherCallback.emitDestroy()
  })
  const resultJson = `{
    "name": "function.wasm", "size": 1, "memory_usage": 64,
    "instructions": 9007199254740993, "logs": "first\\nsecond",
    "input": {}, "output": null, "success": false
  }`
  vi.mocked(watchReplay).mockImplementation(async ({onEvent}) => {
    watcherCallback.runInAsyncScope(() => {
      expect(commandEventOutputMode()).toBeUndefined()
      onEvent({type: 'status', status: 'watching'})
      onEvent({type: 'status', status: 'running'})
      onEvent({type: 'diagnostic', message: ' \n\t '})
      onEvent({type: 'diagnostic', message: '\u001b[31mRunner diagnostic\u001b[0m'})
      onEvent({type: 'execution', resultJson, exitCode: 1})
      onEvent({type: 'build', status: 'failed', error: 'Compilation failed'})
      onEvent({type: 'build', status: 'success'})
      onEvent({type: 'status', status: 'cancelled'})
    })
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await start()
    expect(watchReplay).toHaveBeenCalledWith({...options, onEvent: expect.any(Function)})
    const events = records(stdout())
    expect(events).toEqual([
      expect.objectContaining({type: 'status', status: 'watching'}),
      expect.objectContaining({type: 'execution', result: JSON.parse(resultJson), exitCode: 1}),
      expect.objectContaining({type: 'build', status: 'failed'}),
      expect.objectContaining({type: 'build', status: 'success'}),
      expect.objectContaining({type: 'status', status: 'cancelled'}),
    ])
    for (const event of events) expect(() => functionReplayEventSchema.validate(event)).not.toThrow()
    expect(stdout()).toContain('"instructions":9007199254740993')
    expect(events[1].result.logs).toBe('first\nsecond')
    expect(records(stderr())).toEqual([
      expect.objectContaining({type: 'diagnostic', level: 'warning', message: 'Runner diagnostic'}),
      expect.objectContaining({type: 'diagnostic', level: 'error', message: 'Compilation failed'}),
    ])
  })
})

test.each([
  {signal: 'SIGINT', exitCode: 130},
  {signal: 'SIGTERM', exitCode: 143},
  {signal: 'SIGQUIT', exitCode: 131},
])('forwards $signal to the watch loop and releases its listener', async ({signal, exitCode}) => {
  const {options, start} = await fixture()
  const previousListeners = process.listenerCount('shopify:signal')
  vi.mocked(watchReplay).mockImplementation(async ({abortController}) => {
    const processEvents: NodeJS.EventEmitter = process
    expect(processEvents.emit('shopify:signal', signal)).toBe(true)
    expect(abortController.signal.aborted).toBe(true)
  })
  await start()
  expect(options.abortController.signal.aborted).toBe(true)
  expect(process.exitCode).toBe(exitCode)
  expect(process.listenerCount('shopify:signal')).toBe(previousListeners)
})

test('propagates fatal errors to the command handler and releases its listener', async () => {
  const {start} = await fixture()
  const previousListeners = process.listenerCount('shopify:signal')
  const error = new ExternalError('Invalid runner result', '/runner', [])
  vi.mocked(watchReplay).mockRejectedValue(error)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(start()).rejects.toBe(error)
    expect(stdout()).toBe('')
    await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => handler(error))
    expect(records(stdout())).toEqual([
      {error: expect.objectContaining({type: 'external', message: 'Invalid runner result'})},
    ])
    expect(stderr()).toBe('')
  })
  expect(process.listenerCount('shopify:signal')).toBe(previousListeners)
})
