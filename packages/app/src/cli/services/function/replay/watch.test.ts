import {watchReplayJson} from './json.js'
import {type FunctionRunData} from '../replay.js'
import {captureFunctionRun, type FunctionExecution} from '../runner.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AppEventWatcher, EventType, type ExtensionEvent} from '../../dev/app-events/app-event-watcher.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEvents, renderCommandEventAsJson} from '@shopify/cli-kit/node/command-events'
import {ExternalError, handler} from '@shopify/cli-kit/node/error'
import {expect, test, vi, onTestFinished} from 'vitest'

vi.mock('../runner.js')

const resultJson = String.raw`{
  "name": "function.wasm", "size": 1, "memory_usage": 64, "instructions": 9007199254740993,
  "logs": "hello world \"quoted words\" done\nsecond", "input": {}, "output": null, "success": false
}`
const execution = (failed = false): Extract<FunctionExecution, {state: 'completed'}> => ({
  state: 'completed',
  resultJson: resultJson.replace('"success": false', `"success": ${!failed}`),
  exitCode: Number(failed),
  diagnostics: [],
})
const records = (stream: string) =>
  stream
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))

async function fixture() {
  const extension = await testFunctionExtension()
  const options = {
    app: testAppLinked(),
    extension,
    abortController: new AbortController(),
    selectedRun: {payload: {input: {value: 1}, export: 'run'}} as FunctionRunData,
  }
  const startWatcher = vi.spyOn(AppEventWatcher.prototype, 'start').mockResolvedValue(undefined)
  vi.mocked(captureFunctionRun).mockResolvedValue(execution())
  const sink = vi.fn(renderCommandEventAsJson)
  const processEvents: NodeJS.EventEmitter = process
  const signals = processEvents.listeners('shopify:signal')
  const stdoutErrors = process.stdout.listeners('error')
  const previousExitCode = process.exitCode
  let running = Promise.resolve()
  onTestFinished(() => {
    process.exitCode = previousExitCode
  })
  onTestFinished(async () => {
    options.abortController.abort()
    await running.catch(() => {})
    expect(processEvents.listeners('shopify:signal')).toEqual(signals)
    expect(process.stdout.listeners('error').every((listener) => stdoutErrors.includes(listener))).toBe(true)
    startWatcher.mockRestore()
  })
  const emit = (extensionEvents: ExtensionEvent[]) =>
    (startWatcher.mock.instances[0] as AppEventWatcher).emit('all', {extensionEvents})
  return {
    options,
    startWatcher,
    emit,
    sink,
    update: (error?: string) =>
      emit([
        {
          type: EventType.Updated,
          extension,
          buildResult: error ? {status: 'error', error, uid: extension.uid} : {status: 'ok', uid: extension.uid},
        },
      ]),
    start: () =>
      (running = runWithCommandEvents({outputMode: 'json', sink, clock: () => new Date('2026-11-09T09:00:00Z')}, () =>
        watchReplayJson(options),
      )),
  }
}

test('writes native JSONL, reports build failure once, and recovers without setting the process exit code', async () => {
  const {options, startWatcher, start, update, sink} = await fixture()
  const previousExitCode = process.exitCode
  vi.mocked(captureFunctionRun).mockResolvedValueOnce({
    ...execution(true),
    diagnostics: [' \n', '\u001b[31mRunner warning\u001b[0m'],
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    const running = start()
    await flushPromises()
    startWatcher.mock.calls[0]![0]!.stderr.write('Compilation failed')
    update('Compilation failed')
    update()
    await flushPromises()
    expect(process.exitCode).toBe(previousExitCode)
    expect(options.abortController.signal.aborted).toBe(false)
    options.abortController.abort()
    await running
    expect(records(stdout()).map(({type, status}) => status ?? type)).toEqual([
      'watching',
      'execution',
      'failed',
      'success',
      'execution',
      'cancelled',
    ])
    const outputs = records(stdout())
    expect(outputs[1].result).toEqual(JSON.parse(resultJson))
    expect(outputs[2].error).toBe('Compilation failed')
    expect(outputs[4].result.success).toBe(true)
    expect(stdout()).toContain('"instructions":9007199254740993')
    expect(records(stderr())).toEqual([
      expect.objectContaining({type: 'diagnostic', timestamp: '2026-11-09T09:00:00Z', message: 'Runner warning'}),
      expect.objectContaining({type: 'diagnostic', timestamp: '2026-11-09T09:00:00Z', message: 'Compilation failed'}),
    ])
    expect(sink).toHaveBeenCalledTimes(2)
    expect(captureFunctionRun).toHaveBeenCalledWith({
      functionExtension: options.extension,
      input: '{"value":1}',
      export: 'run',
      json: true,
      signal: options.abortController.signal,
    })
  })
})

