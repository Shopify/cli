import {AppEventWatcher, EventType, ExtensionEvent} from './app-event-watcher.js'
import {OutputContextOptions, WatcherEvent, FileWatcher} from './file-watcher.js'
import {
  testAppAccessConfigExtension,
  testAppConfigExtensions,
  testAppLinked,
  testFlowActionExtension,
  testSingleWebhookSubscriptionExtension,
  testUIExtension,
} from '../../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {loadApp, reloadApp} from '../../../models/app/loader.js'
import {AppLinkedInterface, CurrentAppConfiguration} from '../../../models/app/app.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {AppAccessSpecIdentifier} from '../../../models/extensions/specifications/app_config_app_access.js'
import {PosSpecIdentifier} from '../../../models/extensions/specifications/app_config_point_of_sale.js'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {AbortSignal, AbortController} from '@shopify/cli-kit/node/abort'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import {inTemporaryDirectory, mkdir, touchFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

vi.mock('../../../models/app/loader.js')

// Extensions 1 and 1B simulate extensions defined in the same directory (same toml)
const extension1 = await testUIExtension({
  type: 'ui_extension',
  handle: 'h1',
  directory: '/extensions/ui_extension_1',
  uid: 'uid1',
})
const extension1B = await testUIExtension({
  type: 'ui_extension',
  handle: 'h2',
  directory: '/extensions/ui_extension_1',
  uid: 'uid1B',
})
const extension2 = await testUIExtension({
  type: 'ui_extension',
  handle: 'h3',
  directory: '/extensions/ui_extension_2',
  uid: 'uid2',
})
const flowExtension = await testFlowActionExtension('/extensions/flow_action')
const posExtension = await testAppConfigExtensions()
const appAccessExtension = await testAppAccessConfigExtension()
const webhookExtension = await testSingleWebhookSubscriptionExtension()

// Simulate updated extensions
const extension1Updated = await testUIExtension({
  type: 'ui_extension',
  handle: 'h1',
  name: 'updated_name1',
  directory: '/extensions/ui_extension_1',
  uid: 'uid1',
})
const extension1BUpdated = await testUIExtension({
  type: 'ui_extension',
  handle: 'h2',
  name: 'updated_name1B',
  directory: '/extensions/ui_extension_1',
  uid: 'uid1B',
})
const posExtensionUpdated = await testAppConfigExtensions(true)

const outputOptions: OutputContextOptions = {stdout: process.stdout, stderr: process.stderr, signal: new AbortSignal()}

const testAppConfiguration: CurrentAppConfiguration = {
  client_id: 'test-client-id',
  access_scopes: {scopes: ''},
  extension_directories: [],
  name: 'my-app',
  application_url: 'https://example.com',
  embedded: true,
}

/**
 * Waits for the watcher to emit a given event by polling the emit spy.
 * This replaces fragile fixed-timeout waits (setTimeout(10)) that cause flaky tests when the async
 * event processing chain takes longer than expected.
 */
type EmitSpy = MockInstance<(eventName: string | symbol, ...args: unknown[]) => boolean>

async function waitForWatcherEmit(emitSpy: EmitSpy, event: string, timeoutMs = 3000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const startTime = Date.now()
    const poll = () => {
      const emitted = emitSpy.mock.calls.some((call) => call[0] === event)
      if (emitted) {
        resolve()
      } else if (Date.now() - startTime < timeoutMs) {
        setTimeout(poll, 10)
      } else {
        reject(new Error(`Timeout waiting for watcher to emit "${event}" event`))
      }
    }
    poll()
  })
}

/** Waits until successful change handling finishes (`emit('all', ...)`). */
async function waitForWatcherEvent(emitSpy: EmitSpy, timeoutMs = 3000): Promise<void> {
  await waitForWatcherEmit(emitSpy, 'all', timeoutMs)
}

