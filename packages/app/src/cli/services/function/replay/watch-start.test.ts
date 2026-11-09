import {watchReplayJson} from './json.js'
import {captureFunctionRun} from '../runner.js'
import {type FunctionRunData} from '../replay.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {type ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {FileWatcher} from '../../dev/app-events/file-watcher.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdir, writeFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as output from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams, type CapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {
  commandEventOutputMode,
  renderCommandEventAsJson,
  runWithCommandEvents,
} from '@shopify/cli-kit/node/command-events'
import chokidar, {type FSWatcher} from 'chokidar'
import {expect, test, vi, type MockInstance} from 'vitest'
import {AsyncResource} from 'node:async_hooks'

vi.mock('../runner.js')
const watch = chokidar.watch.bind(chokidar)
const writeResult = output.outputResult
const types = (stdout: string) =>
  stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line).type)

async function nativeReplay(
  run: (
    fixture: CapturedStandardStreams & {
      controller: AbortController
      running: Promise<void>
      watchers: FSWatcher[]
      release: () => void
      change: () => void
      rescan: MockInstance<ExtensionInstance['rescanImports']>
      build: MockInstance<ExtensionInstance['buildForBundle']>
      modes: ReturnType<typeof commandEventOutputMode>[]
    },
  ) => Promise<void>,
  mode: 'edit' | 'hold' | 'pre-scan-abort',
) {
  await inTemporaryDirectory(async (directory) => {
    const extensionDirectory = joinPath(directory, 'extensions', 'function')
    await mkdir(extensionDirectory)
    const sourcePath = joinPath(extensionDirectory, 'index.js')
    await writeFile(sourcePath, 'initial')
    const extension = await testFunctionExtension({dir: extensionDirectory})
    vi.spyOn(extension, 'watchedFiles').mockReturnValue([sourcePath])
    const rescan = vi.spyOn(extension, 'rescanImports').mockResolvedValue(false)
    const modes: ReturnType<typeof commandEventOutputMode>[] = []
    const build = vi.spyOn(extension, 'buildForBundle').mockImplementation(async () => {
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
    const nativeContext = new AsyncResource('native-replay-event')
    const watchers: FSWatcher[] = []
    let release: (() => void) | undefined
    const watchSpy = vi.spyOn(chokidar, 'watch').mockImplementation((paths, options) => {
      const watcher = watch(paths, options)
      watchers.push(watcher)
      const emit = watcher.emit.bind(watcher)
      vi.spyOn(watcher, 'emit').mockImplementation((event, ...args) => {
        if (mode === 'hold' && watchers.length === 1 && event === 'ready') {
          release = () => {
            nativeContext.runInAsyncScope(emit, undefined, event, ...args)
          }
          return false
        }
        return nativeContext.runInAsyncScope(emit, undefined, event, ...args)
      })
      return watcher
    })
    const resultSpy = vi.spyOn(output, 'outputResult').mockImplementation((content) => {
      writeResult(content)
      if (mode === 'edit' && String(content).includes('"status":"watching"')) writeFileSync(sourcePath, 'edited')
    })
    const startSpy =
      mode === 'pre-scan-abort'
        ? vi.spyOn(FileWatcher.prototype, 'start').mockImplementation(async () => {
            controller.abort()
          })
        : undefined
    try {
      await withCapturedStandardStreams(async (streams) => {
        const running = runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () =>
          watchReplayJson({
            app,
            extension,
            abortController: controller,
            selectedRun: {payload: {input: {}, export: 'run'}} as FunctionRunData,
          }),
        )
        try {
          if (mode === 'hold') await vi.waitFor(() => expect(release).toBeTypeOf('function'))
          await run({
            ...streams,
            controller,
            running,
            watchers,
            release: () => release?.(),
            change: () => {
              watchers[0]!.emit('all', 'change', sourcePath)
            },
            rescan,
            build,
            modes,
          })
        } finally {
          controller.abort()
          await running.catch(() => {})
        }
      })
    } finally {
      controller.abort()
      release?.()
      await Promise.all(watchers.map((watcher) => watcher.close()))
      watchSpy.mockRestore()
      resultSpy.mockRestore()
      startSpy?.mockRestore()
      nativeContext.emitDestroy()
    }
  })
}

test('rebuilds an immediate edit and retains JSON context for native diagnostics', async () => {
  await nativeReplay(async ({stdout, stderr, build, modes}) => {
    await vi.waitFor(() => expect(captureFunctionRun).toHaveBeenCalledTimes(2))
    expect(build).toHaveBeenCalledOnce()
    expect(types(stdout())).toEqual(['status', 'execution', 'build', 'execution'])
    expect(modes).toEqual(['json'])
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'info', message: 'Build status'})
  }, 'edit')
})

test.each(['rescan', 'error', 'abort'] as const)('handles %s during native startup', async (outcome) => {
  await nativeReplay(async ({stdout, running, controller, watchers, release, change, rescan, build}) => {
    expect(stdout()).toBe('')
    if (outcome === 'error') {
      const rejected = expect(running).rejects.toThrow('Initial scan failed')
      watchers[0]!.emit('error', new Error('Initial scan failed'))
      await rejected
    } else if (outcome === 'abort') {
      controller.abort()
      await running
      expect(JSON.parse(stdout())).toMatchObject({status: 'cancelled'})
      expect(captureFunctionRun).not.toHaveBeenCalled()
    } else {
      let finish!: () => void
      rescan.mockResolvedValueOnce(true)
      build.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          }),
      )
      try {
        change()
        await vi.waitFor(() => expect(rescan).toHaveBeenCalledOnce())
        release()
        await vi.waitFor(() => expect(build).toHaveBeenCalledOnce())
        expect(watchers).toHaveLength(2)
        expect(stdout()).toBe('')
        finish()
        await vi.waitFor(() => expect(captureFunctionRun).toHaveBeenCalledOnce())
        expect(types(stdout())).toEqual(['status', 'build', 'execution'])
      } finally {
        finish?.()
      }
    }
  }, 'hold')
})

test('cancels when startup ends before a native watcher is created', async () => {
  await nativeReplay(async ({stdout, running, watchers}) => {
    await running
    expect(watchers).toEqual([])
    expect(JSON.parse(stdout())).toMatchObject({status: 'cancelled'})
  }, 'pre-scan-abort')
})
