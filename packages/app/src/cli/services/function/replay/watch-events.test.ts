import {watchReplay, type ReplayWatchEvent, type WatchReplayOptions} from './watch.js'
import {captureFunctionRun, type FunctionExecution} from '../runner.js'
import {type FunctionRunData} from '../replay.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AppEventWatcher, EventType, type ExtensionEvent} from '../../dev/app-events/app-event-watcher.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {expect, test, vi} from 'vitest'

vi.mock('../runner.js')

function execution(resultJson = '{"success":true}', exitCode = 0): Extract<FunctionExecution, {state: 'completed'}> {
  return {state: 'completed', resultJson, exitCode, diagnostics: []}
}

async function fixture(directory: string) {
  const app = testAppLinked({directory})
  const extension = await testFunctionExtension({dir: directory})
  const abortController = new AbortController()
  const events: ReplayWatchEvent[] = []
  const startWatcher = vi.spyOn(AppEventWatcher.prototype, 'start').mockResolvedValue(undefined)
  vi.mocked(captureFunctionRun).mockResolvedValue(execution())
  const options: WatchReplayOptions = {
    app,
    extension,
    abortController,
    selectedRun: {payload: {input: {value: 1}, export: 'run'}} as FunctionRunData,
    onEvent: (event: ReplayWatchEvent) => events.push(event),
  }
  const emit = (extensionEvents: ExtensionEvent[]) =>
    (startWatcher.mock.instances[0] as AppEventWatcher).emit('all', {extensionEvents})
  const update = (error?: string) =>
    emit([
      {
        extension,
        type: EventType.Updated,
        buildResult: error ? {status: 'error', error, uid: extension.uid} : {status: 'ok', uid: extension.uid},
      },
    ])
  return {options, events, update, startWatcher, emit}
}

test('reports replay events without writing terminal or JSON output', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events, startWatcher} = await fixture(directory)
    vi.mocked(captureFunctionRun).mockResolvedValue({...execution(), diagnostics: ['Runner diagnostic']})
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const running = watchReplay(options)
      try {
        await flushPromises()
        expect(startWatcher).toHaveBeenCalledWith(
          expect.objectContaining({signal: options.abortController.signal}),
          false,
        )
        expect(captureFunctionRun).toHaveBeenCalledWith({
          functionExtension: options.extension,
          input: '{"value":1}',
          export: 'run',
          json: true,
        })
        options.abortController.abort()
        await running
        expect(events).toEqual([
          {type: 'status', status: 'watching'},
          {type: 'status', status: 'running'},
          {type: 'diagnostic', message: 'Runner diagnostic'},
          {type: 'execution', resultJson: '{"success":true}', exitCode: 0},
          {type: 'status', status: 'cancelled'},
        ])
        expect(stdout()).toBe('')
        expect(stderr()).toBe('')
      } finally {
        options.abortController.abort()
        await running
      }
    })
  })
})

test('queues rebuild executions until the active execution finishes', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events, update} = await fixture(directory)
    let finishExecution: (result: FunctionExecution) => void = () => {}
    vi.mocked(captureFunctionRun)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishExecution = resolve
          }),
      )
      .mockResolvedValue(execution())
    const running = watchReplay(options)
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
})

test('recovers from build and completed Function failures for every output adapter', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events, update} = await fixture(directory)
    vi.mocked(captureFunctionRun)
      .mockResolvedValueOnce(execution('{"success":false}', 1))
      .mockResolvedValue(execution())
    const running = watchReplay(options)
    try {
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
    } finally {
      options.abortController.abort()
      await running
    }
  })
})

test('skips queued executions and late results after cancellation', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events, update} = await fixture(directory)
    let finishExecution: (result: FunctionExecution) => void = () => {}
    vi.mocked(captureFunctionRun).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishExecution = resolve
        }),
    )
    const running = watchReplay(options)
    try {
      await flushPromises()
      update()
      options.abortController.abort()
      finishExecution(execution())
      await running
      expect(captureFunctionRun).toHaveBeenCalledOnce()
      expect(events.filter(({type}) => type === 'execution')).toEqual([])
      expect(events.at(-1)).toEqual({type: 'status', status: 'cancelled'})
    } finally {
      finishExecution(execution())
      options.abortController.abort()
      await running
    }
  })
})

test('does not start watching or executing when already cancelled', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events, startWatcher} = await fixture(directory)
    options.abortController.abort()
    await watchReplay(options)
    expect(startWatcher).not.toHaveBeenCalled()
    expect(captureFunctionRun).not.toHaveBeenCalled()
    expect(events).toEqual([])
  })
})

