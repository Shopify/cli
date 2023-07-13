import {
  FileWatcherOptions,
  SetupFunctionWatcherOptions,
  setupBundlerAndFileWatcher,
  setupConfigWatcher,
  setupDraftableExtensionBundler,
  setupFunctionWatcher,
} from './bundler.js'
import * as bundle from '../../extensions/bundle.js'
import {testUIExtension, testFunctionExtension, testApp} from '../../../models/app/app.test-data.js'
import {updateExtensionConfig, updateExtensionDraft} from '../update-extension.js'
import {FunctionConfigType} from '../../../models/extensions/specifications/function.js'
import * as extensionBuild from '../../../services/build/extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi} from 'vitest'
import chokidar from 'chokidar'
import {BuildResult} from 'esbuild'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {outputDebug, outputInfo, outputWarn} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../../models/app/loader.js')
vi.mock('../update-extension.js')
vi.mock('../../../services/build/extension.js')

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

function functionConfiguration(): FunctionConfigType {
  return {
    name: 'foo',
    type: 'function',
    api_version: '2023-07',
    configuration_ui: true,
    metafields: [],
    build: {},
  }
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
        outputPath: 'directory/path/1/dist/main.js',
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
        outputPath: 'directory/path/2/dist/main.js',
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
  const mockExtension = await testUIExtension({
    devUUID: '1',
    directory: 'directory/path/1',
  })
  const token = 'mock-token'
  const apiKey = 'mock-api-key'
  const registrationId = 'mock-registration-id'
  const stdout = new Writable()
  const stderr = new Writable()

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
      unifiedDeployment: true,
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
      unifiedDeployment: true,
    })

    chokidarOnSpy.mock.calls[0][1]()

    expect(updateExtensionConfig).toHaveBeenCalledWith({
      apiKey: 'mock-api-key',
      extension: mockExtension,
      registrationId: 'mock-registration-id',
      stdout,
      stderr,
      token: 'mock-token',
      unifiedDeployment: true,
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
      unifiedDeployment: true,
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
      unifiedDeployment: true,
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
  const mockExtension = await testUIExtension({
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

    await setupDraftableExtensionBundler({
      extension: mockExtension,
      app,
      url: 'mock/url',
      token,
      apiKey,
      registrationId,
      stderr,
      stdout,
      signal: abortController.signal,
      unifiedDeployment: true,
    })

    expect(bundle.bundleExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        minify: false,
        outputPath: 'directory/path/1/dist/main.js',
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
    await setupDraftableExtensionBundler({
      extension: mockExtension,
      app,
      url: 'mock/url',
      token,
      apiKey,
      registrationId,
      stderr,
      stdout,
      signal: abortController.signal,
      unifiedDeployment: true,
    })

    const bundleExtensionFn = bundle.bundleExtension as any
    bundleExtensionFn.mock.calls[0][0].watch()

    expect(updateExtensionDraft).toHaveBeenCalledWith({
      extension: mockExtension,
      token,
      apiKey,
      registrationId,
      stdout,
      stderr,
      unifiedDeployment: true,
    })
    expect(outputInfo).toHaveBeenCalledWith(`The Javascript bundle of the extension with ID 1 has changed`, stdout)
  })

  test('does not call updateExtensionDraft when the bundle has errors', async () => {
    await setupDraftableExtensionBundler({
      extension: mockExtension,
      app,
      url: 'mock/url',
      token,
      apiKey,
      registrationId,
      stderr,
      stdout,
      signal: abortController.signal,
      unifiedDeployment: true,
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

describe('setupFunctionWatcher', () => {
  interface MockWatcherOptionsArgs {
    watchPath: string | undefined
    signal?: AbortSignal | undefined
  }

  async function mockWatcherOptions({watchPath, signal}: MockWatcherOptionsArgs): Promise<SetupFunctionWatcherOptions> {
    const config = functionConfiguration()
    config.build = {
      watch: watchPath,
    }

    return {
      app: testApp(),
      extension: await testFunctionExtension({
        config,
        dir: 'foo',
      }),
      stdout: new Writable(),
      stderr: new Writable(),
      signal: signal ?? new AbortController().signal,
      apiKey: 'mock-api-key',
      registrationId: 'mock-registration-id',
      token: 'mock-token',
      unifiedDeployment: true,
    }
  }

  // Needed to test chokidar event handlers, which do not support async
  function flushPromises() {
    return new Promise((resolve) => setImmediate(resolve))
  }

  test('warns and does not watch if there are no watch paths', async () => {
    const watchOptions = await mockWatcherOptions({
      watchPath: undefined,
    })
    const chokidarSpy = vi.spyOn(chokidar, 'watch')

    await setupFunctionWatcher(watchOptions)

    expect(chokidarSpy).not.toHaveBeenCalled()
    expect(outputWarn).toHaveBeenCalledWith(
      expect.stringContaining(watchOptions.extension.localIdentifier),
      watchOptions.stdout,
    )
  })

  test('watches the provided paths', async () => {
    const watchOptions = await mockWatcherOptions({
      watchPath: '*.rs',
    })
    const chokidarOnSpy = vi.fn()
    const chokidarWatchSpy = vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    await setupFunctionWatcher(watchOptions)

    expect(chokidarWatchSpy).toHaveBeenCalledWith(expect.arrayContaining<string>([joinPath('foo', '*.rs')]))
    expect(chokidarOnSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })

  test('builds and deploys the function on file change', async () => {
    const watchOptions = await mockWatcherOptions({
      watchPath: '*.rs',
    })
    const chokidarOnSpy = vi.fn().mockImplementation((_event, handler) => {
      // call the file watch handler immediately
      handler('/src/main.rs')
    })
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)
    const buildSpy = vi.spyOn(extensionBuild, 'buildFunctionExtension').mockResolvedValue()

    await setupFunctionWatcher(watchOptions)
    await flushPromises()

    expect(chokidarOnSpy).toHaveBeenCalled()
    expect(outputDebug).toHaveBeenCalledWith(expect.stringContaining('/src/main.rs'), watchOptions.stdout)
    expect(buildSpy).toHaveBeenCalledWith(
      watchOptions.extension,
      expect.objectContaining({
        app: watchOptions.app,
        stdout: watchOptions.stdout,
        stderr: watchOptions.stderr,
        useTasks: false,
      }),
    )
    expect(updateExtensionDraft).toHaveBeenCalledWith({
      extension: watchOptions.extension,
      token: watchOptions.token,
      apiKey: watchOptions.apiKey,
      registrationId: watchOptions.registrationId,
      stdout: watchOptions.stdout,
      stderr: watchOptions.stderr,
      unifiedDeployment: watchOptions.unifiedDeployment,
    })
  })

  test('does not deploy the function if the build fails', async () => {
    const watchOptions = await mockWatcherOptions({
      watchPath: '*.rs',
    })
    const chokidarOnSpy = vi.fn().mockImplementation((_event, handler) => {
      // call the file watch handler immediately
      handler('/src/main.rs')
    })
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)
    const buildSpy = vi.spyOn(extensionBuild, 'buildFunctionExtension').mockRejectedValue('error')

    await setupFunctionWatcher(watchOptions)
    await flushPromises()

    expect(buildSpy).toHaveBeenCalled()
    expect(updateExtensionDraft).not.toHaveBeenCalled()
  })

  test('terminates existing builds on concurrent file change', async () => {
    const watchOptions = await mockWatcherOptions({
      watchPath: '*.rs',
    })
    const chokidarOnSpy = vi.fn().mockImplementation((_event, handler) => {
      // call the file watch handler twice
      handler('/src/main.rs')
      handler('/src/main.rs')
    })
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    let signal: AbortSignal | undefined
    vi.spyOn(extensionBuild, 'buildFunctionExtension')
      .mockImplementationOnce(
        async (extension: ExtensionInstance, options: extensionBuild.BuildFunctionExtensionOptions) => {
          signal = options.signal

          // simulate a build, defer execution to next handler
          return Promise.resolve()
        },
      )
      .mockResolvedValue()

    await setupFunctionWatcher(watchOptions)
    await flushPromises()

    expect(signal).toBeDefined()
    expect(signal?.aborted).toBe(true)
  })

  test('stops watching the function when the signal aborts and close resolves', async () => {
    const abortController = new AbortController()
    const watchOptions = await mockWatcherOptions({
      watchPath: '*.rs',
      signal: abortController.signal,
    })
    const chokidarCloseSpy = vi.fn(() => Promise.resolve())
    const chokidarOnSpy = vi.fn(() => {
      return {
        close: chokidarCloseSpy,
      }
    })
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    await setupFunctionWatcher(watchOptions)
    abortController.abort()

    expect(chokidarCloseSpy).toHaveBeenCalled()
    expect(outputDebug).toHaveBeenCalledWith(
      expect.stringContaining(watchOptions.extension.devUUID),
      watchOptions.stdout,
    )
  })

  test('stops watching the function when the signal aborts and close rejects', async () => {
    const abortController = new AbortController()
    const watchOptions = await mockWatcherOptions({
      watchPath: '*.rs',
      signal: abortController.signal,
    })
    const chokidarCloseSpy = vi.fn(() => Promise.reject(new Error('fail')))
    const chokidarOnSpy = vi.fn(() => {
      return {
        close: chokidarCloseSpy,
      }
    })
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    await setupFunctionWatcher(watchOptions)
    abortController.abort()

    await expect(chokidarCloseSpy).rejects.toThrow(new Error('fail'))
    expect(outputDebug).toHaveBeenLastCalledWith(expect.stringContaining('fail'), watchOptions.stderr)
  })
})
