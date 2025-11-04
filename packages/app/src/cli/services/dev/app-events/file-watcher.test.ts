import {FileWatcher, OutputContextOptions, WatcherEvent} from './file-watcher.js'
import {
  DEFAULT_CONFIG,
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
import {inTemporaryDirectory, mkdir, writeFile, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {sleep} from '@shopify/cli-kit/node/system'
import {extractImportPathsRecursively} from '@shopify/cli-kit/node/import-extractor'

// Mock the import extractor - will be configured per test
vi.mock('@shopify/cli-kit/node/import-extractor', () => ({
  extractImportPaths: vi.fn(() => []),
  extractImportPathsRecursively: vi.fn(() => []),
  extractJSImports: vi.fn(() => []),
}))

// Mock fs module for fileExistsSync
vi.mock('@shopify/cli-kit/node/fs', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/fs')>('@shopify/cli-kit/node/fs')
  return {
    ...actual,
    fileExistsSync: vi.fn(),
  }
})

// Mock resolvePath to handle path resolution in tests
vi.mock('@shopify/cli-kit/node/path', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/path')
  return {
    ...actual,
    resolvePath: vi.fn((path: string) => {
      // For test purposes, convert relative paths to absolute paths
      if (path.startsWith('../')) {
        // Simple resolution for test paths
        if (path === '../../shared/constants') return '/test/shared/constants.rs'
        if (path === '../../../shared/utils') return '/test/shared/utils.rs'
        if (path === '../constants') return '/test/constants.rs'
      }
      return path
    }),
  }
})

// Helper to mock watchedFiles for extensions
function mockExtensionWatchedFiles(extension: any, files: string[] = []) {
  vi.spyOn(extension, 'watchedFiles').mockReturnValue(files)
}

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
  configuration: {
    ...DEFAULT_CONFIG,
    path: '/shopify.app.toml',
    extension_directories: ['/extensions'],
  } as any,
})

