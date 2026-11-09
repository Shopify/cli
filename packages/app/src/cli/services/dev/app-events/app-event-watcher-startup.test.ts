import {AppEventWatcher, type AppEvent} from './app-event-watcher.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {type ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import {expect, test, vi, type Mock, type MockInstance} from 'vitest'
import chokidar, {type FSWatcher} from 'chokidar'
import {Writable} from 'stream'

const realChokidarWatch = chokidar.watch.bind(chokidar)

function output() {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })
}

async function withStartupWatcher(
  run: (fixture: {
    build: MockInstance<ExtensionInstance['buildForBundle']>
    onStart: Mock<(event: AppEvent) => void>
    scanned: Promise<void>
    releaseReadiness: () => void
    changed: () => Promise<void>
    running: Promise<void>
  }) => Promise<void>,
  initialBuildFails = false,
) {
  await inTemporaryDirectory(async (directory) => {
    const extensionDirectory = joinPath(directory, 'extensions', 'function')
    await mkdir(extensionDirectory)
    const sourcePath = joinPath(extensionDirectory, 'index.js')
    await writeFile(sourcePath, 'initial')
    const extension = await testFunctionExtension({dir: extensionDirectory})
    vi.spyOn(extension, 'watchedFiles').mockReturnValue([sourcePath])
    vi.spyOn(extension, 'rescanImports').mockResolvedValue(false)
    const build = vi.spyOn(extension, 'buildForBundle').mockResolvedValue(undefined)
    if (initialBuildFails) build.mockRejectedValueOnce(new Error('Initial build failed'))
    const app = testAppLinked({directory, allExtensions: [extension]})
    vi.spyOn(app, 'generateExtensionTypes').mockResolvedValue(undefined)
    const controller = new AbortController()
    let nativeWatcher: FSWatcher | undefined
    let releaseReadiness!: () => void
    let scanned!: () => void
    const nativeReady = new Promise<void>((resolve) => {
      scanned = resolve
    })
    const watchSpy = vi.spyOn(chokidar, 'watch').mockImplementation((paths, options) => {
      nativeWatcher = realChokidarWatch(paths, options)
      nativeWatcher.once('ready', scanned)
      const once = nativeWatcher.once.bind(nativeWatcher)
      vi.spyOn(nativeWatcher, 'once').mockImplementation((event, listener) => {
        if (event === 'ready') {
          let pending = true
          releaseReadiness = () => {
            if (!pending) return
            pending = false
            listener()
          }
          return nativeWatcher!
        }
        return once(event, listener)
      })
      return nativeWatcher
    })
    const watcher = new AppEventWatcher(app)
    const onStart = vi.fn<(event: AppEvent) => void>()
    watcher.onStart(onStart)
    const running = watcher.start({stdout: output(), stderr: output(), signal: controller.signal})
    try {
      await run({
        build,
        onStart,
        scanned: nativeReady,
        running,
        releaseReadiness: () => releaseReadiness(),
        changed: () => {
          const changed = new Promise<void>((resolve) => watcher.once('all', () => resolve()))
          nativeWatcher!.emit('all', 'change', sourcePath)
          return changed
        },
      })
    } finally {
      controller.abort()
      releaseReadiness?.()
      await running
      await nativeWatcher?.close()
      watchSpy.mockRestore()
    }
  })
}

test('startup readiness contains a build failure that occurs during the initial scan', async () => {
  await withStartupWatcher(async ({build, onStart, scanned, releaseReadiness, changed, running}) => {
    await scanned
    build.mockRejectedValueOnce(new Error('Compilation failed'))
    await changed()
    expect(onStart).not.toHaveBeenCalled()
    releaseReadiness()
    await running
    expect(onStart).toHaveBeenCalledOnce()
    expect(onStart.mock.calls[0]![0].extensionEvents[0]?.buildResult).toMatchObject({
      status: 'error',
      error: 'Compilation failed',
    })
  })
})

test('waits for a startup rebuild that is still running when the initial scan completes', async () => {
  await withStartupWatcher(async ({build, onStart, scanned, releaseReadiness, changed, running}) => {
    await scanned
    let finishBuild!: () => void
    build.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishBuild = resolve
        }),
    )
    const change = changed()
    try {
      await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(2))
      releaseReadiness()
      await flushPromises()
      expect(onStart).not.toHaveBeenCalled()
      finishBuild()
      await change
      await running
      expect(onStart).toHaveBeenCalledOnce()
      expect(onStart.mock.calls[0]![0].extensionEvents[0]?.buildResult?.status).toBe('ok')
    } finally {
      finishBuild?.()
    }
  })
})

test('replaces an initial build failure with a successful startup rebuild', async () => {
  await withStartupWatcher(async ({onStart, scanned, releaseReadiness, changed, running}) => {
    await scanned
    await changed()
    releaseReadiness()
    await running
    expect(onStart.mock.calls[0]![0].extensionEvents[0]?.buildResult?.status).toBe('ok')
  }, true)
})

test('waits for new file events received while a startup rebuild is running', async () => {
  await withStartupWatcher(async ({build, onStart, scanned, releaseReadiness, changed, running}) => {
    await scanned
    let finishFirstBuild!: () => void
    let finishSecondBuild!: () => void
    build.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirstBuild = resolve
        }),
    )
    build.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSecondBuild = resolve
        }),
    )
    const firstChange = changed()
    try {
      await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(2))
      releaseReadiness()
      await flushPromises()
      const secondChange = changed()
      await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(3))
      finishFirstBuild()
      await firstChange
      await flushPromises()
      expect(onStart).not.toHaveBeenCalled()
      finishSecondBuild()
      await secondChange
      await running
      expect(onStart).toHaveBeenCalledOnce()
    } finally {
      finishFirstBuild?.()
      finishSecondBuild?.()
    }
  })
})
