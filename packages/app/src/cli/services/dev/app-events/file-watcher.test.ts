import {FileWatcher, OutputContextOptions, WatcherEvent} from './file-watcher.js'
import {
  testAppAccessConfigExtension,
  testAppConfigExtensions,
  testAppLinked,
  testFunctionExtension,
  testUIExtension,
} from '../../../models/app/app.test-data.js'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import {describe, expect, test, vi} from 'vitest'
import chokidar from 'chokidar'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {sleep} from '@shopify/cli-kit/node/system'

// Mock the import extractor to avoid scanning for imports
vi.mock('@shopify/cli-kit/node/import-extractor', () => ({
  extractImportPaths: vi.fn().mockResolvedValue([]),
}))

const extension1 = await testUIExtension({type: 'ui_extension', handle: 'h1', directory: '/extensions/ui_extension_1'})
const extension1B = await testUIExtension({type: 'ui_extension', handle: 'h2', directory: '/extensions/ui_extension_1'})
const extension2 = await testUIExtension({type: 'ui_extension', directory: '/extensions/ui_extension_2'})
const functionExtension = await testFunctionExtension({dir: '/extensions/my-function'})
const posExtension = await testAppConfigExtensions()
const appAccessExtension = await testAppAccessConfigExtension()

/**
 * Test case for the file-watcher
 * Each test case is an object containing the following elements:
 * - A name for the test case
 * - The file system event to be triggered
 * - The path of the file that triggered the event
 */
interface TestCaseSingleEvent {
  name: string
  fileSystemEvent: string
  path: string
  expectedEvent?: Omit<WatcherEvent, 'startTime'> & {startTime?: WatcherEvent['startTime']}
}

/**
 * Test case for the file-watcher
 * There are cases where multiple events are triggered in a short period of time.
 * This test cases are used to test those scenarios.
 *
 * Each test case is an object containing the following elements:
 * - A name for the test case
 * - The file system events to be triggered
 * - The expected event to be received by the onChange callback
 */
interface TestCaseMultiEvent {
  name: string
  fileSystemEvents: {event: string; path: string}[]
  expectedEvent: Omit<WatcherEvent, 'startTime'> & {startTime?: WatcherEvent['startTime']}
}

const singleEventTestCases: TestCaseSingleEvent[] = [
  {
    name: 'change in file',
    fileSystemEvent: 'change',
    path: '/extensions/ui_extension_1/index.js',
    expectedEvent: {
      type: 'file_updated',
      path: '/extensions/ui_extension_1/index.js',
      extensionPath: '/extensions/ui_extension_1',
    },
  },
  {
    name: 'change in toml',
    fileSystemEvent: 'change',
    path: '/extensions/ui_extension_1/shopify.ui.extension.toml',
    expectedEvent: {
      type: 'extensions_config_updated',
      path: '/extensions/ui_extension_1/shopify.ui.extension.toml',
      extensionPath: '/extensions/ui_extension_1',
    },
  },
  {
    name: 'change in app config',
    fileSystemEvent: 'change',
    path: '/shopify.app.toml',
    expectedEvent: {
      type: 'extensions_config_updated',
      path: '/shopify.app.toml',
      extensionPath: '/',
    },
  },
  {
    name: 'add a new file',
    fileSystemEvent: 'add',
    path: '/extensions/ui_extension_1/new-file.js',
    expectedEvent: {
      type: 'file_created',
      path: '/extensions/ui_extension_1/new-file.js',
      extensionPath: '/extensions/ui_extension_1',
    },
  },
  {
    name: 'delete a file',
    fileSystemEvent: 'unlink',
    path: '/extensions/ui_extension_1/index.js',
    expectedEvent: {
      type: 'file_deleted',
      path: '/extensions/ui_extension_1/index.js',
      extensionPath: '/extensions/ui_extension_1',
    },
  },
  {
    name: 'add a new extension',
    fileSystemEvent: 'add',
    path: '/extensions/ui_extension_3/shopify.extension.toml',
    expectedEvent: {
      type: 'extension_folder_created',
      path: '/extensions/ui_extension_3',
      extensionPath: 'unknown',
    },
  },
  {
    name: 'delete an extension',
    fileSystemEvent: 'unlink',
    path: '/extensions/ui_extension_1/shopify.extension.toml',
    expectedEvent: {
      type: 'extension_folder_deleted',
      path: '/extensions/ui_extension_1',
      extensionPath: '/extensions/ui_extension_1',
    },
  },
  {
    name: 'change in function extension is ignored if not in watch list',
    fileSystemEvent: 'change',
    path: '/extensions/my-function/src/cargo.lock',
    expectedEvent: undefined,
  },
]

