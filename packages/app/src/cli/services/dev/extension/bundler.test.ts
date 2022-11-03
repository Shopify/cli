import {FileWatcherOptions, setupBundlerAndFileWatcher} from './bundler.js'
import * as bundle from '../../extensions/bundle.js'
import {describe, expect, test, vi} from 'vitest'
import chokidar from 'chokidar'
import {BuildFailure} from 'esbuild'
import {path} from '@shopify/cli-kit'

async function testBundlerAndFileWatcher() {
  const fileWatcherOptions = {
    devOptions: {
      extensions: [
        {
          devUUID: '1',
          outputBundlePath: 'output/bundle/path/1',
          entrySourceFilePaths: ['source/file/path/1'],
          directory: 'directory/1/',
          configuration: {
            name: 'name 1',
          },
        },
        {
          devUUID: '2',
          outputBundlePath: 'output/bundle/path/2',
          entrySourceFilePaths: ['source/file/path/2'],
          directory: 'directory/2/',
          configuration: {
            name: 'name 2',
          },
        },
      ],
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
    vi.spyOn(path, 'relative').mockImplementation((directory, path) => directory + path)

    await testBundlerAndFileWatcher()

    expect(bundle.bundleExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        minify: false,
        outputBundlePath: 'output/bundle/path/1',
        stdin: {
          contents: "import './directory/1/source/file/path/1';",
          resolveDir: 'directory/1/',
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
        outputBundlePath: 'output/bundle/path/2',
        stdin: {
          contents: "import './directory/2/source/file/path/2';",
          resolveDir: 'directory/2/',
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
    const buildFailure = {} as unknown as BuildFailure
    const bundleExtensionFn = bundle.bundleExtension as any
    bundleExtensionFn.mock.calls[0][0].watch(buildFailure)

    // THEN
    expect(fileWatcherOptions.payloadStore.updateExtension).toHaveBeenCalledWith(
      fileWatcherOptions.devOptions.extensions[0],
      {status: 'error'},
    )
  })

  test('Watches the locales directory for change events', async () => {
    const chokidarOnSpy = vi.fn() as any

    // GIVEN
    vi.spyOn(bundle, 'bundleExtension').mockResolvedValue(undefined)
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    // WHEN
    await testBundlerAndFileWatcher()

    // THEN
    expect(chokidar.watch).toHaveBeenCalledWith('directory/1/locales/**.json')
    expect(chokidar.watch).toHaveBeenCalledWith('directory/2/locales/**.json')
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
    )
    expect(fileWatcherOptions.payloadStore.updateExtension).toHaveBeenCalledWith(
      fileWatcherOptions.devOptions.extensions[1],
    )
  })
})