/**
 * Test case for the app-event-watcher
 * Each test case is an object containing the following elements:
 * - A name for the test case
 * - The event object triggered by the file watcher
 * - The initial extensions in the app (before handling the event)
 * - The final extensions in the app (after handling the event)
 * - The expected extension events to be received by the onChange callback
 * - A flag indicating if the event requires an app reload (defaults to false)
 */
interface TestCase {
  name: string
  fileWatchEvent: WatcherEvent
  initialExtensions: ExtensionInstance[]
  finalExtensions: ExtensionInstance[]
  extensionEvents: ExtensionEvent[]
  needsAppReload?: boolean
}

const testCases: TestCase[] = [
  {
    name: 'extension_folder_deleted affecting a single extension',
    fileWatchEvent: {
      type: 'extension_folder_deleted',
      path: '/extensions/ui_extension_1',
      extensionPath: '/extensions/ui_extension_1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension2, posExtension],
    finalExtensions: [extension2, posExtension],
    extensionEvents: [{type: EventType.Deleted, extension: extension1}],
  },
  {
    name: 'extension_folder_deleted affecting a multiple extensions',
    fileWatchEvent: {
      type: 'extension_folder_deleted',
      path: '/extensions/ui_extension_1',
      extensionPath: '/extensions/ui_extension_1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension1B, extension2, posExtension],
    finalExtensions: [extension2, posExtension],
    extensionEvents: [
      {type: EventType.Deleted, extension: extension1},
      {type: EventType.Deleted, extension: extension1B},
    ],
  },
  {
    name: 'extension_folder_created',
    fileWatchEvent: {
      type: 'extension_folder_created',
      path: '/extensions/ui_extension_2',
      extensionPath: '/extensions/ui_extension_2',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, posExtension],
    finalExtensions: [extension1, extension2, posExtension],
    extensionEvents: [{type: EventType.Created, extension: extension2, buildResult: {status: 'ok', uid: 'uid2'}}],
    needsAppReload: true,
  },
  {
    name: 'file_created affecting a single extension',
    fileWatchEvent: {
      type: 'file_created',
      path: '/extensions/ui_extension_1/src/file.js',
      extensionPath: '/extensions/ui_extension_1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension2, posExtension],
    finalExtensions: [extension1, extension2, posExtension],
    extensionEvents: [{type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', uid: 'uid1'}}],
  },
  {
    name: 'file_updated affecting a single extension',
    fileWatchEvent: {
      type: 'file_updated',
      path: '/extensions/ui_extension_1/locales/en.json',
      extensionPath: '/extensions/ui_extension_1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension2, posExtension],
    finalExtensions: [extension1, extension2, posExtension],
    extensionEvents: [{type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', uid: 'uid1'}}],
  },
  {
    name: 'file_deleted affecting a single extension',
    fileWatchEvent: {
      type: 'file_deleted',
      path: '/extensions/ui_extension_1/locales/en.json',
      extensionPath: '/extensions/ui_extension_1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension2, posExtension],
    finalExtensions: [extension1, extension2, posExtension],
    extensionEvents: [{type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', uid: 'uid1'}}],
  },
  {
    name: 'file_updated not affecting any extension',
    fileWatchEvent: {
      type: 'file_updated',
      path: '/extensions/ui_extension_unknown/locales/en.json',
      extensionPath: '/extensions/ui_extension_unknown',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension2, posExtension],
    finalExtensions: [extension1, extension2, posExtension],
    extensionEvents: [],
  },
  {
    name: 'file_created affecting a multiple extensions',
    fileWatchEvent: {
      type: 'file_created',
      path: '/extensions/ui_extension_1/src/file.js',
      extensionPath: '/extensions/ui_extension_1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension1B, extension2, posExtension],
    finalExtensions: [extension1, extension1B, extension2, posExtension],
    extensionEvents: [
      {type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', uid: 'uid1'}},
      {type: EventType.Updated, extension: extension1B, buildResult: {status: 'ok', uid: 'uid1B'}},
    ],
  },
  {
    name: 'file_updated affecting a multiple extensions',
    fileWatchEvent: {
      type: 'file_updated',
      path: '/extensions/ui_extension_1/src/file.js',
      extensionPath: '/extensions/ui_extension_1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension1B, extension2, posExtension],
    finalExtensions: [extension1, extension1B, extension2, posExtension],
    extensionEvents: [
      {type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', uid: 'uid1'}},
      {type: EventType.Updated, extension: extension1B, buildResult: {status: 'ok', uid: 'uid1B'}},
    ],
  },
  {
    name: 'file_deleted affecting a multiple extensions',
    fileWatchEvent: {
      type: 'file_deleted',
      path: '/extensions/ui_extension_1/src/file.js',
      extensionPath: '/extensions/ui_extension_1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension1B, extension2, posExtension],
    finalExtensions: [extension1, extension1B, extension2, posExtension],
    extensionEvents: [
      {type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', uid: 'uid1'}},
      {type: EventType.Updated, extension: extension1B, buildResult: {status: 'ok', uid: 'uid1B'}},
    ],
  },
  {
    name: 'file_updated with extensionHandle targets only the specified extension',
    fileWatchEvent: {
      type: 'file_updated',
      path: '/extensions/ui_extension_1/src/file.js',
      extensionPath: '/extensions/ui_extension_1',
      extensionHandle: 'h1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension1B, extension2, posExtension],
    finalExtensions: [extension1, extension1B, extension2, posExtension],
    extensionEvents: [{type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', uid: 'uid1'}}],
  },
  {
    name: 'file_created with extensionHandle targets only the specified extension',
    fileWatchEvent: {
      type: 'file_created',
      path: '/extensions/ui_extension_1/src/new-file.js',
      extensionPath: '/extensions/ui_extension_1',
      extensionHandle: 'h2',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension1B, extension2, posExtension],
    finalExtensions: [extension1, extension1B, extension2, posExtension],
    extensionEvents: [{type: EventType.Updated, extension: extension1B, buildResult: {status: 'ok', uid: 'uid1B'}}],
  },
  {
    name: 'app config updated with multiple extensions affected',
    fileWatchEvent: {
      type: 'extensions_config_updated',
      path: 'shopify.app.custom.toml',
      extensionPath: '/',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension2, posExtension, webhookExtension],
    finalExtensions: [extension1, extension2, posExtensionUpdated, appAccessExtension],
    extensionEvents: [
      {
        type: EventType.Updated,
        extension: posExtensionUpdated,
        buildResult: {status: 'ok', uid: PosSpecIdentifier},
      },
      {type: EventType.Deleted, extension: webhookExtension},
      {
        type: EventType.Created,
        extension: appAccessExtension,
        buildResult: {status: 'ok', uid: AppAccessSpecIdentifier},
      },
    ],
    needsAppReload: true,
  },
  {
    name: 'extensions_config_updated with multiple extensions affected',
    fileWatchEvent: {
      type: 'extensions_config_updated',
      path: '/extensions/ui_extension_1/shopify.ui.extension.toml',
      extensionPath: '/extensions/ui_extension_1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension1B, extension2],
    finalExtensions: [extension1Updated, extension1BUpdated, extension2],
    extensionEvents: [
      {type: EventType.Updated, extension: extension1Updated, buildResult: {status: 'ok', uid: 'uid1'}},
      {type: EventType.Updated, extension: extension1BUpdated, buildResult: {status: 'ok', uid: 'uid1B'}},
    ],
    needsAppReload: true,
  },
]

describe('app-event-watcher', () => {
  let abortController: AbortController
  let stdout: any
  let stderr: any

  beforeEach(() => {
    stdout = {write: vi.fn()}
    stderr = {write: vi.fn()}
    abortController = new AbortController()

    // Mock buildForBundle on all test extensions so the watcher doesn't attempt real builds
    const allExtensions = [
      extension1,
      extension1B,
      extension2,
      extension1Updated,
      extension1BUpdated,
      flowExtension,
      posExtension,
      posExtensionUpdated,
      appAccessExtension,
      webhookExtension,
    ]
    for (const ext of allExtensions) {
      vi.spyOn(ext, 'buildForBundle').mockResolvedValue()
      vi.spyOn(ext, 'rescanImports').mockResolvedValue(false)
    }
  })

  afterEach(() => {
    abortController.abort()
  })
  describe('when receiving a file event', () => {
    test.each(testCases)(
      'The event $name returns the expected AppEvent',
      async ({fileWatchEvent, initialExtensions, finalExtensions, extensionEvents, needsAppReload}) => {
        // Given
        await inTemporaryDirectory(async (tmpDir) => {
          const mockedApp = testAppLinked({allExtensions: finalExtensions})
          vi.mocked(loadApp).mockResolvedValue(mockedApp)
          vi.mocked(reloadApp).mockResolvedValue(mockedApp)

          const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')

          // When
          const app = testAppLinked({
            allExtensions: initialExtensions,
            configPath: 'shopify.app.custom.toml',
            configuration: testAppConfiguration,
          })

          const mockFileWatcher = new MockFileWatcher(app, outputOptions, [fileWatchEvent])
          const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)
          const emitSpy = vi.spyOn(watcher, 'emit')
          await watcher.start({stdout, stderr, signal: abortController.signal})

          await flushPromises()

          // Wait until emitSpy has been called at least once
          // We need this because there are I/O operations that make the test finish before the event is emitted
          await new Promise<void>((resolve, reject) => {
            const initialTime = Date.now()
            const checkEmitSpy = () => {
              const allCalled = emitSpy.mock.calls.some((call) => call[0] === 'all')
              const readyCalled = emitSpy.mock.calls.some((call) => call[0] === 'ready')
              if (allCalled && readyCalled) {
                resolve()
              } else if (Date.now() - initialTime < 3000) {
                setTimeout(checkEmitSpy, 100)
              } else {
                reject(new Error('Timeout waiting for emitSpy to be called'))
              }
            }
            checkEmitSpy()
          })

          expect(emitSpy).toHaveBeenCalledWith('all', {
            app: expect.objectContaining({realExtensions: finalExtensions}),
            extensionEvents: expect.arrayContaining(extensionEvents),
            startTime: expect.anything(),
            path: expect.anything(),
            appWasReloaded: needsAppReload,
          })

          const initialEvents = app.realExtensions.map((eve) => ({
            type: EventType.Updated,
            extension: eve,
            buildResult: {status: 'ok', uid: eve.uid},
          }))
          expect(emitSpy).toHaveBeenCalledWith('ready', {
            app,
            extensionEvents: expect.arrayContaining(initialEvents),
          })

          if (needsAppReload) {
            expect(reloadApp).toHaveBeenCalled()
          } else {
            expect(reloadApp).not.toHaveBeenCalled()
          }
        })
      },
    )
  })

  describe('waitForStaticRoots', () => {
    test('waits for static_root directory to be populated before building extensions', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')

        // Create an admin extension with static_root pointing to ./dist
        const allSpecs = await loadLocalExtensionsSpecifications()
        const adminSpec = allSpecs.find((spec) => spec.identifier === 'admin')!
        const adminExtension = new ExtensionInstance({
          configuration: {admin: {static_root: './dist'}} as any,
          configurationPath: joinPath(tmpDir, 'shopify.app.toml'),
          directory: tmpDir,
          specification: adminSpec,
        })
        vi.spyOn(adminExtension, 'buildForBundle').mockResolvedValue()

        const app = testAppLinked({
          allExtensions: [adminExtension],
          configuration: testAppConfiguration,
        })

        // Simulate the web dev process creating dist/ after a delay
        setTimeout(() => {
          const distDir = joinPath(tmpDir, 'dist')
          mkdir(distDir)
            .then(() => touchFile(joinPath(distDir, 'index.html')))
            .catch(() => {})
        }, 300)

        const mockFileWatcher = new MockFileWatcher(app, outputOptions, [])
        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)
        await watcher.start({stdout, stderr, signal: abortController.signal})

        // Extension should have been built (after waiting for dist/)
        expect(adminExtension.buildForBundle).toHaveBeenCalled()
      })
    })

    test('proceeds immediately when static_root already has files', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')

        // Pre-create dist/ with files
        const distDir = joinPath(tmpDir, 'dist')
        await mkdir(distDir)
        await touchFile(joinPath(distDir, 'index.html'))

        const allSpecs = await loadLocalExtensionsSpecifications()
        const adminSpec = allSpecs.find((spec) => spec.identifier === 'admin')!
        const adminExtension = new ExtensionInstance({
          configuration: {admin: {static_root: './dist'}} as any,
          configurationPath: joinPath(tmpDir, 'shopify.app.toml'),
          directory: tmpDir,
          specification: adminSpec,
        })
        vi.spyOn(adminExtension, 'buildForBundle').mockResolvedValue()

        const app = testAppLinked({
          allExtensions: [adminExtension],
          configuration: testAppConfiguration,
        })

        const mockFileWatcher = new MockFileWatcher(app, outputOptions, [])
        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)

        const startTime = Date.now()
        await watcher.start({stdout, stderr, signal: abortController.signal})
        const elapsed = Date.now() - startTime

        // Should not have waited — proceeds immediately
        expect(elapsed).toBeLessThan(1000)
        expect(adminExtension.buildForBundle).toHaveBeenCalled()
      })
    })

    test('skips waiting when no admin extension has static_root', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')

        // extension1 is a UI extension, no static_root
        const app = testAppLinked({
          allExtensions: [extension1],
          configuration: testAppConfiguration,
        })

        const mockFileWatcher = new MockFileWatcher(app, outputOptions, [])
        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)

        const startTime = Date.now()
        await watcher.start({stdout, stderr, signal: abortController.signal})
        const elapsed = Date.now() - startTime

        // Should not have waited at all
        expect(elapsed).toBeLessThan(1000)
        expect(extension1.buildForBundle).toHaveBeenCalled()
      })
    })
  })

  describe('generateExtensionTypes', () => {
    test('is called after extensions are rebuilt on file changes', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const fileWatchEvent: WatcherEvent = {
          type: 'file_updated',
          path: '/extensions/ui_extension_1/src/file.js',
          extensionPath: '/extensions/ui_extension_1',
          startTime: [0, 0],
        }

        // Given
        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')
        const app = testAppLinked({
          allExtensions: [extension1],
          configPath: 'shopify.app.custom.toml',
          configuration: testAppConfiguration,
        })
        const generateTypesSpy = vi.spyOn(app, 'generateExtensionTypes')

        const mockFileWatcher = new MockFileWatcher(app, outputOptions, [fileWatchEvent])
        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)
        const emitSpy = vi.spyOn(watcher, 'emit')

        // When
        await watcher.start({stdout, stderr, signal: abortController.signal})
        await waitForWatcherEvent(emitSpy)

        // Then
        expect(generateTypesSpy).toHaveBeenCalled()
      })
    })

    test('is not called again when extensions are created (already called during app reload)', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const fileWatchEvent: WatcherEvent = {
          type: 'extension_folder_created',
          path: '/extensions/ui_extension_2',
          extensionPath: '/extensions/ui_extension_2',
          startTime: [0, 0],
        }

        // Given
        const mockedApp = testAppLinked({allExtensions: [extension1, extension2]})
        const generateTypesSpy = vi.spyOn(mockedApp, 'generateExtensionTypes')
        vi.mocked(reloadApp).mockResolvedValue(mockedApp)

        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')
        const app = testAppLinked({
          allExtensions: [extension1],
          configPath: 'shopify.app.custom.toml',
          configuration: testAppConfiguration,
        })

        const mockFileWatcher = new MockFileWatcher(app, outputOptions, [fileWatchEvent])
        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)
        const emitSpy = vi.spyOn(watcher, 'emit')

        // When
        await watcher.start({stdout, stderr, signal: abortController.signal})
        await waitForWatcherEvent(emitSpy)

        // Then - not called in watcher because it was already called during reloadApp
        expect(generateTypesSpy).not.toHaveBeenCalled()
      })
    })

    test('is not called again when app config is updated (already called during app reload)', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const fileWatchEvent: WatcherEvent = {
          type: 'extensions_config_updated',
          path: 'shopify.app.custom.toml',
          extensionPath: '/',
          startTime: [0, 0],
        }

        // Given
        const mockedApp = testAppLinked({allExtensions: [extension1, posExtensionUpdated]})
        const generateTypesSpy = vi.spyOn(mockedApp, 'generateExtensionTypes')
        vi.mocked(reloadApp).mockResolvedValue(mockedApp)

        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')
        const app = testAppLinked({
          allExtensions: [extension1, posExtension],
          configPath: 'shopify.app.custom.toml',
          configuration: testAppConfiguration,
        })

        const mockFileWatcher = new MockFileWatcher(app, outputOptions, [fileWatchEvent])
        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)
        const emitSpy = vi.spyOn(watcher, 'emit')

        // When
        await watcher.start({stdout, stderr, signal: abortController.signal})
        await waitForWatcherEvent(emitSpy)

        // Then - not called in watcher because it was already called during reloadApp
        expect(generateTypesSpy).not.toHaveBeenCalled()
      })
    })

    test('is called when extensions are deleted to clean up types', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const fileWatchEvent: WatcherEvent = {
          type: 'extension_folder_deleted',
          path: '/extensions/ui_extension_1',
          extensionPath: '/extensions/ui_extension_1',
          startTime: [0, 0],
        }

        // Given
        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')
        const app = testAppLinked({
          allExtensions: [extension1, extension2],
          configPath: 'shopify.app.custom.toml',
          configuration: testAppConfiguration,
        })
        const generateTypesSpy = vi.spyOn(app, 'generateExtensionTypes')

        const mockFileWatcher = new MockFileWatcher(app, outputOptions, [fileWatchEvent])
        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)
        const emitSpy = vi.spyOn(watcher, 'emit')

        // When
        await watcher.start({stdout, stderr, signal: abortController.signal})
        await waitForWatcherEvent(emitSpy)

        // Then - generateExtensionTypes should still be called when extensions are deleted
        // to clean up type definitions for the removed extension
        expect(generateTypesSpy).toHaveBeenCalled()
      })
    })
  })

  describe('app-event-watcher build extension errors', () => {
    test('esbuild errors are logged with a custom format', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const fileWatchEvent: WatcherEvent = {
          type: 'file_updated',
          path: '/extensions/ui_extension_1/src/file.js',
          extensionPath: '/extensions/ui_extension_1',
          startTime: [0, 0],
        }

        // Given
        const esbuildError = {
          errors: [
            {
              text: 'Syntax error',
              location: {file: 'test.js', line: 1, column: 2, lineText: 'console.log(aa);'},
            },
          ],
        }

        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')
        const app = testAppLinked({
          allExtensions: [extension1],
          configPath: 'shopify.app.custom.toml',
          configuration: testAppConfiguration,
        })
        // First call succeeds (initial build on start), second call fails (file watcher triggered build)
        vi.spyOn(extension1, 'buildForBundle').mockResolvedValueOnce().mockRejectedValueOnce(esbuildError)
        const mockFileWatcher = new MockFileWatcher(app, outputOptions, [fileWatchEvent])

        // When
        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)
        const emitSpy = vi.spyOn(watcher, 'emit')
        const stderr = {write: vi.fn()} as unknown as Writable
        const stdout = {write: vi.fn()} as unknown as Writable
        await watcher.start({stdout, stderr, signal: abortController.signal})

        await waitForWatcherEvent(emitSpy)

        // Then
        expect(stderr.write).toHaveBeenCalledWith(
          expect.stringContaining(
            `[ERROR] Syntax error

    test.js:1:2:
      1 │ console.log(aa);
        ╵   ^

`,
          ),
        )
      })
    })

    test('general build errors are logged as plain messages', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const fileWatchEvent: WatcherEvent = {
          type: 'file_updated',
          path: '/extensions/flow_action/src/file.js',
          extensionPath: '/extensions/flow_action',
          startTime: [0, 0],
        }

        // Given
        const buildError = {message: 'Build failed'}
        flowExtension.buildForBundle = vi.fn().mockRejectedValueOnce(buildError)

        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')
        const app = testAppLinked({
          allExtensions: [flowExtension],
          configPath: 'shopify.app.custom.toml',
          configuration: testAppConfiguration,
        })

        // When

        const mockFileWatcher = new MockFileWatcher(app, outputOptions, [fileWatchEvent])
        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)
        const emitSpy = vi.spyOn(watcher, 'emit')
        const stderr = {write: vi.fn()} as unknown as Writable
        const stdout = {write: vi.fn()} as unknown as Writable

        await watcher.start({stdout, stderr, signal: abortController.signal})

        await waitForWatcherEvent(emitSpy)

        // Then
        expect(stderr.write).toHaveBeenCalledWith(`Build failed`)
      })
    })

    test('uncaught errors are emitted', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const fileWatchEvent: WatcherEvent = {
          type: 'file_updated',
          path: '/extensions/ui_extension_1/src/file.js',
          extensionPath: '/extensions/ui_extension_1',
          startTime: [0, 0],
        }

        // Given
        const uncaughtError = new Error('Unexpected error')

        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')
        const app = testAppLinked({
          allExtensions: [extension1],
          configPath: 'shopify.app.custom.toml',
          configuration: testAppConfiguration,
        })

        // Make rescanImports throw to simulate an uncaught error in the watcher pipeline
        vi.spyOn(extension1, 'rescanImports').mockRejectedValueOnce(uncaughtError)

        const mockFileWatcher = new MockFileWatcher(app, outputOptions, [fileWatchEvent])

        // When
        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockFileWatcher)
        const emitSpy = vi.spyOn(watcher, 'emit')
        const stderr = {write: vi.fn()} as unknown as Writable
        const stdout = {write: vi.fn()} as unknown as Writable
        const errorHandler = vi.fn()
        watcher.onError(errorHandler)

        await watcher.start({stdout, stderr, signal: abortController.signal})

        await waitForWatcherEmit(emitSpy, 'error')

        // Then
        expect(errorHandler).toHaveBeenCalledWith(uncaughtError)
      })
    })
  })
})
// Mock class for FileWatcher
// Used to trigger mocked file system events immediately after the watcher is started.
class MockFileWatcher extends FileWatcher {
  private readonly events: WatcherEvent[]
  private listener?: (events: WatcherEvent[]) => void

  constructor(app: AppLinkedInterface, options: OutputContextOptions, events: WatcherEvent[]) {
    super(app, options)
    this.events = events
  }

  async start(): Promise<void> {
    // Trigger events asynchronously to allow AppEventWatcher to complete initialization
    if (this.listener) {
      setTimeout(() => {
        this.listener?.(this.events)
      }, 0)
    }
  }

  onChange(listener: (events: WatcherEvent[]) => void) {
    this.listener = listener
  }

  updateApp(_app: AppLinkedInterface): void {
    // Mock implementation
  }
}