const multiEventTestCases: TestCaseMultiEvent[] = [
  {
    name: 'Add a new folder with files',
    fileSystemEvents: [
      // When adding a folder, the events are emitted in order (first the root, then all files)
      {event: 'addDir', path: '/extensions/ui_extension_3'},
      {event: 'add', path: '/extensions/ui_extension_3/shopify.extension.toml'},
      {event: 'add', path: '/extensions/ui_extension_3/index.js'},
      {event: 'add', path: '/extensions/ui_extension_3/new-file.js'},
      {event: 'change', path: '/extensions/ui_extension_3/index.js'},
    ],
    expectedEvent: {
      type: 'extension_folder_created',
      path: '/extensions/ui_extension_3',
      extensionPath: 'unknown',
    },
  },
  {
    name: 'Delete a folder with files',
    fileSystemEvents: [
      // When deleting a folder, the events are emitted in reverse order (first the files, then the root)
      {event: 'unlink', path: '/extensions/ui_extension_1/index.js'},
      {event: 'unlink', path: '/extensions/ui_extension_1/new-file.js'},
      {event: 'unlink', path: '/extensions/ui_extension_1/shopify.extension.toml'},
      {event: 'unlinkDir', path: '/extensions/ui_extension_1/index.js'},
      {event: 'unlinkDir', path: '/extensions/ui_extension_1'},
    ],
    expectedEvent: {
      type: 'extension_folder_deleted',
      path: '/extensions/ui_extension_1',
      extensionPath: '/extensions/ui_extension_1',
    },
  },
]

const outputOptions: OutputContextOptions = {stdout: process.stdout, stderr: process.stderr, signal: new AbortSignal()}
const defaultApp = testAppLinked({
  allExtensions: [extension1, extension1B, extension2, posExtension, appAccessExtension, functionExtension],
  directory: '/',
  configuration: {scopes: '', extension_directories: ['/extensions'], path: '/shopify.app.toml'},
})

