import {EventType, subscribeToAppEvents} from './app-event-watcher.js'
import {OutputContextOptions, WatcherEvent, startFileWatcher} from './file-watcher.js'
import {testApp, testAppConfigExtensions, testUIExtension} from '../../../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortSignal} from '@shopify/cli-kit/node/abort'

const outputOptions: OutputContextOptions = {stdout: process.stdout, stderr: process.stderr, signal: new AbortSignal()}
vi.mock('./file-watcher.js')
vi.mock('../../../../models/app/loader.js')

const extension1 = await testUIExtension({type: 'ui_extension', directory: '/extensions/ui_extension_1'})
const extension1B = await testUIExtension({type: 'ui_extension', directory: '/extensions/ui_extension_1'})
const extension2 = await testUIExtension({type: 'ui_extension', directory: '/extensions/ui_extension_2'})
const configExtension = await testAppConfigExtensions()
const newConfig = await testAppConfigExtensions(true)

// Each test case is an array containing the following elements:
// - A name for the test case
// - The event object triggered by the file watcher
// - The initial extensions in the app (before handling the event)
// - The expected result (after handling the event, the AppEvent received by the callback)
const testCases = [
  [
    'extension_folder_deleted affecting a single extension',
    {
      type: 'extension_folder_deleted',
      path: '/extensions/ui_extension_1',
      extensionPath: '/extensions/ui_extension_1',
    },
    [extension1, extension2, configExtension],
    {
      app: expect.objectContaining({realExtensions: [extension2, configExtension]}),
      extensionEvents: [{type: EventType.Deleted, extension: extension1}],
    },
  ],
  [
    'extension_folder_deleted affecting a multiple extensions',
    {
      type: 'extension_folder_deleted',
      path: '/extensions/ui_extension_1',
      extensionPath: '/extensions/ui_extension_1',
    },
    [extension1, extension1B, extension2, configExtension],
    {
      app: expect.objectContaining({realExtensions: [extension2, configExtension]}),
      extensionEvents: [
        {type: EventType.Deleted, extension: extension1},
        {type: EventType.Deleted, extension: extension1B},
      ],
    },
  ],
  [
    'file_created affecting a single extension',
    {
      type: 'file_created',
      path: '/extensions/ui_extension_1/src/file.js',
      extensionPath: '/extensions/ui_extension_1',
    },
    [extension1, extension2, configExtension],
    {
      app: expect.objectContaining({realExtensions: [extension1, extension2, configExtension]}),
      extensionEvents: [{type: EventType.UpdatedSourceFile, extension: extension1}],
    },
  ],
  [
    'file_updated affecting a single extension',
    {
      type: 'file_updated',
      path: '/extensions/ui_extension_1/locales/en.json',
      extensionPath: '/extensions/ui_extension_1',
    },
    [extension1, extension2, configExtension],
    {
      app: expect.objectContaining({realExtensions: [extension1, extension2, configExtension]}),
      extensionEvents: [{type: EventType.Updated, extension: extension1}],
    },
  ],
  [
    'file_deleted affecting a single extension',
    {
      type: 'file_deleted',
      path: '/extensions/ui_extension_1/locales/en.json',
      extensionPath: '/extensions/ui_extension_1',
    },
    [extension1, extension2, configExtension],
    {
      app: expect.objectContaining({realExtensions: [extension1, extension2, configExtension]}),
      extensionEvents: [{type: EventType.Updated, extension: extension1}],
    },
  ],
  [
    'file_created affecting a multiple extensions',
    {
      type: 'file_created',
      path: '/extensions/ui_extension_1/src/file.js',
      extensionPath: '/extensions/ui_extension_1',
    },
    [extension1, extension1B, extension2, configExtension],
    {
      app: expect.objectContaining({realExtensions: [extension1, extension1B, extension2, configExtension]}),
      extensionEvents: [
        {type: EventType.UpdatedSourceFile, extension: extension1},
        {type: EventType.UpdatedSourceFile, extension: extension1B},
      ],
    },
  ],
  [
    'file_updated affecting a multiple extensions',
    {
      type: 'file_updated',
      path: '/extensions/ui_extension_1/src/file.js',
      extensionPath: '/extensions/ui_extension_1',
    },
    [extension1, extension1B, extension2, configExtension],
    {
      app: expect.objectContaining({realExtensions: [extension1, extension1B, extension2, configExtension]}),
      extensionEvents: [
        {type: EventType.UpdatedSourceFile, extension: extension1},
        {type: EventType.UpdatedSourceFile, extension: extension1B},
      ],
    },
  ],
  [
    'file_deleted affecting a multiple extensions',
    {
      type: 'file_deleted',
      path: '/extensions/ui_extension_1/src/file.js',
      extensionPath: '/extensions/ui_extension_1',
    },
    [extension1, extension1B, extension2, configExtension],
    {
      app: expect.objectContaining({realExtensions: [extension1, extension1B, extension2, configExtension]}),
      extensionEvents: [
        {type: EventType.UpdatedSourceFile, extension: extension1},
        {type: EventType.UpdatedSourceFile, extension: extension1B},
      ],
    },
  ],
]

describe('app-event-watcher when receiving a file event that doesnt require an app reload', () => {
  test.each(testCases)(
    'The event %s returns the expected AppEvent',
    async (_name, event, initialExtensions, expectation) => {
      // Given
      vi.mocked(startFileWatcher).mockImplementation(async (app, options, onChange) => {
        onChange(event as WatcherEvent)
      })

      // When
      const onChange = vi.fn()
      await subscribeToAppEvents(
        testApp({allExtensions: initialExtensions as ExtensionInstance[]}),
        outputOptions,
        onChange,
      )

      // Then
      expect(onChange).toHaveBeenCalledWith(expectation)
    },
  )
})
