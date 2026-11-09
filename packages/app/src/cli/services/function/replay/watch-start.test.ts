import {watchReplayJson} from './json.js'
import {captureFunctionRun} from '../runner.js'
import {type FunctionRunData} from '../replay.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdir, writeFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as output from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {
  commandEventOutputMode,
  renderCommandEventAsJson,
  runWithCommandEvents,
} from '@shopify/cli-kit/node/command-events'
import chokidar, {type FSWatcher} from 'chokidar'
import {expect, test, vi} from 'vitest'
import {AsyncResource} from 'node:async_hooks'

vi.mock('../runner.js')

test('rebuilds an edit made immediately after the watching record', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extensionDirectory = joinPath(directory, 'extensions', 'function')
    await mkdir(extensionDirectory)
    const sourcePath = joinPath(extensionDirectory, 'index.js')
    await writeFile(sourcePath, 'initial')
    const extension = await testFunctionExtension({dir: extensionDirectory})
    vi.spyOn(extension, 'watchedFiles').mockReturnValue([sourcePath])
    vi.spyOn(extension, 'rescanImports').mockResolvedValue(false)
    const build = vi.spyOn(extension, 'buildForBundle').mockResolvedValue(undefined)
    const app = testAppLinked({directory, allExtensions: [extension]})
    vi.spyOn(app, 'generateExtensionTypes').mockResolvedValue(undefined)
    const controller = new AbortController()
    const results: string[] = []
    vi.spyOn(output, 'outputResult').mockImplementation((content) => {
      const record = String(content)
      results.push(record)
      if (record.includes('"status":"watching"')) writeFileSync(sourcePath, 'edited')
    })
    vi.mocked(captureFunctionRun).mockResolvedValue({
      state: 'completed',
      resultJson: JSON.stringify({
        name: 'function.wasm',
        size: 1,
        memory_usage: 64,
        instructions: 1,
        logs: '',
        input: {},
        output: {},
        success: true,
      }),
      exitCode: 0,
      diagnostics: [],
    })
    const running = watchReplayJson({
      app,
      extension,
      abortController: controller,
      selectedRun: {payload: {input: {}, export: 'run'}} as FunctionRunData,
    })

    try {
      await vi.waitFor(() => expect(captureFunctionRun).toHaveBeenCalledTimes(2), {timeout: 3000})
      expect(build).toHaveBeenCalledOnce()
      expect(results.map((record) => JSON.parse(record).type)).toEqual(['status', 'execution', 'build', 'execution'])
    } finally {
      controller.abort()
      await running
    }
  })
})

test('keeps native rebuild diagnostics in the JSON command context', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extensionDirectory = joinPath(directory, 'extensions', 'function')
    await mkdir(extensionDirectory)
    const sourcePath = joinPath(extensionDirectory, 'index.js')
    await writeFile(sourcePath, 'initial')
    const extension = await testFunctionExtension({dir: extensionDirectory})
    vi.spyOn(extension, 'watchedFiles').mockReturnValue([sourcePath])
    vi.spyOn(extension, 'rescanImports').mockResolvedValue(false)
    const modes: ReturnType<typeof commandEventOutputMode>[] = []
    vi.spyOn(extension, 'buildForBundle').mockImplementation(async () => {
      modes.push(commandEventOutputMode())
      output.outputInfo('Build status')
    })
    const app = testAppLinked({directory, allExtensions: [extension]})
    vi.spyOn(app, 'generateExtensionTypes').mockResolvedValue(undefined)
    vi.mocked(captureFunctionRun).mockResolvedValue({
      state: 'completed',
      exitCode: 0,
      diagnostics: [],
      resultJson: JSON.stringify({
        name: 'function.wasm',
        size: 1,
        memory_usage: 64,
        instructions: 1,
        logs: '',
        input: {},
        output: {},
        success: true,
      }),
    })
    const controller = new AbortController()
    const nativeCallback = new AsyncResource('replay-file-watcher')
    const watch = chokidar.watch.bind(chokidar)
    let nativeWatcher: FSWatcher | undefined
    const watchSpy = vi.spyOn(chokidar, 'watch').mockImplementation((paths, options) => {
      nativeWatcher = watch(paths, options)
      return nativeWatcher
    })
    const sink = vi.fn(renderCommandEventAsJson)
    try {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const running = runWithCommandEvents({outputMode: 'json', sink}, () =>
          watchReplayJson({
            app,
            extension,
            abortController: controller,
            selectedRun: {payload: {input: {}, export: 'run'}} as FunctionRunData,
          }),
        )
        try {
          await vi.waitFor(() => expect(captureFunctionRun).toHaveBeenCalledOnce())
          nativeCallback.runInAsyncScope(() => {
            expect(commandEventOutputMode()).toBeUndefined()
            nativeWatcher!.emit('all', 'change', sourcePath)
          })
          await vi.waitFor(() => expect(captureFunctionRun).toHaveBeenCalledTimes(2))
        } finally {
          controller.abort()
          await running
        }
        expect(modes).toEqual(['json'])
        for (const line of stdout().trim().split('\n')) expect(() => JSON.parse(line)).not.toThrow()
        expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'info', message: 'Build status'})
        expect(sink).toHaveBeenCalledWith(expect.objectContaining({message: 'Build status'}))
      })
    } finally {
      controller.abort()
      await nativeWatcher?.close()
      watchSpy.mockRestore()
      nativeCallback.emitDestroy()
    }
  })
})
