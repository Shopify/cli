import {watchReplay, type ReplayWatchEvent, type WatchReplayOptions} from './watch.js'
import {captureFunctionRun, type FunctionExecution} from '../runner.js'
import {type FunctionRunData} from '../replay.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AppEventWatcher, EventType, type ExtensionEvent} from '../../dev/app-events/app-event-watcher.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {expect, test, vi, onTestFinished} from 'vitest'

vi.mock('../runner.js')

function execution(resultJson = '{"success":true}', exitCode = 0): Extract<FunctionExecution, {state: 'completed'}> {
  return {state: 'completed', resultJson, exitCode, diagnostics: []}
}

async function fixture() {
  const extension = await testFunctionExtension()
  const events: ReplayWatchEvent[] = []
  const startWatcher = vi.spyOn(AppEventWatcher.prototype, 'start').mockResolvedValue(undefined)
  vi.mocked(captureFunctionRun).mockResolvedValue(execution())
  const options: WatchReplayOptions = {
    app: testAppLinked(),
    extension,
    abortController: new AbortController(),
    selectedRun: {payload: {input: {value: 1}, export: 'run'}} as FunctionRunData,
    onEvent: (event) => events.push(event),
  }
  let running = Promise.resolve()
  onTestFinished(async () => {
    options.abortController.abort()
    await running
    startWatcher.mockRestore()
  })
  const emit = (extensionEvents: ExtensionEvent[]) =>
    (startWatcher.mock.instances[0] as AppEventWatcher).emit('all', {extensionEvents})
  return {
    options,
    events,
    startWatcher,
    emit,
    start: () => (running = watchReplay(options)),
    update: (error?: string) =>
      emit([
        {
          extension,
          type: EventType.Updated,
          buildResult: error ? {status: 'error', error, uid: extension.uid} : {status: 'ok', uid: extension.uid},
        },
      ]),
  }
}

test('reports build output, runner diagnostics, and execution events without writing output', async () => {
  const {options, events, startWatcher, start} = await fixture()
  startWatcher.mockImplementation(async (context) => {
    context?.stdout?.write('Build output')
    context?.stderr?.write('Build warning')
  })
  vi.mocked(captureFunctionRun).mockResolvedValue({...execution(), diagnostics: ['Runner diagnostic']})
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    const running = start()
    await flushPromises()
    options.abortController.abort()
    await running
    expect(startWatcher).toHaveBeenCalledWith(expect.objectContaining({signal: options.abortController.signal}), false)
    expect(captureFunctionRun).toHaveBeenCalledWith({
      functionExtension: options.extension,
      input: '{"value":1}',
      export: 'run',
      json: true,
    })
    expect(events).toEqual([
      {type: 'diagnostic', message: 'Build output'},
      {type: 'diagnostic', message: 'Build warning'},
      {type: 'status', status: 'watching'},
      {type: 'status', status: 'running'},
      {type: 'diagnostic', message: 'Runner diagnostic'},
      {type: 'execution', resultJson: '{"success":true}', exitCode: 0},
      {type: 'status', status: 'cancelled'},
    ])
    expect(stdout()).toBe('')
    expect(stderr()).toBe('')
  })
})

test('queues rebuild executions until the active execution finishes', async () => {
  const {options, events, update, start} = await fixture()
  let finishExecution!: (result: FunctionExecution) => void
  vi.mocked(captureFunctionRun).mockReturnValueOnce(
    new Promise((resolve) => {
      finishExecution = resolve
    }),
  )
  const running = start()
  try {
    await flushPromises()
    update()
    update()
    await flushPromises()
    expect(captureFunctionRun).toHaveBeenCalledOnce()
    finishExecution(execution())
    await flushPromises()
    expect(captureFunctionRun).toHaveBeenCalledTimes(3)
    expect(events.filter(({type}) => type === 'execution')).toHaveLength(3)
  } finally {
    finishExecution(execution())
    options.abortController.abort()
    await running
  }
})

test('recovers from build and completed Function failures', async () => {
  const {options, events, update, start} = await fixture()
  vi.mocked(captureFunctionRun).mockResolvedValueOnce(execution('{"success":false}', 1))
  const previousExitCode = process.exitCode
  const running = start()
  await flushPromises()
  update('Compilation failed')
  await flushPromises()
  expect(captureFunctionRun).toHaveBeenCalledOnce()
  update()
  await flushPromises()
  expect(events.filter(({type}) => type === 'build')).toEqual([
    {type: 'build', status: 'failed', error: 'Compilation failed'},
    {type: 'build', status: 'success'},
  ])
  expect(events.filter(({type}) => type === 'execution')).toEqual([
    {type: 'execution', resultJson: '{"success":false}', exitCode: 1},
    {type: 'execution', resultJson: '{"success":true}', exitCode: 0},
  ])
  expect(options.abortController.signal.aborted).toBe(false)
  expect(process.exitCode).toBe(previousExitCode)
  options.abortController.abort()
  await running
})

