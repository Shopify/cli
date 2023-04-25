import {
  FileWatcherOptions,
  setupBundlerAndFileWatcher,
  setupConfigWatcher,
  setupNonPreviewableExtensionBundler,
} from './bundler.js'
import * as bundle from '../../extensions/bundle.js'
import {testUIExtension} from '../../../models/app/app.test-data.js'
import {UIExtension} from '../../../models/app/extensions.js'
import {loadLocalUIExtensionsSpecifications} from '../../../models/extensions/specifications.js'
import {updateExtensionConfig, updateExtensionDraft} from '../update-extension.js'
import {describe, expect, test, vi} from 'vitest'
import chokidar from 'chokidar'
import {BuildResult} from 'esbuild'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {outputDebug, outputInfo} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../../models/app/loader.js')
vi.mock('../update-extension.js')

async function testBundlerAndFileWatcher() {
  const extension1 = await testUIExtension({
    devUUID: '1',
    directory: 'directory/path/1',
  })

  const extension2 = await testUIExtension({
    devUUID: '2',
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

describe('setupConfigWatcher()', async () => {
  const mockExtension: UIExtension = await testUIExtension({
    devUUID: '1',
    directory: 'directory/path/1',
  })
  const token = 'mock-token'
  const apiKey = 'mock-api-key'
  const registrationId = 'mock-registration-id'
  const stdout = new Writable()
  const stderr = new Writable()
  const specifications = await loadLocalUIExtensionsSpecifications()

  test('starts watching the configuration file', async () => {
    const chokidarCloseSpy = vi.fn()
    const chokidarOnSpy = vi.fn(() => {
      return {
        close: chokidarCloseSpy,
      }
    })

    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    const signal = new AbortController().signal

    await setupConfigWatcher({
      extension: mockExtension,
      token,
      apiKey,
      registrationId,
      stdout,
      stderr,
      signal,
      specifications,
    })

    expect(chokidar.watch).toHaveBeenCalledWith(mockExtension.configurationPath)
    expect(chokidarOnSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })

  test('when config file changes, it updates the drafts', async () => {
    const abortController = new AbortController()
    const chokidarOnSpy = vi.fn() as any
    vi.mocked(updateExtensionConfig).mockResolvedValue(undefined)

    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    await setupConfigWatcher({
      extension: mockExtension,
      token,
      apiKey,
      registrationId,
      stdout,
      stderr,
      signal: abortController.signal,
      specifications,
    })

    chokidarOnSpy.mock.calls[0][1]()

    expect(updateExtensionConfig).toHaveBeenCalledWith({
      apiKey: 'mock-api-key',
      extension: mockExtension,
      registrationId: 'mock-registration-id',
      specifications,
      stderr,
      token: 'mock-token',
    })
    expect(outputInfo).toHaveBeenCalledWith(`Config file at path ${mockExtension.configurationPath} changed`, stdout)
  })

  test('stops watching the config file when the signal aborts and close resolves', async () => {
    const abortController = new AbortController()
    const chokidarCloseSpy = vi.fn(() => Promise.resolve())
    const chokidarOnSpy = vi.fn(() => {
      return {
        close: chokidarCloseSpy,
      }
    })

    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    await setupConfigWatcher({
      extension: mockExtension,
      token,
      apiKey,
      registrationId,
      stdout,
      stderr,
      signal: abortController.signal,
      specifications,
    })

    abortController.abort()

    expect(chokidarCloseSpy).toHaveBeenCalled()
    expect(outputDebug).toHaveBeenCalledWith('Closing config file watching for extension with ID 1', stdout)
  })

  test('stops watching the config file when the signal aborts and close rejects', async () => {
    const abortController = new AbortController()
    const chokidarCloseSpy = vi.fn(() => Promise.reject(new Error('fail')))
    const chokidarOnSpy = vi.fn(() => {
      return {
        close: chokidarCloseSpy,
      }
    })

    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    await setupConfigWatcher({
      extension: mockExtension,
      token,
      apiKey,
      registrationId,
      stdout,
      stderr,
      signal: abortController.signal,
      specifications,
    })

    abortController.abort()

    await expect(chokidarCloseSpy).rejects.toThrow(new Error('fail'))
    expect(outputDebug).toHaveBeenLastCalledWith(
      'Config file watching failed to close for extension with 1: fail',
      stderr,
    )
  })
})

describe('setupNonPreviewableExtensionBundler()', async () => {
  const mockExtension: UIExtension = await testUIExtension({
    devUUID: '1',
    directory: 'directory/path/1',
  })

  const app = {
    dotenv: {
      variables: {
        SOME_KEY: 'SOME_VALUE',
      },
    },
  } as any

  const token = 'mock-token'
  const apiKey = 'mock-api-key'
  const registrationId = 'mock-registration-id'
  const stderr = new Writable()
  const stdout = new Writable()
  const abortController = new AbortController()

  test('calls bundleExtension with the correct parameters', async () => {
    vi.spyOn(bundle, 'bundleExtension').mockResolvedValue(undefined)

    await setupNonPreviewableExtensionBundler({
      extension: mockExtension,
      app,
      url: 'mock/url',
      token,
      apiKey,
      registrationId,
      stderr,
      stdout,
      signal: abortController.signal,
    })

    expect(bundle.bundleExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        minify: false,
        outputBundlePath: 'directory/path/1/dist/main.js',
        stdin: {
          contents: mockExtension.getBundleExtensionStdinContent(),
          resolveDir: 'directory/path/1',
          loader: 'tsx',
        },
        environment: 'development',
        env: {
          SOME_KEY: 'SOME_VALUE',
          APP_URL: 'mock/url',
        },
        stderr,
        stdout,
        watchSignal: abortController.signal,
      }),
    )
  })

  test('calls updateExtensionDraft when the bundle is built successfully', async () => {
    await setupNonPreviewableExtensionBundler({
      extension: mockExtension,
      app,
      url: 'mock/url',
      token,
      apiKey,
      registrationId,
      stderr,
      stdout,
      signal: abortController.signal,
    })

    const bundleExtensionFn = bundle.bundleExtension as any
    bundleExtensionFn.mock.calls[0][0].watch()

    expect(updateExtensionDraft).toHaveBeenCalledWith({
      extension: mockExtension,
      token,
      apiKey,
      registrationId,
      stderr,
    })
    expect(outputInfo).toHaveBeenCalledWith(`The Javascript bundle of the extension with ID 1 has changed`, stdout)
  })

  test('does not call updateExtensionDraft when the bundle has errors', async () => {
    await setupNonPreviewableExtensionBundler({
      extension: mockExtension,
      app,
      url: 'mock/url',
      token,
      apiKey,
      registrationId,
      stderr,
      stdout,
      signal: abortController.signal,
    })

    const buildFailure = {
      errors: ['error'] as any,
      warnings: [],
      outputFiles: [],
      metafile: {} as any,
      mangleCache: {},
    } as BuildResult
    const bundleExtensionFn = bundle.bundleExtension as any
    bundleExtensionFn.mock.calls[0][0].watch(buildFailure)

    expect(updateExtensionDraft).not.toHaveBeenCalled()
    expect(outputInfo).toHaveBeenCalledWith(`The Javascript bundle of the extension with ID 1 has an error`, stderr)
  })
})
