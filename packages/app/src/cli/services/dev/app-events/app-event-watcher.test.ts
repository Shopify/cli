import {EventType, ExtensionEvent, subscribeToAppEvents} from './app-event-watcher.js'
import {OutputContextOptions, WatcherEvent, startFileWatcher} from './file-watcher.js'
import {
  testApp,
  testAppAccessConfigExtension,
  testAppConfigExtensions,
  testSingleWebhookSubscriptionExtension,
  testUIExtension,
} from '../../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {loadApp} from '../../../models/app/loader.js'
import {flushPromises} from '../extension/bundler.test.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortSignal} from '@shopify/cli-kit/node/abort'

vi.mock('./file-watcher.js')
vi.mock('../../../models/app/loader.js')

// Extensions 1 and 1B simulate extensions defined in the same directory (same toml)
const extension1 = await testUIExtension({type: 'ui_extension', handle: 'h1', directory: '/extensions/ui_extension_1'})
const extension1B = await testUIExtension({type: 'ui_extension', handle: 'h2', directory: '/extensions/ui_extension_1'})
const extension2 = await testUIExtension({type: 'ui_extension', directory: '/extensions/ui_extension_2'})
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
    extensionEvents: [{type: EventType.Created, extension: extension2}],
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
    extensionEvents: [{type: EventType.UpdatedSourceFile, extension: extension1}],
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
    extensionEvents: [{type: EventType.Updated, extension: extension1}],
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
    extensionEvents: [{type: EventType.Updated, extension: extension1}],
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
      {type: EventType.UpdatedSourceFile, extension: extension1},
      {type: EventType.UpdatedSourceFile, extension: extension1B},
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
      {type: EventType.UpdatedSourceFile, extension: extension1},
      {type: EventType.UpdatedSourceFile, extension: extension1B},
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
      {type: EventType.UpdatedSourceFile, extension: extension1},
      {type: EventType.UpdatedSourceFile, extension: extension1B},
    ],
  },
  {
    name: 'app_config_update with multiple extensions affected',
    fileWatchEvent: {
      type: 'app_config_updated',
      path: 'shopify.app.toml',
      extensionPath: 'unknown',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension2, posExtension, webhookExtension],
    finalExtensions: [extension1, extension2, posExtensionUpdated, appAccessExtension],
    extensionEvents: [
      {type: EventType.Updated, extension: posExtensionUpdated},
      {type: EventType.Deleted, extension: webhookExtension},
      {type: EventType.Created, extension: appAccessExtension},
    ],
    needsAppReload: true,
  },
  {
    name: 'toml_updated with multiple extensions affected',
    fileWatchEvent: {
      type: 'toml_updated',
      path: '/extensions/ui_extension_1/shopify.ui.extension.toml',
      extensionPath: '/extensions/ui_extension_1',
      startTime: [0, 0],
    },
    initialExtensions: [extension1, extension1B, extension2],
    finalExtensions: [extension1Updated, extension1BUpdated, extension2],
    extensionEvents: [
      {type: EventType.UpdatedSourceFile, extension: extension1Updated},
      {type: EventType.UpdatedSourceFile, extension: extension1BUpdated},
    ],
    needsAppReload: true,
  },
]

describe('app-event-watcher when receiving a file event that doesnt require an app reload', () => {
  test.each(testCases)(
    'The event $name returns the expected AppEvent',
    async ({name, fileWatchEvent, initialExtensions, finalExtensions, extensionEvents, needsAppReload}) => {
      // Given
      vi.mocked(loadApp).mockResolvedValue(testApp({allExtensions: finalExtensions}))
      vi.mocked(startFileWatcher).mockImplementation(async (app, options, onChange) => onChange(fileWatchEvent))

      // When
      const onChange = vi.fn()
      await subscribeToAppEvents(
        testApp({
          allExtensions: initialExtensions,
          configuration: {scopes: '', extension_directories: [], path: 'shopify.app.toml'},
        }),
        outputOptions,
        onChange,
      )

      // Then
      await flushPromises()
      expect(onChange).toHaveBeenCalledWith({
        app: expect.objectContaining({realExtensions: finalExtensions}),
        extensionEvents: expect.arrayContaining(extensionEvents),
        startTime: expect.anything(),
      })
      if (needsAppReload) {
        expect(loadApp).toHaveBeenCalled()
      } else {
        expect(loadApp).not.toHaveBeenCalled()
      }
    },
  )
})
