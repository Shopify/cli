import {
  FileWatcherOptions,
  SetupExtensionWatcherOptions,
  setupBundlerAndFileWatcher,
  setupExtensionWatcher,
} from './bundler.js'
import * as bundle from '../../extensions/bundle.js'
import {
  testUIExtension,
  testFunctionExtension,
  testApp,
  testAppConfigExtensions,
} from '../../../models/app/app.test-data.js'
import {reloadExtensionConfig} from '../update-extension.js'
import {FunctionConfigType} from '../../../models/extensions/specifications/function.js'
import * as extensionBuild from '../../../services/build/extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {BaseConfigType} from '../../../models/extensions/schemas.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import chokidar from 'chokidar'
import {BuildResult} from 'esbuild'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as cliKitFS from '@shopify/cli-kit/node/fs'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../../models/app/loader.js')
vi.mock('../update-extension.js')
vi.mock('../../../services/build/extension.js')
vi.mock('../update-extension.js')

async function testBundlerAndFileWatcher() {
  const extension1 = await testUIExtension({
    devUUID: '1',
    directory: 'directory/path/1',
    configuration: {
      handle: 'my-handle',
      name: 'test-ui-extension',
      type: 'product_subscription',
      metafields: [],
    },
  })

  const extension2 = await testUIExtension({
    devUUID: '2',
    directory: 'directory/path/2',
    configuration: {
      handle: 'my-handle-2',
      name: 'test-ui-extension',
      type: 'product_subscription',
      metafields: [],
    },
  })

  const fileWatcherOptions = {
    devOptions: {
      extensions: [extension1, extension2],
      appDotEnvFile: {
        variables: {
          SOME_KEY: 'SOME_VALUE',
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
        outputPath: 'directory/path/1/dist/my-handle.js',
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
        outputPath: 'directory/path/2/dist/my-handle-2.js',
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

describe('setupExtensionWatcher', () => {
  beforeEach(() => {
    const config = {type: 'type', name: 'name', path: 'path', metafields: []}
    vi.mocked(reloadExtensionConfig).mockResolvedValue({newConfig: config, previousConfig: config})
  })
  interface MockWatcherOptionsArgs {
    watchPath: string | undefined
    signal?: AbortSignal | undefined
  }

  async function mockWatcherOptions({
    watchPath,
    signal,
  }: MockWatcherOptionsArgs): Promise<SetupExtensionWatcherOptions> {
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
      url: 'mock/url',
      stdout: new Writable(),
      stderr: new Writable(),
      signal: signal ?? new AbortController().signal,
      onChange: vi.fn(),
    }
  }

  async function mockWatcherConfigurationOptions(): Promise<SetupExtensionWatcherOptions> {
    const configurationExtension = await testAppConfigExtensions()

    return {
      app: testApp(),
      extension: configurationExtension,
      url: 'mock/url',
      stdout: new Writable(),
      stderr: new Writable(),
      signal: new AbortController().signal,
      onChange: vi.fn(),
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

    await setupExtensionWatcher(watchOptions)

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

    await setupExtensionWatcher(watchOptions)

    expect(chokidarWatchSpy).toHaveBeenCalledWith(expect.arrayContaining<string>([joinPath('foo', '*.rs')]), {
      ignored: '**/*.test.*',
    })
    expect(chokidarOnSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })

  test('deploys the function on file change in locales directory', async () => {
    // Given
    vi.spyOn(cliKitFS, 'fileExists').mockResolvedValue(true)

    const watchOptions = await mockWatcherOptions({
      watchPath: '*.rs',
    })

    const chokidarOnSpy = vi.fn().mockImplementation((_event, handler) => {
      // Call the file watch handler immediately
      handler(`${watchOptions.extension.directory}/locales/en.json`)
    })

    // When
    const chokidarWatchSpy = vi.spyOn(chokidar, 'watch').mockImplementation((path) => {
      if (path.toString().includes('locales')) {
        return {
          on: chokidarOnSpy,
        } as any
      }
      return {
        on: vi.fn(),
      } as any
    })

    await setupExtensionWatcher(watchOptions)
    await flushPromises()

    // Then
    expect(chokidarOnSpy).toHaveBeenCalled()
    expect(chokidarWatchSpy).toHaveBeenCalledWith(
      [
        `${watchOptions.extension.directory}/*.rs`,
        `${watchOptions.extension.directory}/**/!(.)*.graphql`,
        `${watchOptions.extension.directory}/locales/**.json`,
        `${watchOptions.extension.directory}/**.toml`,
      ],
      {
        ignored: '**/*.test.*',
      },
    )
    expect(reloadExtensionConfig).toHaveBeenCalled()
  })

  test('builds and deploys the function on file change', async () => {
    const watchOptions = await mockWatcherOptions({
      watchPath: '*.rs',
    })
    const chokidarOnSpy = vi.fn().mockImplementation((_event, handler) => {
      // call the file watch handler immediately
      handler('foo/main.rs')
    })
    vi.spyOn(chokidar, 'watch').mockImplementation((path) => {
      return {on: chokidarOnSpy} as any
    })

    const buildSpy = vi.spyOn(extensionBuild, 'buildFunctionExtension').mockResolvedValue()

    await setupExtensionWatcher(watchOptions)
    await flushPromises()

    expect(chokidarOnSpy).toHaveBeenCalled()
    expect(outputDebug).toHaveBeenCalledWith(expect.stringContaining('foo/main.rs'), watchOptions.stdout)
    expect(buildSpy).toHaveBeenCalledWith(
      watchOptions.extension,
      expect.objectContaining({
        app: watchOptions.app,
        stdout: watchOptions.stdout,
        stderr: watchOptions.stderr,
        useTasks: false,
      }),
    )
    expect(reloadExtensionConfig).toHaveBeenCalledWith({
      extension: watchOptions.extension,
      stdout: watchOptions.stdout,
    })
    expect(watchOptions.onChange).toHaveBeenCalled()
  })

  test('does not deploy the function if the build fails', async () => {
    const watchOptions = await mockWatcherOptions({
      watchPath: '*.rs',
    })
    const chokidarOnSpy = vi.fn().mockImplementation((_event, handler) => {
      // call the file watch handler immediately
      handler('foo/main.rs')
    })
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: chokidarOnSpy,
    } as any)

    const buildSpy = vi.spyOn(extensionBuild, 'buildFunctionExtension').mockRejectedValue('error')

    await setupExtensionWatcher(watchOptions)
    await flushPromises()

    expect(buildSpy).toHaveBeenCalled()
    expect(watchOptions.onChange).not.toHaveBeenCalled()
  })

  test('terminates existing builds on concurrent file change', async () => {
    const watchOptions = await mockWatcherOptions({
      watchPath: '*.rs',
    })
    const chokidarOnSpy = vi.fn().mockImplementation((_event, handler) => {
      // call the file watch handler twice
      handler('foo/main.rs')
      handler('foo/main.rs')
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

    await setupExtensionWatcher(watchOptions)
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

    await setupExtensionWatcher(watchOptions)
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

    await setupExtensionWatcher(watchOptions)
    abortController.abort()

    await expect(chokidarCloseSpy).rejects.toThrow(new Error('fail'))
    expect(outputDebug).toHaveBeenLastCalledWith(expect.stringContaining('fail'), watchOptions.stderr)
  })
  test('deploy the configuration extension when the values are modified', async () => {
    // Given
    const newConfig = {pos: {embeded: true}, path: 'shopify.app.toml'} as unknown as BaseConfigType & {path: string}
    const previousConfig = {pos: {embeded: false}, path: 'shopify.app.toml'} as unknown as BaseConfigType & {
      path: string
    }
    vi.mocked(reloadExtensionConfig).mockResolvedValue({newConfig, previousConfig})
    const watchOptions = await mockWatcherConfigurationOptions()
    const buildSpy = vi.spyOn(watchOptions.extension, 'build')
    const chokidarOnSpy = vi.fn().mockImplementation((_event, handler) => {
      // call the file watch handler immediately
      handler('shopify.app.toml')
    })
    vi.spyOn(chokidar, 'watch').mockImplementation((path) => {
      return {on: chokidarOnSpy} as any
    })

    // When
    await setupExtensionWatcher(watchOptions)
    await flushPromises()

    // Them
    expect(buildSpy).not.toHaveBeenCalled()
    expect(chokidarOnSpy).toHaveBeenCalled()
    expect(reloadExtensionConfig).toHaveBeenCalledWith({
      extension: watchOptions.extension,
      stdout: watchOptions.stdout,
    })
    expect(watchOptions.onChange).toHaveBeenCalled()
  })
  test('dont deploy the configuration extension when the values are the same', async () => {
    // Given
    const newConfig = {pos: {embeded: true}, path: 'shopify.app.toml'} as unknown as BaseConfigType & {path: string}
    const previousConfig = {pos: {embeded: true}, path: 'shopify.app.toml'} as unknown as BaseConfigType & {
      path: string
    }
    vi.mocked(reloadExtensionConfig).mockResolvedValue({newConfig, previousConfig})
    const watchOptions = await mockWatcherConfigurationOptions()
    const buildSpy = vi.spyOn(watchOptions.extension, 'build')
    const chokidarOnSpy = vi.fn().mockImplementation((_event, handler) => {
      // call the file watch handler immediately
      handler('shopify.app.toml')
    })
    vi.spyOn(chokidar, 'watch').mockImplementation((path) => {
      return {on: chokidarOnSpy} as any
    })

    // When
    await setupExtensionWatcher(watchOptions)
    await flushPromises()

    // Them
    expect(buildSpy).not.toHaveBeenCalled()
    expect(chokidarOnSpy).toHaveBeenCalled()
    expect(reloadExtensionConfig).toHaveBeenCalledWith({
      extension: watchOptions.extension,
      stdout: watchOptions.stdout,
    })
    expect(watchOptions.onChange).not.toHaveBeenCalled()
  })
  test('dont deploy the configuration extension when an error is produced', async () => {
    // Given
    vi.mocked(reloadExtensionConfig).mockRejectedValue(new Error('config.path: wrong value'))
    const watchOptions = await mockWatcherConfigurationOptions()
    const buildSpy = vi.spyOn(watchOptions.extension, 'build')
    const chokidarOnSpy = vi.fn().mockImplementation((_event, handler) => {
      // call the file watch handler immediately
      handler('shopify.app.toml')
    })
    vi.spyOn(chokidar, 'watch').mockImplementation((path) => {
      return {on: chokidarOnSpy} as any
    })

    // When
    await setupExtensionWatcher(watchOptions)
    await flushPromises()

    // Them
    expect(buildSpy).not.toHaveBeenCalled()
    expect(chokidarOnSpy).toHaveBeenCalled()
    expect(reloadExtensionConfig).toHaveBeenCalledWith({
      extension: watchOptions.extension,
      stdout: watchOptions.stdout,
    })
    expect(watchOptions.onChange).not.toHaveBeenCalled()
    expect(outputWarn).not.toHaveBeenCalled()
  })
})
