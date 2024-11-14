import {AppEvent, AppEventWatcher, EventType, ExtensionEvent} from './app-event-watcher.js'
import {OutputContextOptions, WatcherEvent, startFileWatcher} from './file-watcher.js'
import {ESBuildContextManager} from './app-watcher-esbuild.js'
import {
  testApp,
  testAppAccessConfigExtension,
  testAppConfigExtensions,
  testAppLinked,
  testFlowActionExtension,
  testSingleWebhookSubscriptionExtension,
  testUIExtension,
} from '../../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {loadApp} from '../../../models/app/loader.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

vi.mock('./file-watcher.js')
vi.mock('../../../models/app/loader.js')
vi.mock('./app-watcher-esbuild.js')

// Extensions 1 and 1B simulate extensions defined in the same directory (same toml)
const extension1 = await testUIExtension({type: 'ui_extension', handle: 'h1', directory: '/extensions/ui_extension_1'})
const extension1B = await testUIExtension({type: 'ui_extension', handle: 'h2', directory: '/extensions/ui_extension_1'})
const extension2 = await testUIExtension({type: 'ui_extension', directory: '/extensions/ui_extension_2'})
const flowExtension = await testFlowActionExtension('/extensions/flow_action')
const posExtension = await testAppConfigExtensions()
const appAccessExtension = await testAppAccessConfigExtension()
const webhookExtension = await testSingleWebhookSubscriptionExtension()

// Simulate updated extensions
const extension1Updated = await testUIExtension({
  type: 'ui_extension',
  name: 'updated_name1',
  handle: 'h1',
  directory: '/extensions/ui_extension_1',
})
const extension1BUpdated = await testUIExtension({
  type: 'ui_extension',
  name: 'updated_name1B',
  handle: 'h2',
  directory: '/extensions/ui_extension_1',
})
const posExtensionUpdated = await testAppConfigExtensions(true)