test('executes the updated extension instance after a rebuild', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events, emit} = await fixture(directory)
    const updatedExtension = await testFunctionExtension({
      dir: directory,
      config: {
        ...options.extension.configuration,
        build: {...options.extension.configuration.build, path: 'dist/updated.wasm', wasm_opt: true},
      },
    })
    expect(updatedExtension.handle).toBe(options.extension.handle)
    expect(updatedExtension).not.toBe(options.extension)
    const running = watchReplay(options)
    try {
      await flushPromises()
      emit([{type: EventType.Updated, extension: updatedExtension}])
      await flushPromises()
      expect(captureFunctionRun).toHaveBeenCalledTimes(2)
      expect(vi.mocked(captureFunctionRun).mock.calls[0]![0].functionExtension).toBe(options.extension)
      expect(vi.mocked(captureFunctionRun).mock.calls[1]![0].functionExtension).toBe(updatedExtension)
      expect(captureFunctionRun).toHaveBeenLastCalledWith(
        expect.objectContaining({input: '{"value":1}', export: 'run', json: true}),
      )
      expect(events.filter(({type}) => type === 'build')).toEqual([{type: 'build', status: 'success'}])
    } finally {
      options.abortController.abort()
      await running
    }
  })
})

test.each([
  {eventType: EventType.Updated, target: 'unrelated'},
  {eventType: EventType.Created, target: 'unrelated'},
  {eventType: EventType.Deleted, target: 'unrelated'},
  {eventType: EventType.Created, target: 'selected'},
  {eventType: EventType.Deleted, target: 'selected'},
])('ignores $eventType events for the $target extension', async ({eventType, target}) => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events, emit} = await fixture(directory)
    const eventExtension =
      target === 'selected'
        ? options.extension
        : await testFunctionExtension({
            dir: directory,
            config: {...options.extension.configuration, handle: 'unrelated-function'},
          })
    if (target === 'unrelated') expect(eventExtension.handle).not.toBe(options.extension.handle)
    const running = watchReplay(options)
    try {
      await flushPromises()
      const eventsBeforeChange = [...events]
      emit([{type: eventType, extension: eventExtension}])
      await flushPromises()
      expect(captureFunctionRun).toHaveBeenCalledOnce()
      expect(events).toEqual(eventsBeforeChange)
      expect(options.abortController.signal.aborted).toBe(false)
    } finally {
      options.abortController.abort()
      await running
    }
  })
})

test('waits for watcher startup before reporting readiness or executing', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events, startWatcher} = await fixture(directory)
    let finishStartup!: () => void
    const startup = new Promise<void>((resolve) => {
      finishStartup = resolve
    })
    startWatcher.mockReturnValue(startup)
    const running = watchReplay(options)
    try {
      await flushPromises()
      expect(startWatcher).toHaveBeenCalledOnce()
      expect(events).toEqual([])
      expect(captureFunctionRun).not.toHaveBeenCalled()
      finishStartup()
      await flushPromises()
      expect(events.map((event) => (event.type === 'status' ? event.status : event.type))).toEqual([
        'watching',
        'running',
        'execution',
      ])
      expect(captureFunctionRun).toHaveBeenCalledOnce()
    } finally {
      options.abortController.abort()
      finishStartup()
      await running
    }
  })
})

test('does not report readiness or execute after cancellation during startup', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events, startWatcher} = await fixture(directory)
    let finishStartup!: () => void
    const startup = new Promise<void>((resolve) => {
      finishStartup = resolve
    })
    startWatcher.mockReturnValue(startup)
    const running = watchReplay(options)
    try {
      await flushPromises()
      expect(startWatcher).toHaveBeenCalledOnce()
      options.abortController.abort()
      finishStartup()
      await running
      expect(captureFunctionRun).not.toHaveBeenCalled()
      expect(events).toEqual([{type: 'status', status: 'cancelled'}])
    } finally {
      options.abortController.abort()
      finishStartup()
      await running
    }
  })
})

test('does not execute when the watching callback cancels replay', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events} = await fixture(directory)
    options.onEvent = (event) => {
      events.push(event)
      if (event.type === 'status' && event.status === 'watching') options.abortController.abort()
    }
    await watchReplay(options)
    expect(captureFunctionRun).not.toHaveBeenCalled()
    expect(events).toEqual([
      {type: 'status', status: 'watching'},
      {type: 'status', status: 'cancelled'},
    ])
  })
})

test('does not execute when the running callback cancels replay', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events} = await fixture(directory)
    options.onEvent = (event) => {
      events.push(event)
      if (event.type === 'status' && event.status === 'running') options.abortController.abort()
    }
    await watchReplay(options)
    expect(captureFunctionRun).not.toHaveBeenCalled()
    expect(events).toEqual([
      {type: 'status', status: 'watching'},
      {type: 'status', status: 'running'},
      {type: 'status', status: 'cancelled'},
    ])
  })
})

test('omits remaining diagnostics and the execution when a diagnostic callback cancels replay', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {options, events} = await fixture(directory)
    vi.mocked(captureFunctionRun).mockResolvedValue({
      state: 'completed',
      resultJson: '{"success":true}',
      exitCode: 0,
      diagnostics: ['first', 'second'],
    })
    options.onEvent = (event) => {
      events.push(event)
      if (event.type === 'diagnostic') options.abortController.abort()
    }
    await watchReplay(options)
    expect(captureFunctionRun).toHaveBeenCalledOnce()
    expect(events).toEqual([
      {type: 'status', status: 'watching'},
      {type: 'status', status: 'running'},
      {type: 'diagnostic', message: 'first'},
      {type: 'status', status: 'cancelled'},
    ])
  })
})