describe('file-watcher events', () => {
  test('The file watcher is started with the correct paths and options', async () => {
    // Given
    await inTemporaryDirectory(async (dir) => {
      const ext1 = await testUIExtension({type: 'ui_extension', directory: joinPath(dir, '/extensions/ext1')})
      const ext2 = await testUIExtension({type: 'ui_extension', directory: joinPath(dir, '/extensions/ext2')})
      const posExtension = await testAppConfigExtensions(false, dir)
      const app = testAppLinked({
        allExtensions: [ext1, ext2, posExtension],
        directory: dir,
        configuration: {path: joinPath(dir, '/shopify.app.toml'), scopes: ''},
      })

      // Add a custom gitignore file to the extension
      await mkdir(joinPath(dir, '/extensions/ext1'))
      await writeFile(joinPath(dir, '/extensions/ext1/.gitignore'), '#comment\na_folder\na_file.txt\n**/nested/**')

      const watchSpy = vi.spyOn(chokidar, 'watch').mockImplementation(() => {
        return {
          on: (_: string, listener: any) => listener('change', '/shopify.app.toml'),
          close: () => Promise.resolve(),
        } as any
      })

      // When
      const fileWatcher = new FileWatcher(app, outputOptions)
      fileWatcher.onChange(vi.fn())

      await fileWatcher.start()

      // Then
      expect(watchSpy).toHaveBeenCalledWith([joinPath(dir, '/shopify.app.toml'), joinPath(dir, '/extensions')], {
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/*.test.*',
          '**/dist/**',
          '**/*.swp',
          '**/generated/**',
          '**/.gitignore',
        ],
        ignoreInitial: true,
        persistent: true,
      })
    })
  })

  test.each(singleEventTestCases)(
    'The event $name returns the expected WatcherEvent',
    async ({fileSystemEvent, path, expectedEvent}) => {
      // Given
      vi.spyOn(chokidar, 'watch').mockImplementation((_path) => {
        return {
          on: (_: string, listener: any) => listener(fileSystemEvent, path, undefined),
          close: () => Promise.resolve(),
        } as any
      })

      // When
      const onChange = vi.fn()
      const fileWatcher = new FileWatcher(defaultApp, outputOptions)
      fileWatcher.onChange(onChange)

      await fileWatcher.start()

      // Then
      await flushPromises()

      // use waitFor to so that we can test the debouncers and timeouts
      if (expectedEvent) {
        await vi.waitFor(
          () => {
            expect(onChange).toHaveBeenCalledWith(expect.any(Array))
            const actualEvents = (onChange as any).mock.calls[0][0]
            expect(actualEvents).toHaveLength(1)
            const actualEvent = actualEvents[0]

            expect(actualEvent.type).toBe(expectedEvent.type)
            expect(actualEvent.path).toBe(expectedEvent.path)
            expect(actualEvent.extensionPath).toBe(expectedEvent.extensionPath)
            expect(Array.isArray(actualEvent.startTime)).toBe(true)
            expect(actualEvent.startTime).toHaveLength(2)
            expect(typeof actualEvent.startTime[0]).toBe('number')
            expect(typeof actualEvent.startTime[1]).toBe('number')
          },
          {timeout: 2000, interval: 100},
        )
      } else {
        await sleep(0.01)
        expect(onChange).not.toHaveBeenCalled()
      }
    },
  )

  test.each(multiEventTestCases)(
    'The event $name returns the expected WatcherEvent',
    async ({fileSystemEvents, expectedEvent}) => {
      // Given
      vi.spyOn(chokidar, 'watch').mockImplementation((_path) => {
        return {
          on: (_: string, listener: any) => fileSystemEvents.forEach((ev) => listener(ev.event, ev.path, undefined)),
          close: () => Promise.resolve(),
        } as any
      })

      // When
      const onChange = vi.fn()
      const fileWatcher = new FileWatcher(defaultApp, outputOptions)
      fileWatcher.onChange(onChange)

      await fileWatcher.start()

      // Then
      await flushPromises()

      // use waitFor to so that we can test the debouncers and timeouts
      await vi.waitFor(
        () => {
          // The file watcher may emit multiple batches of events due to import scanning
          // Find the call that contains our expected event
          const allCalls = (onChange as any).mock.calls
          let foundExpectedEvent = false

          for (const call of allCalls) {
            const actualEvents = call[0]
            const matchingEvent = actualEvents.find(
              (event: any) =>
                event.type === expectedEvent.type &&
                event.path === expectedEvent.path &&
                event.extensionPath === expectedEvent.extensionPath,
            )

            if (matchingEvent) {
              foundExpectedEvent = true
              expect(Array.isArray(matchingEvent.startTime)).toBe(true)
              expect(matchingEvent.startTime).toHaveLength(2)
              expect(typeof matchingEvent.startTime[0]).toBe('number')
              expect(typeof matchingEvent.startTime[1]).toBe('number')
              break
            }
          }

          expect(foundExpectedEvent).toBe(true)
        },
        {timeout: 1000, interval: 100},
      )
    },
  )
})