const outputOptions: OutputContextOptions = {stdout: process.stdout, stderr: process.stderr, signal: new AbortSignal()}

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
    extensionEvents: [
      {type: EventType.Created, extension: extension2, buildResult: {status: 'ok', handle: 'test-ui-extension'}},
    ],
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
    extensionEvents: [{type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', handle: 'h1'}}],
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
    extensionEvents: [{type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', handle: 'h1'}}],
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
    extensionEvents: [{type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', handle: 'h1'}}],
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
      {type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', handle: 'h1'}},
      {type: EventType.Updated, extension: extension1B, buildResult: {status: 'ok', handle: 'h2'}},
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
      {type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', handle: 'h1'}},
      {type: EventType.Updated, extension: extension1B, buildResult: {status: 'ok', handle: 'h2'}},
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
      {type: EventType.Updated, extension: extension1, buildResult: {status: 'ok', handle: 'h1'}},
      {type: EventType.Updated, extension: extension1B, buildResult: {status: 'ok', handle: 'h2'}},
    ],
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
      {type: EventType.Updated, extension: posExtensionUpdated, buildResult: {status: 'ok', handle: 'point-of-sale'}},
      {type: EventType.Deleted, extension: webhookExtension},
      {type: EventType.Created, extension: appAccessExtension, buildResult: {status: 'ok', handle: 'app-access'}},
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
      {type: EventType.Updated, extension: extension1Updated, buildResult: {status: 'ok', handle: 'h1'}},
      {type: EventType.Updated, extension: extension1BUpdated, buildResult: {status: 'ok', handle: 'h2'}},
    ],
    needsAppReload: true,
  },
]

describe('app-event-watcher when receiving a file event', () => {
  test.each(testCases)(
    'The event $name returns the expected AppEvent',
    async ({fileWatchEvent, initialExtensions, finalExtensions, extensionEvents, needsAppReload}) => {
      // Given
      await inTemporaryDirectory(async (tmpDir) => {
        vi.mocked(loadApp).mockResolvedValue(testApp({allExtensions: finalExtensions}))
        vi.mocked(startFileWatcher).mockImplementation(async (app, options, onChange) => onChange([fileWatchEvent]))

        const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')

        // When
        const app = testAppLinked({
          allExtensions: initialExtensions,
          configuration: {scopes: '', extension_directories: [], path: 'shopify.app.custom.toml'},
        })

        const watcher = new AppEventWatcher(app, 'url', buildOutputPath, new MockESBuildContextManager())
        const emitSpy = vi.spyOn(watcher, 'emit')
        await watcher.start()

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
        })

        expect(emitSpy).toHaveBeenCalledWith('ready', app)

        if (needsAppReload) {
          expect(loadApp).toHaveBeenCalledWith({
            specifications: expect.anything(),
            directory: expect.anything(),
            // The app is loaded with the same configuration file
            userProvidedConfigName: 'shopify.app.custom.toml',
            remoteFlags: expect.anything(),
          })
        } else {
          expect(loadApp).not.toHaveBeenCalled()
        }
      })
    },
  )
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
      vi.mocked(startFileWatcher).mockImplementation(async (app, options, onChange) => onChange([fileWatchEvent]))

      // Given
      const esbuildError = {
        errors: [
          {
            text: 'Syntax error',
            location: {file: 'test.js', line: 1, column: 2, lineText: 'console.log(aa);'},
          },
        ],
      }

      const mockManager = new MockESBuildContextManager()
      mockManager.contexts.h1.rebuild.mockRejectedValueOnce(esbuildError)

      const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')
      const app = testAppLinked({
        allExtensions: [extension1],
        configuration: {scopes: '', extension_directories: [], path: 'shopify.app.custom.toml'},
      })

      // When
      const watcher = new AppEventWatcher(app, 'url', buildOutputPath, mockManager)
      const stderr = {write: vi.fn()} as unknown as Writable
      const stdout = {write: vi.fn()} as unknown as Writable

      await watcher.start({stdout, stderr, signal: new AbortSignal()})

      await flushPromises()

      // Then
      expect(stderr.write).toHaveBeenCalledWith(
        `✘ [ERROR] Syntax error

    test.js:1:2:
      1 │ console.log(aa);
        ╵   ^

`,
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
      vi.mocked(startFileWatcher).mockImplementation(async (app, options, onChange) => onChange([fileWatchEvent]))

      // Given
      const esbuildError = {message: 'Build failed'}
      flowExtension.buildForBundle = vi.fn().mockRejectedValueOnce(esbuildError)

      const buildOutputPath = joinPath(tmpDir, '.shopify', 'bundle')
      const app = testAppLinked({
        allExtensions: [flowExtension],
        configuration: {scopes: '', extension_directories: [], path: 'shopify.app.custom.toml'},
      })

      // When
      const watcher = new AppEventWatcher(app, 'url', buildOutputPath, new MockESBuildContextManager())
      const stderr = {write: vi.fn()} as unknown as Writable
      const stdout = {write: vi.fn()} as unknown as Writable

      await watcher.start({stdout, stderr, signal: new AbortSignal()})

      await flushPromises()

      // Then
      expect(stderr.write).toHaveBeenCalledWith(`Build failed`)
    })
  })
})

// Mock class for ESBuildContextManager
// It handles the ESBuild contexts for the extensions that are being watched
class MockESBuildContextManager extends ESBuildContextManager {
  contexts = {
    // The keys are the extension handles, the values are the ESBuild contexts mocked
    h1: {rebuild: vi.fn(), watch: vi.fn(), serve: vi.fn(), cancel: vi.fn(), dispose: vi.fn()},
    h2: {rebuild: vi.fn(), watch: vi.fn(), serve: vi.fn(), cancel: vi.fn(), dispose: vi.fn()},
    'test-ui-extension': {rebuild: vi.fn(), watch: vi.fn(), serve: vi.fn(), cancel: vi.fn(), dispose: vi.fn()},
  }

  constructor() {
    super({dotEnvVariables: {}, url: 'url', outputPath: 'outputPath'})
  }

  async createContexts(extensions: ExtensionInstance[]) {}
  async updateContexts(appEvent: AppEvent) {}
  async deleteContexts(extensions: ExtensionInstance[]) {}
}
