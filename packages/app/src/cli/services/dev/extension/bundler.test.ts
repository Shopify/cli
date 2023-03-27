import {FileWatcherOptions, setupBundlerAndFileWatcher} from './bundler.js'
import * as bundle from '../../extensions/bundle.js'
import {testUIExtension} from '../../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import chokidar from 'chokidar'
import {BuildResult} from 'esbuild'

async function testBundlerAndFileWatcher() {
  const extension1 = await testUIExtension({
    devUUID: '1',
    outputBundlePath: 'output/bundle/path/1/',
    directory: 'directory/path/1',
  })

  const extension2 = await testUIExtension({
    devUUID: '2',
    outputBundlePath: 'output/bundle/path/2/',
    directory: 'directory/path/2',
  })

  const fileWatcherOptions = {
    devOptions: {
      extensions: [extension1, extension2],
      app: {
        dotenv: {
          variables: {
            SOME_KEY: 'SOME_VALUE',
          },
        },
      },
      url: 'mock/url',
      stderr: {
        mockStdErr: 'STD_ERR',
      },
      stdout: {
        mockStdOut: 'STD_OUT',
      },
    },
    payloadStore: {
      updateExtension: vi.fn(() => Promise.resolve(undefined)),
    },
  } as unknown as FileWatcherOptions
  await setupBundlerAndFileWatcher(fileWatcherOptions)
  return fileWatcherOptions
}

describe('setupBundlerAndFileWatcher()', () => {
  test("call 'bundleExtension' for each extension", async () => {
    vi.spyOn(bundle, 'bundleExtension').mockResolvedValue(undefined)
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: vi.fn() as any,
    } as any)

    await testBundlerAndFileWatcher()

    expect(bundle.bundleExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        minify: false,
        outputBundlePath: 'directory/path/1/dist/main.js',
        stdin: {
          contents: "import './src/index.js';",
          resolveDir: 'directory/path/1',
          loader: 'tsx',
        },
        environment: 'development',
        env: {
          SOME_KEY: 'SOME_VALUE',
          APP_URL: 'mock/url',
        },
        stderr: {
          mockStdErr: 'STD_ERR',
        },
        stdout: {
          mockStdOut: 'STD_OUT',
        },
      }),
    )

    expect(bundle.bundleExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        minify: false,
        outputBundlePath: 'directory/path/2/dist/main.js',
        stdin: {
          contents: "import './src/index.js';",
          resolveDir: 'directory/path/2',
          loader: 'tsx',
        },
        environment: 'development',
        env: {
          SOME_KEY: 'SOME_VALUE',
          APP_URL: 'mock/url',
        },
        stderr: {
          mockStdErr: 'STD_ERR',
        },
        stdout: {
          mockStdOut: 'STD_OUT',
        },
      }),
    )
  })

  test("Call 'updateExtension' with status success when no error occurs", async () => {
    // GIVEN
    vi.spyOn(bundle, 'bundleExtension').mockResolvedValue(undefined)
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: vi.fn() as any,
    } as any)
    const fileWatcherOptions = await testBundlerAndFileWatcher()

    // WHEN
    const bundleExtensionFn = bundle.bundleExtension as any
    bundleExtensionFn.mock.calls[0][0].watch()

    // THEN
    expect(fileWatcherOptions.payloadStore.updateExtension).toHaveBeenCalledWith(
      fileWatcherOptions.devOptions.extensions[0],
      fileWatcherOptions.devOptions,
      {status: 'success'},
    )
  })

  test("Call 'updateExtension' with status error when an error occurs", async () => {
    // GIVEN
    vi.spyOn(bundle, 'bundleExtension').mockResolvedValue(undefined)
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: vi.fn() as any,
    } as any)
    const fileWatcherOptions = await testBundlerAndFileWatcher()

    // WHEN
    const buildFailure = {
      errors: ['error'] as any,
      warnings: [],
      outputFiles: [],
      metafile: {} as any,
      mangleCache: {},
    } as BuildResult
    const bundleExtensionFn = bundle.bundleExtension as any
    bundleExtensionFn.mock.calls[0][0].watch(buildFailure)

    // THEN
    expect(fileWatcherOptions.payloadStore.updateExtension).toHaveBeenCalledWith(
      fileWatcherOptions.devOptions.extensions[0],
      fileWatcherOptions.devOptions,
      {status: 'error'},
    )
  })

  test('Watches the locales directory for change events', async () => {
    // GIVEN
    const chokidarOnSpy = vi.fn() as any
    vi.spyOn(bundle, 'bundleExtension').mockResolvedValue(undefined)
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    // WHEN
    await testBundlerAndFileWatcher()

    // THEN
    expect(chokidar.watch).toHaveBeenCalledWith('directory/path/1/locales/**.json')
    expect(chokidar.watch).toHaveBeenCalledWith('directory/path/2/locales/**.json')
    expect(chokidarOnSpy).toHaveBeenCalledTimes(2)
    expect(chokidarOnSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })

  test('Updates the extension when a locale changes', async () => {
    const chokidarOnSpy = vi.fn() as any

    // GIVEN
    vi.spyOn(bundle, 'bundleExtension').mockResolvedValue(undefined)
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    // WHEN
    const fileWatcherOptions = await testBundlerAndFileWatcher()
    chokidarOnSpy.mock.calls[0][1]()
    chokidarOnSpy.mock.calls[1][1]()

    // THEN
    expect(fileWatcherOptions.payloadStore.updateExtension).toHaveBeenCalledWith(
      fileWatcherOptions.devOptions.extensions[0],
      fileWatcherOptions.devOptions,
    )
    expect(fileWatcherOptions.payloadStore.updateExtension).toHaveBeenCalledWith(
      fileWatcherOptions.devOptions.extensions[1],
      fileWatcherOptions.devOptions,
    )
  })
})
