import {ReplayFileWatcher} from './file-watcher.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import chokidar, {type FSWatcher} from 'chokidar'
import {expect, test, vi} from 'vitest'
import {getEventListeners} from 'events'
import {Writable} from 'stream'

const watch = chokidar.watch.bind(chokidar)

test.each(['scan', 'changes'])('stop completes the pending replay %s without an abort signal', async (pending) => {
  await inTemporaryDirectory(async (directory) => {
    const extensionDirectory = joinPath(directory, 'extensions', 'function')
    await mkdir(extensionDirectory)
    const sourcePath = joinPath(extensionDirectory, 'index.js')
    await writeFile(sourcePath, 'initial')
    const extension = await testFunctionExtension({dir: extensionDirectory})
    vi.spyOn(extension, 'watchedFiles').mockReturnValue([sourcePath])
    const controller = new AbortController()
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback()
      },
    })
    const watcher = new ReplayFileWatcher(testAppLinked({directory, allExtensions: [extension]}), {
      stdout: output,
      stderr: output,
      signal: controller.signal,
    })
    watcher.onChange(() => {})
    let nativeWatcher: FSWatcher | undefined
    let scanHeld = false
    const watchSpy = vi.spyOn(chokidar, 'watch').mockImplementation((paths, options) => {
      nativeWatcher = watch(paths, options)
      if (pending === 'scan') {
        const emit = nativeWatcher.emit.bind(nativeWatcher)
        vi.spyOn(nativeWatcher, 'emit').mockImplementation((event, ...args) => {
          if (event === 'ready') {
            scanHeld = true
            return false
          }
          return emit(event, ...args)
        })
      }
      return nativeWatcher
    })
    const starting = watcher.start()
    try {
      let completing = starting
      if (pending === 'scan') await vi.waitFor(() => expect(scanHeld).toBe(true))
      else {
        await starting
        nativeWatcher!.emit('all', 'change', sourcePath)
        completing = watcher.waitForStartupChanges()
      }
      await watcher.stop()
      await completing
      expect(nativeWatcher!.getWatched()).toEqual({})
      expect(controller.signal.aborted).toBe(false)
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
      await watcher.start()
      expect(watchSpy).toHaveBeenCalledOnce()
    } finally {
      controller.abort()
      await watcher.stop()
      await starting
      watchSpy.mockRestore()
    }
  })
})