test.each(['completed', 'rejected'])(
  'waits for the %s execution and skips queued runs after cancellation',
  async (state) => {
    const {options, events, update, start} = await fixture()
    let finishExecution!: () => void
    vi.mocked(captureFunctionRun).mockReturnValueOnce(
      new Promise((resolve, reject) => {
        finishExecution = () => (state === 'completed' ? resolve(execution()) : reject(new Error('Runner aborted')))
      }),
    )
    let settled = false
    const running = start().then(() => {
      settled = true
    })
    try {
      await flushPromises()
      update()
      options.abortController.abort()
      await flushPromises()
      expect(settled).toBe(false)
      finishExecution()
      await running
      expect(captureFunctionRun).toHaveBeenCalledOnce()
      expect(events.filter(({type}) => type === 'execution')).toEqual([])
      expect(events.at(-1)).toEqual({type: 'status', status: 'cancelled'})
    } finally {
      finishExecution()
    }
  },
)

test('does not start when already cancelled', async () => {
  const {options, events, startWatcher, start} = await fixture()
  options.abortController.abort()
  await start()
  expect(startWatcher).not.toHaveBeenCalled()
  expect(captureFunctionRun).not.toHaveBeenCalled()
  expect(events).toEqual([])
})

test('executes the updated extension instance after a rebuild', async () => {
  const {options, emit, start} = await fixture()
  const updatedExtension = await testFunctionExtension({
    config: {
      ...options.extension.configuration,
      build: {...options.extension.configuration.build, path: 'dist/updated.wasm', wasm_opt: true},
    },
  })
  const running = start()
  await flushPromises()
  emit([{type: EventType.Updated, extension: updatedExtension}])
  await flushPromises()
  expect(captureFunctionRun).toHaveBeenCalledTimes(2)
  expect(vi.mocked(captureFunctionRun).mock.calls[0]![0].functionExtension).toBe(options.extension)
  expect(vi.mocked(captureFunctionRun).mock.calls[1]![0].functionExtension).toBe(updatedExtension)
  options.abortController.abort()
  await running
})

test.each([
  {eventType: EventType.Updated, target: 'unrelated'},
  {eventType: EventType.Created, target: 'unrelated'},
  {eventType: EventType.Deleted, target: 'unrelated'},
  {eventType: EventType.Created, target: 'selected'},
  {eventType: EventType.Deleted, target: 'selected'},
])('ignores $eventType events for the $target extension', async ({eventType, target}) => {
  const {options, events, emit, start} = await fixture()
  const eventExtension =
    target === 'selected'
      ? options.extension
      : await testFunctionExtension({
          config: {...options.extension.configuration, handle: 'unrelated-function'},
        })
  const running = start()
  await flushPromises()
  const eventsBeforeChange = [...events]
  emit([{type: eventType, extension: eventExtension}])
  await flushPromises()
  expect(captureFunctionRun).toHaveBeenCalledOnce()
  expect(events).toEqual(eventsBeforeChange)
  options.abortController.abort()
  await running
})

test.each([false, true])(
  'waits for watcher readiness with cancellation during startup set to %s',
  async (cancelled) => {
    const {options, events, startWatcher, start} = await fixture()
    let finishStartup!: () => void
    startWatcher.mockReturnValue(
      new Promise((resolve) => {
        finishStartup = resolve
      }),
    )
    const running = start()
    try {
      await flushPromises()
      expect(startWatcher).toHaveBeenCalledOnce()
      expect(events).toEqual([])
      expect(captureFunctionRun).not.toHaveBeenCalled()
      if (cancelled) options.abortController.abort()
      finishStartup()
      await flushPromises()
      if (cancelled) {
        await running
        expect(captureFunctionRun).not.toHaveBeenCalled()
        expect(events).toEqual([{type: 'status', status: 'cancelled'}])
      } else {
        expect(events.map((event) => (event.type === 'status' ? event.status : event.type))).toEqual([
          'watching',
          'running',
          'execution',
        ])
        expect(captureFunctionRun).toHaveBeenCalledOnce()
      }
    } finally {
      finishStartup()
    }
  },
)

test.each(['watching', 'running', 'diagnostic'])(
  'stops immediately when the %s callback cancels replay',
  async (cancelOn) => {
    const {options, events, start} = await fixture()
    vi.mocked(captureFunctionRun).mockResolvedValue({...execution(), diagnostics: ['first', 'second']})
    options.onEvent = (event) => {
      events.push(event)
      if ((event.type === 'status' ? event.status : event.type) === cancelOn) options.abortController.abort()
    }
    await start()
    expect(captureFunctionRun).toHaveBeenCalledTimes(cancelOn === 'diagnostic' ? 1 : 0)
    expect(events.map((event) => (event.type === 'status' ? event.status : event.type))).toEqual([
      'watching',
      ...(cancelOn === 'watching' ? [] : ['running']),
      ...(cancelOn === 'diagnostic' ? ['diagnostic'] : []),
      'cancelled',
    ])
  },
)

test.each(['startup', 'watcher', 'runner', 'invalid-result'])('propagates a fatal %s failure', async (source) => {
  const {options, events, startWatcher} = await fixture()
  const error = new Error('Watch failed')
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
  const running = watchReplay(options)
  const rejected = expect(running).rejects.toThrow(error.message)
  if (source === 'watcher') {
    await flushPromises()
    ;(startWatcher.mock.instances[0] as AppEventWatcher).emit('error', error)
  }
  await rejected
  expect(options.abortController.signal.aborted).toBe(true)
  expect(events).not.toContainEqual({type: 'status', status: 'cancelled'})
  if (source === 'startup') {
    expect(events).toEqual([])
    expect(captureFunctionRun).not.toHaveBeenCalled()
  }
})
