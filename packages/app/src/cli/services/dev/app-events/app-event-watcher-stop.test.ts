import {AppEventWatcher, EventType} from './app-event-watcher.js'
import {FileWatcher} from './file-watcher.js'
import {handleWatcherEvents} from './app-event-watcher-handler.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {expect, test, vi} from 'vitest'
import {flushPromises} from '@shopify/cli-kit/node/promises'

vi.mock('./app-event-watcher-handler.js')

test('closes a real file watcher and releases event listeners when stopped repeatedly', async () => {
  await inTemporaryDirectory(async (directory) => {
    const app = testAppLinked({directory})
    const controller = new AbortController()
    const watcher = new AppEventWatcher(app)
    const stop = vi.spyOn(FileWatcher.prototype, 'stop')
    watcher.onEvent(() => {})
    watcher.onError(() => {})
    try {
      await watcher.start({stdout: process.stderr, stderr: process.stderr, signal: controller.signal}, false)
      controller.abort()
      await watcher.stop()
      await watcher.stop()
      expect(stop).toHaveBeenCalled()
      expect(watcher.listenerCount('all')).toBe(0)
      expect(watcher.listenerCount('error')).toBe(0)
    } finally {
      controller.abort()
      await watcher.stop()
    }
  })
})

test('waits for an active build and suppresses its events while stopping', async () => {
  await inTemporaryDirectory(async (directory) => {
    const app = testAppLinked({directory})
    const extension = await testFunctionExtension({dir: directory})
    const controller = new AbortController()
    const options = {stdout: process.stderr, stderr: process.stderr, signal: controller.signal}
    const fileWatcher = new FileWatcher(app, options)
    const onChange = vi.spyOn(fileWatcher, 'onChange')
    vi.spyOn(fileWatcher, 'start').mockResolvedValue(undefined)
    vi.spyOn(extension, 'rescanImports').mockResolvedValue(false)
    vi.spyOn(app, 'generateExtensionTypes').mockResolvedValue(undefined)
    let finishBuild!: () => void
    const build = new Promise<void>((resolve) => {
      finishBuild = resolve
    })
    let signalBuildStarted!: () => void
    const buildStarted = new Promise<void>((resolve) => {
      signalBuildStarted = resolve
    })
    vi.spyOn(extension, 'buildForBundle').mockImplementation(async (buildOptions) => {
      expect(buildOptions.signal).toBe(controller.signal)
      signalBuildStarted()
      await build
    })
    vi.mocked(handleWatcherEvents).mockResolvedValue({
      app,
      path: 'function.ts',
      startTime: [0, 0],
      extensionEvents: [{type: EventType.Updated, extension}],
    })
    const watcher = new AppEventWatcher(app, undefined, undefined, fileWatcher)
    const onEvent = vi.fn()
    watcher.onEvent(onEvent)
    watcher.onError((error) => {
      throw error
    })
    let stopped = false
    try {
      await watcher.start(options, false)
      onChange.mock.calls[0]![0]([])
      await buildStarted
      controller.abort()
      const stopping = watcher.stop().then(() => {
        stopped = true
      })
      await flushPromises()
      expect(stopped).toBe(false)
      finishBuild()
      await stopping
      expect(onEvent).not.toHaveBeenCalled()
    } finally {
      finishBuild()
      controller.abort()
      await watcher.stop()
    }
  })
})
