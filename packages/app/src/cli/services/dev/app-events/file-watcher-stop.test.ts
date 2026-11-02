import {FileWatcher} from './file-watcher.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {configurationFileNames} from '../../../constants.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdir, removeFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {expect, test, vi} from 'vitest'
import chokidar, {FSWatcher} from 'chokidar'

test.each([
  {name: 'stop', stop: (watcher: FileWatcher, _controller: AbortController) => watcher.stop()},
  {name: 'abort', stop: async (_watcher: FileWatcher, controller: AbortController) => controller.abort()},
])('settles startup when $name interrupts the initial scan', async ({stop}) => {
  await inTemporaryDirectory(async (directory) => {
    const controller = new AbortController()
    const watcher = new FileWatcher(testAppLinked({directory}), {
      stdout: process.stderr,
      stderr: process.stderr,
      signal: controller.signal,
    })
    const fileWatcher = new FSWatcher()
    const watch = vi.spyOn(chokidar, 'watch').mockReturnValue(fileWatcher)
    let started = false
    const starting = watcher.start().then(() => {
      started = true
    })

    try {
      await vi.waitFor(() => expect(watch).toHaveBeenCalled())
      expect(started).toBe(false)
      await stop(watcher, controller)
      await starting
      expect(fileWatcher.listenerCount('ready')).toBe(0)
      expect(fileWatcher.listenerCount('error')).toBe(0)
    } finally {
      controller.abort()
      await watcher.stop()
      await starting
    }
  })
})

test('rejects startup when the initial scan fails', async () => {
  await inTemporaryDirectory(async (directory) => {
    const controller = new AbortController()
    const watcher = new FileWatcher(testAppLinked({directory}), {
      stdout: process.stderr,
      stderr: process.stderr,
      signal: controller.signal,
    })
    const fileWatcher = new FSWatcher()
    const watch = vi.spyOn(chokidar, 'watch').mockReturnValue(fileWatcher)
    const error = new Error('Initial scan failed')
    const starting = watcher.start()
    const rejected = expect(starting).rejects.toBe(error)

    try {
      await vi.waitFor(() => expect(watch).toHaveBeenCalled())
      fileWatcher.emit('error', error)
      await rejected
      expect(fileWatcher.listenerCount('ready')).toBe(0)
      expect(fileWatcher.listenerCount('error')).toBe(0)
    } finally {
      controller.abort()
      await watcher.stop()
    }
  })
})

test.each([
  {name: 'stop', stop: (watcher: FileWatcher, _controller: AbortController) => watcher.stop()},
  {name: 'abort', stop: async (_watcher: FileWatcher, controller: AbortController) => controller.abort()},
])('clears pending polling, deletion, and debounce timers on $name', async ({stop}) => {
  await inTemporaryDirectory(async (directory) => {
    const extensionDirectory = joinPath(directory, 'extensions', 'function')
    const newDirectory = joinPath(directory, 'extensions', 'new-function')
    await mkdir(extensionDirectory)
    await mkdir(newDirectory)
    const sourcePath = joinPath(extensionDirectory, 'index.js')
    const configPath = joinPath(newDirectory, 'shopify.extension.toml')
    const lockPath = joinPath(newDirectory, configurationFileNames.lockFile)
    await writeFile(sourcePath, '')
    await writeFile(configPath, '')
    await writeFile(lockPath, '')
    const extension = await testFunctionExtension({dir: extensionDirectory})
    vi.spyOn(extension, 'watchedFiles').mockReturnValue([sourcePath])
    const controller = new AbortController()
    const watcher = new FileWatcher(testAppLinked({directory, allExtensions: [extension]}), {
      stdout: process.stderr,
      stderr: process.stderr,
      signal: controller.signal,
    })
    const watch = vi.spyOn(chokidar, 'watch')
    const onChange = vi.fn()
    watcher.onChange(onChange)
    await watcher.start()
    const fileWatcher = watch.mock.results[0]!.value
    vi.useFakeTimers()
    try {
      fileWatcher.emit('all', 'add', configPath)
      fileWatcher.emit('all', 'change', sourcePath)
      fileWatcher.emit('all', 'unlink', sourcePath)
      onChange.mockClear()
      await stop(watcher, controller)
      const remainingTimers = vi.getTimerCount()
      await removeFile(lockPath)
      await vi.advanceTimersByTimeAsync(60000)

      expect(onChange).not.toHaveBeenCalled()
      expect(remainingTimers).toBe(0)
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
      controller.abort()
      await watcher.stop()
    }
  })
})

test.each([
  {name: 'stop', stop: (watcher: FileWatcher, _controller: AbortController) => watcher.stop()},
  {name: 'abort', stop: async (_watcher: FileWatcher, controller: AbortController) => controller.abort()},
])('does not create a watcher when $name interrupts startup', async ({stop}) => {
  await inTemporaryDirectory(async (directory) => {
    const controller = new AbortController()
    const watcher = new FileWatcher(testAppLinked({directory}), {
      stdout: process.stderr,
      stderr: process.stderr,
      signal: controller.signal,
    })
    const watch = vi.spyOn(chokidar, 'watch')
    const starting = watcher.start()
    try {
      await stop(watcher, controller)
      await starting
      expect(watch).not.toHaveBeenCalled()
    } finally {
      controller.abort()
      await starting
      await watcher.stop()
    }
  })
})