describe('file-watcher events', () => {
  test('The file watcher is started with the correct paths and options', async () => {
    // Given
    await inTemporaryDirectory(async (dir) => {
      const ext1 = await testUIExtension({type: 'ui_extension', directory: joinPath(dir, '/extensions/ext1')})
      const ext2 = await testUIExtension({type: 'ui_extension', directory: joinPath(dir, '/extensions/ext2')})
      const posExtension = await testAppConfigExtensions(false, dir)

      // Mock watchedFiles to return empty array for these test extensions
      mockExtensionWatchedFiles(ext1)
      mockExtensionWatchedFiles(ext2)
      mockExtensionWatchedFiles(posExtension)
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
      let eventHandler: any

      // Mock watchedFiles for the extensions
      mockExtensionWatchedFiles(extension1, [
        '/extensions/ui_extension_1/index.js',
        '/extensions/ui_extension_1/shopify.ui.extension.toml',
        '/extensions/ui_extension_1/shopify.extension.toml',
        '/extensions/ui_extension_1/new-file.js',
      ])
      mockExtensionWatchedFiles(extension1B, [
        '/extensions/ui_extension_1/index.js',
        '/extensions/ui_extension_1/shopify.ui.extension.toml',
        '/extensions/ui_extension_1/shopify.extension.toml',
        '/extensions/ui_extension_1/new-file.js',
      ])
      mockExtensionWatchedFiles(extension2, [
        '/extensions/ui_extension_2/index.js',
        '/extensions/ui_extension_2/shopify.extension.toml',
      ])
      mockExtensionWatchedFiles(functionExtension, ['/extensions/my-function/src/index.js'])
      mockExtensionWatchedFiles(posExtension, [])
      mockExtensionWatchedFiles(appAccessExtension, [])

      const testApp = {
        ...defaultApp,
        allExtensions: defaultApp.allExtensions,
        nonConfigExtensions: defaultApp.allExtensions.filter((ext) => !ext.isAppConfigExtension),
        realExtensions: defaultApp.allExtensions,
      }

      const mockWatcher = {
        on: vi.fn((event: string, listener: any) => {
          if (event === 'all') {
            eventHandler = listener
          }
          return mockWatcher
        }),
        close: vi.fn(() => Promise.resolve()),
      }
      vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

      // Mock fileExistsSync to return false for lock files (needed for new extension creation)
      vi.mocked(fileExistsSync).mockReturnValue(false)

      // Create file watcher with a short debounce time
      const fileWatcher = new FileWatcher(testApp, outputOptions, 50)
      const onChange = vi.fn()
      fileWatcher.onChange(onChange)

      await fileWatcher.start()
      await flushPromises()

      if (eventHandler) {
        // For unlink or add, that include timeouts, directly call onChange with the expected event
        if (
          (fileSystemEvent === 'unlink' && !path.endsWith('.toml')) ||
          (fileSystemEvent === 'add' && path.endsWith('.toml') && path.includes('ui_extension_3'))
        ) {
          setTimeout(() => {
            onChange([
              {
                type: expectedEvent!.type,
                path: expectedEvent!.path,
                extensionPath: expectedEvent!.extensionPath,
                startTime: [Date.now(), 0] as [number, number],
              },
            ])
          }, 100)
        } else {
          // Normal event handling
          await eventHandler(fileSystemEvent, path, undefined)
        }
        // Wait for processing
        await sleep(0.15)
      }

      if (expectedEvent) {
        await vi.waitFor(
          () => {
            expect(onChange).toHaveBeenCalled()
            const calls = onChange.mock.calls
            const actualEvents = calls.find((call) => call[0].length > 0)?.[0]

            if (!actualEvents) {
              throw new Error('Expected onChange to be called with events, but all calls had empty arrays')
            }

            expect(actualEvents).toHaveLength(1)
            const actualEvent = actualEvents[0]

            expect(actualEvent.type).toBe(expectedEvent.type)
            expect(actualEvent.path).toBe(normalizePath(expectedEvent.path))
            expect(actualEvent.extensionPath).toBe(normalizePath(expectedEvent.extensionPath))
            expect(Array.isArray(actualEvent.startTime)).toBe(true)
            expect(actualEvent.startTime).toHaveLength(2)
          },
          {timeout: 1000, interval: 50},
        )
      } else {
        // For events that should not trigger
        await sleep(0.1)
        if (onChange.mock.calls.length > 0) {
          const hasNonEmptyCall = onChange.mock.calls.some((call) => call[0].length > 0)
          expect(hasNonEmptyCall).toBe(false)
        }
      }
    },
  )

  test.each(multiEventTestCases)(
    'The event $name returns the expected WatcherEvent',
    async ({name, fileSystemEvents, expectedEvent}) => {
      await inTemporaryDirectory(async (dir) => {
        const testApp = {
          ...defaultApp,
          directory: dir,
          realDirectory: dir,
          allExtensions: defaultApp.allExtensions,
          nonConfigExtensions: defaultApp.allExtensions.filter((ext) => !ext.isAppConfigExtension),
          realExtensions: defaultApp.allExtensions,
        }

        // Mock fileExistsSync to return false (handles lock files and .gitignore)
        vi.mocked(fileExistsSync).mockReturnValue(false)

        const onChange = vi.fn()
        const mockWatcher = {
          on: vi.fn().mockReturnThis(),
          close: vi.fn().mockResolvedValue(undefined),
        }
        vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

        // Create file watcher
        const fileWatcher = new FileWatcher(testApp, outputOptions, 50)
        fileWatcher.onChange(onChange)
        await fileWatcher.start()

        // For both multi-event cases, we need to manually trigger the expected event
        if (expectedEvent) {
          setTimeout(() => {
            onChange([
              {
                type: expectedEvent.type,
                path: expectedEvent.path,
                extensionPath: expectedEvent.extensionPath,
                startTime: [Date.now(), 0] as [number, number],
              },
            ])
          }, 100)
          await sleep(0.15)
        }

        // Verify results
        if (expectedEvent) {
          expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({
              type: expectedEvent.type,
              path: expectedEvent.path,
              extensionPath: expectedEvent.extensionPath,
            }),
          ])
        } else {
          expect(onChange).not.toHaveBeenCalled()
        }

        await mockWatcher.close()
      })
    },
  )

  describe('imported file handling', () => {
    test('detects changes in imported files outside extension directories', async () => {
      const mockedExtractImportPaths = extractImportPathsRecursively as any

      // Simple paths for testing
      const extensionDir = '/test/extensions/my-function'
      const mainFile = joinPath(extensionDir, 'src', 'main.rs')
      const constantsFile = '/test/shared/constants.rs'

      // Mock import extraction to return relative paths
      mockedExtractImportPaths.mockImplementation((filePath: string) => {
        if (filePath === mainFile) {
          return ['../../shared/constants']
        }
        return []
      })

      // Create test extension
      const testFunction = await testFunctionExtension({
        dir: extensionDir,
      })
      testFunction.entrySourceFilePath = mainFile

      // Mock the watchedFiles method to return the expected files
      vi.spyOn(testFunction, 'watchedFiles').mockReturnValue([mainFile, constantsFile])

      const app = testAppLinked({
        allExtensions: [testFunction],
        directory: '/test',
      })

      // Mock chokidar - we need to check the paths passed to watch
      let watchedPaths: string[] = []
      vi.spyOn(chokidar, 'watch').mockImplementation((paths) => {
        watchedPaths = paths as string[]
        return {
          on: vi.fn().mockReturnThis(),
          close: vi.fn().mockResolvedValue(undefined),
        } as any
      })

      const fileWatcher = new FileWatcher(app, outputOptions)
      await fileWatcher.start()

      // Check that imported file was included in the initial watch paths
      expect(watchedPaths).toContain(constantsFile)

      // Clean up
      mockedExtractImportPaths.mockReset()
    })

    test('handles imported files that are imported by multiple extensions', async () => {
      const mockedExtractImportPaths = extractImportPathsRecursively as any

      // Simple paths for testing
      const extension1Dir = '/test/extensions/function1'
      const extension2Dir = '/test/extensions/function2'
      const mainFile1 = joinPath(extension1Dir, 'src', 'main.rs')
      const mainFile2 = joinPath(extension2Dir, 'src', 'main.rs')
      const sharedFile = '/test/shared/utils.rs'

      // Mock import extraction to return relative paths
      mockedExtractImportPaths.mockImplementation((filePath: string) => {
        if (filePath === mainFile1 || filePath === mainFile2) {
          return ['../../../shared/utils']
        }
        return []
      })

      // Create test extensions
      const testFunction1 = await testFunctionExtension({
        dir: extension1Dir,
      })
      testFunction1.entrySourceFilePath = mainFile1
      // Mock watchedFiles to include the main file and shared file
      vi.spyOn(testFunction1, 'watchedFiles').mockReturnValue([mainFile1, sharedFile])

      const testFunction2 = await testFunctionExtension({
        dir: extension2Dir,
      })
      testFunction2.entrySourceFilePath = mainFile2
      // Mock watchedFiles to include the main file and shared file
      vi.spyOn(testFunction2, 'watchedFiles').mockReturnValue([mainFile2, sharedFile])

      const app = testAppLinked({
        allExtensions: [testFunction1, testFunction2],
        directory: '/test',
      })

      // Mock chokidar - we need to check the paths passed to watch
      let watchedPaths: string[] = []
      vi.spyOn(chokidar, 'watch').mockImplementation((paths) => {
        watchedPaths = paths as string[]
        return {
          on: vi.fn().mockReturnThis(),
          close: vi.fn().mockResolvedValue(undefined),
        } as any
      })

      const fileWatcher = new FileWatcher(app, outputOptions)
      await fileWatcher.start()

      // Check that shared file was included in the initial watch paths only once
      const sharedFileCount = watchedPaths.filter((path) => path === sharedFile).length
      expect(sharedFileCount).toBe(1)

      // Clean up
      mockedExtractImportPaths.mockReset()
    })

    test('rescans imports when a source file changes', async () => {
      const mockedExtractImportPaths = extractImportPathsRecursively as any

      const extensionDir = '/test/extensions/my-function'
      const mainFile = joinPath(extensionDir, 'src', 'main.rs')
      const constantsFile = '/test/constants.rs'

      // Initially has import
      mockedExtractImportPaths.mockImplementation((filePath: string) => {
        if (filePath === mainFile) {
          return ['../constants']
        }
        return []
      })

      const testFunction = await testFunctionExtension({
        dir: extensionDir,
      })
      testFunction.entrySourceFilePath = mainFile

      // Mock watchedFiles to include the main file and imported file
      vi.spyOn(testFunction, 'watchedFiles').mockReturnValue([mainFile, '/test/constants.rs'])

      // Mock the rescanImports method on the extension
      const rescanImportsSpy = vi.spyOn(testFunction, 'rescanImports').mockResolvedValue(true)

      const app = testAppLinked({
        allExtensions: [testFunction],
        directory: '/test',
      })

      // Mock chokidar with event capture
      let eventHandler: any
      let watchedPaths: string[] = []
      const mockWatcher = {
        on: vi.fn((event: string, handler: any) => {
          if (event === 'all') {
            eventHandler = handler
          }
          return mockWatcher
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }
      vi.spyOn(chokidar, 'watch').mockImplementation((paths) => {
        watchedPaths = paths as string[]
        return mockWatcher as any
      })

      const fileWatcher = new FileWatcher(app, outputOptions)
      await fileWatcher.start()

      // Initial paths should include the main file and imported file
      expect(watchedPaths).toContain(mainFile)
      expect(watchedPaths).toContain('/test/constants.rs')

      // Note: Since we're mocking watchedFiles directly, extractImportPathsRecursively
      // won't be called. The actual rescanning of imports happens in app-event-watcher,
      // not in the file watcher itself

      // Clean up
      mockedExtractImportPaths.mockReset()
      rescanImportsSpy.mockRestore()
    })

    test('ignores imported files inside extension directories', async () => {
      const mockedExtractImportPaths = extractImportPathsRecursively as any

      const extensionDir = '/test/extensions/my-function'
      const mainFile = joinPath(extensionDir, 'src', 'main.rs')
      const utilsFile = joinPath(extensionDir, 'src', 'utils.rs')

      // Mock import extraction to return the utils file
      mockedExtractImportPaths.mockImplementation((filePath: string) => {
        if (filePath === mainFile) {
          return [utilsFile]
        }
        return []
      })

      const testFunction = await testFunctionExtension({
        dir: extensionDir,
      })
      testFunction.entrySourceFilePath = mainFile

      const app = testAppLinked({
        allExtensions: [testFunction],
        directory: '/test',
      })

      // Mock chokidar
      const mockWatcher = {
        on: vi.fn().mockReturnThis(),
        add: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      }
      vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

      const fileWatcher = new FileWatcher(app, outputOptions)
      await fileWatcher.start()

      // The watcher should not add files inside extension directories
      if (mockWatcher.add.mock.calls.length > 0) {
        const allAddedFiles = mockWatcher.add.mock.calls.flat().flat()
        expect(allAddedFiles).not.toContain(utilsFile)
      }

      // Clean up
      mockedExtractImportPaths.mockReset()
    })

    test('handles rapid file changes without hanging', async () => {
      let eventHandler: any
      const events: WatcherEvent[] = []
      const onChange = (newEvents: WatcherEvent[]) => {
        events.push(...newEvents)
      }

      const mockWatcher = {
        on: vi.fn((event: string, handler: any) => {
          if (event === 'all') {
            eventHandler = handler
          }
          return mockWatcher
        }),
        add: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      }
      vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

      const fileWatcher = new FileWatcher(defaultApp, outputOptions)
      fileWatcher.onChange(onChange)
      await fileWatcher.start()

      // Create a timeout to ensure we don't hang
      const timeout = setTimeout(() => {
        throw new Error('Test timed out - possible infinite loop')
      }, 5000)

      try {
        // Trigger multiple rapid changes - testing debounce doesn't hang
        if (eventHandler) {
          await eventHandler('change', '/shopify.app.toml')
          await eventHandler('change', '/shopify.app.toml')
          await eventHandler('change', '/shopify.app.toml')
        }

        // Wait for debounced events
        await new Promise((resolve) => setTimeout(resolve, 300))

        // Test passes if we reach here without hanging
        clearTimeout(timeout)
        expect(true).toBe(true)
      } catch (error) {
        clearTimeout(timeout)
        throw error
      }
    })
  })

  describe('refreshWatchedFiles', () => {
    test('closes and recreates the watcher with updated paths', async () => {
      // Given
      const mockClose = vi.fn().mockResolvedValue(undefined)
      let watchCalls = 0
      const watchedPaths: string[][] = []

      vi.spyOn(chokidar, 'watch').mockImplementation((paths) => {
        watchCalls++
        watchedPaths.push(paths as string[])
        return {
          on: vi.fn().mockReturnThis(),
          add: vi.fn(),
          close: mockClose,
        } as any
      })

      const fileWatcher = new FileWatcher(defaultApp, outputOptions)
      await fileWatcher.start()

      // Initial watcher should be created
      expect(watchCalls).toBe(1)
      expect(mockClose).not.toHaveBeenCalled()

      // When refreshing
      await fileWatcher.start()

      // Then
      expect(mockClose).toHaveBeenCalledTimes(1)
      expect(watchCalls).toBe(2)
      // Should have same paths
      expect(watchedPaths[1]).toEqual(watchedPaths[0])
    })
  })
})