test.each([
  {cancelled: false, rejected: false},
  {cancelled: true, rejected: false},
  {cancelled: true, rejected: true},
])('serializes executions (cancelled: $cancelled, rejected: $rejected)', async ({cancelled, rejected}) => {
  const {options, start, update} = await fixture()
  let finish!: () => void
  vi.mocked(captureFunctionRun).mockReturnValueOnce(
    new Promise((resolve, reject) => {
      finish = () => (rejected ? reject(new Error('Runner aborted')) : resolve(execution()))
    }),
  )
  await withCapturedStandardStreams(async ({stdout}) => {
    const running = start()
    try {
      await flushPromises()
      update()
      update()
      await flushPromises()
      expect(captureFunctionRun).toHaveBeenCalledOnce()
      if (cancelled) options.abortController.abort()
      finish()
      await flushPromises()
      expect(captureFunctionRun).toHaveBeenCalledTimes(cancelled ? 1 : 3)
      options.abortController.abort()
      await running
      expect(records(stdout()).filter(({type}) => type === 'execution')).toHaveLength(cancelled ? 0 : 3)
      expect(records(stdout()).at(-1).status).toBe('cancelled')
    } finally {
      finish()
    }
  })
})

test.each([false, true])('defers startup records and executes the latest successful extension: %s', async (failed) => {
  const {options, startWatcher, start, emit} = await fixture()
  const updated = await testFunctionExtension({
    config: {...options.extension.configuration, build: {path: 'dist/updated.wasm', wasm_opt: true}},
  })
  let ready!: () => void
  startWatcher.mockReturnValue(
    new Promise((resolve) => {
      ready = resolve
    }),
  )
  await withCapturedStandardStreams(async ({stdout}) => {
    const running = start()
    try {
      await flushPromises()
      emit([
        {
          type: EventType.Updated,
          extension: updated,
          buildResult: failed
            ? {status: 'error', error: 'Build failed', uid: updated.uid}
            : {status: 'ok', uid: updated.uid},
        },
      ])
      expect(stdout()).toBe('')
      ready()
      await flushPromises()
      expect(records(stdout())[0].status).toBe('watching')
      if (failed) {
        expect(captureFunctionRun).not.toHaveBeenCalled()
        emit([{type: EventType.Updated, extension: updated}])
        await flushPromises()
      }
      expect(captureFunctionRun).toHaveBeenCalledOnce()
      expect(vi.mocked(captureFunctionRun).mock.calls[0]![0].functionExtension).toBe(updated)
    } finally {
      ready()
      options.abortController.abort()
      await running
    }
  })
})

test('aborts on a closed stdout pipe and suppresses later records and runs', async () => {
  const {options, start, update} = await fixture()
  await withCapturedStandardStreams(async ({stdout}) => {
    const running = start()
    await flushPromises()
    const before = stdout()
    process.stdout.emit('error', Object.assign(new Error('write EPIPE'), {code: 'EPIPE'}))
    expect(options.abortController.signal.aborted).toBe(true)
    update()
    await running
    expect(stdout()).toBe(before)
    expect(captureFunctionRun).toHaveBeenCalledOnce()
  })
})

test.each(['startup', 'watcher', 'runner', 'invalid-result'])(
  'reports fatal %s failures through the standard error handler',
  async (source) => {
    const {options, start, startWatcher} = await fixture()
    const error = new ExternalError('Replay failed', '/runner', [])
    if (source === 'startup') startWatcher.mockRejectedValue(error)
    if (source === 'runner') vi.mocked(captureFunctionRun).mockRejectedValue(error)
    if (source === 'invalid-result')
      vi.mocked(captureFunctionRun).mockResolvedValue({
        state: 'failed',
        message: error.message,
        command: '/runner',
        args: [],
        exitCode: 1,
        stderr: '',
      })
    await withCapturedStandardStreams(async ({stdout}) => {
      const running = start()
      const rejected = expect(running).rejects.toThrow(error.message)
      if (source === 'watcher') {
        await flushPromises()
        ;(startWatcher.mock.instances[0] as AppEventWatcher).emit('error', error)
      }
      await rejected
      expect(options.abortController.signal.aborted).toBe(true)
      expect(records(stdout()).some(({status}) => status === 'cancelled')).toBe(false)
      expect(records(stdout()).filter(({type}) => type === 'execution')).toHaveLength(source === 'watcher' ? 1 : 0)
      await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => handler(error))
      expect(records(stdout()).at(-1)).toMatchObject({error: {type: 'external', message: 'Replay failed'}})
    })
  },
)

test('ignores updates for other functions and creation/deletion events for the selected function', async () => {
  const {options, start, emit} = await fixture()
  const other = await testFunctionExtension({config: {...options.extension.configuration, handle: 'other-function'}})
  await withCapturedStandardStreams(async ({stdout}) => {
    const running = start()
    await flushPromises()
    const before = stdout()
    emit([
      {type: EventType.Updated, extension: other},
      {type: EventType.Created, extension: options.extension},
      {type: EventType.Deleted, extension: options.extension},
    ])
    await flushPromises()
    expect(stdout()).toBe(before)
    expect(captureFunctionRun).toHaveBeenCalledOnce()
    options.abortController.abort()
    await running
  })
})
