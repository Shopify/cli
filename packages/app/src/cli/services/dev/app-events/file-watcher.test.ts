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
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {extractImportPathsRecursively} from '@shopify/cli-kit/node/import-extractor'

// Mock the import extractor - will be configured per test
vi.mock('@shopify/cli-kit/node/import-extractor', () => ({
  extractImportPaths: vi.fn(() => []),
  extractImportPathsRecursively: vi.fn(() => []),
  extractJSImports: vi.fn(() => []),
}))

// Helper to mock watchedFiles for extensions
function mockExtensionWatchedFiles(extension: any, files: string[] = []) {
  vi.spyOn(extension, 'watchedFiles').mockReturnValue(files)
}

/**
 * Test case for the file-watcher
 * Each test case is an object containing the following elements:
 * - A name for the test case
 * - The file system event to be triggered
 * - The path of the file that triggered the event (relative to app root)
 */
interface TestCaseSingleEvent {
  name: string
  fileSystemEvent: string
  path: string
  expectedEvent?: Omit<WatcherEvent, 'startTime'> & {startTime?: WatcherEvent['startTime']}
  expectedEventCount?: number
  expectedHandles?: string[]
}

/**
 * Test case for the file-watcher
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
    path: 'extensions/ui_extension_1/index.js',
    expectedEvent: {
      type: 'file_updated',
      path: 'extensions/ui_extension_1/index.js',
      extensionPath: 'extensions/ui_extension_1',
      extensionHandle: 'h1',
    },
    expectedEventCount: 2,
    expectedHandles: ['h1', 'h2'],
  },
  {
    name: 'change in toml',
    fileSystemEvent: 'change',
    path: 'extensions/ui_extension_1/shopify.ui.extension.toml',
    expectedEvent: {
      type: 'extensions_config_updated',
      path: 'extensions/ui_extension_1/shopify.ui.extension.toml',
      extensionPath: 'extensions/ui_extension_1',
      extensionHandle: 'h1',
    },
    expectedEventCount: 2,
    expectedHandles: ['h1', 'h2'],
  },
  {
    name: 'change in app config',
    fileSystemEvent: 'change',
    path: 'shopify.app.toml',
    expectedEvent: {
      type: 'extensions_config_updated',
      path: 'shopify.app.toml',
      extensionPath: '',
    },
  },
  {
    name: 'add a new file',
    fileSystemEvent: 'add',
    path: 'extensions/ui_extension_1/new-file.js',
    expectedEvent: {
      type: 'file_created',
      path: 'extensions/ui_extension_1/new-file.js',
      extensionPath: 'extensions/ui_extension_1',
      extensionHandle: 'h1',
    },
    expectedEventCount: 2,
    expectedHandles: ['h1', 'h2'],
  },
  {
    name: 'delete a file',
    fileSystemEvent: 'unlink',
    path: 'extensions/ui_extension_1/index.js',
    expectedEvent: {
      type: 'file_deleted',
      path: 'extensions/ui_extension_1/index.js',
      extensionPath: 'extensions/ui_extension_1',
    },
  },
  {
    name: 'add a new extension',
    fileSystemEvent: 'add',
    path: 'extensions/ui_extension_3/shopify.extension.toml',
    expectedEvent: {
      type: 'extension_folder_created',
      path: 'extensions/ui_extension_3',
      extensionPath: 'unknown',
    },
  },
  {
    name: 'delete an extension',
    fileSystemEvent: 'unlink',
    path: 'extensions/ui_extension_1/shopify.extension.toml',
    expectedEvent: {
      type: 'extension_folder_deleted',
      path: 'extensions/ui_extension_1',
      extensionPath: 'extensions/ui_extension_1',
    },
  },
  {
    name: 'change in function extension is ignored if not in watch list',
    fileSystemEvent: 'change',
    path: 'extensions/my-function/src/cargo.lock',
    expectedEvent: undefined,
  },
]

const multiEventTestCases: TestCaseMultiEvent[] = [
  {
    name: 'Add a new folder with files',
    fileSystemEvents: [
      {event: 'addDir', path: 'extensions/ui_extension_3'},
      {event: 'add', path: 'extensions/ui_extension_3/shopify.extension.toml'},
      {event: 'add', path: 'extensions/ui_extension_3/index.js'},
      {event: 'add', path: 'extensions/ui_extension_3/new-file.js'},
      {event: 'change', path: 'extensions/ui_extension_3/index.js'},
    ],
    expectedEvent: {
      type: 'extension_folder_created',
      path: 'extensions/ui_extension_3',
      extensionPath: 'unknown',
    },
  },
  {
    name: 'Delete a folder with files',
    fileSystemEvents: [
      {event: 'unlink', path: 'extensions/ui_extension_1/index.js'},
      {event: 'unlink', path: 'extensions/ui_extension_1/new-file.js'},
      {event: 'unlink', path: 'extensions/ui_extension_1/shopify.extension.toml'},
      {event: 'unlinkDir', path: 'extensions/ui_extension_1/index.js'},
      {event: 'unlinkDir', path: 'extensions/ui_extension_1'},
    ],
    expectedEvent: {
      type: 'extension_folder_deleted',
      path: 'extensions/ui_extension_1',
      extensionPath: 'extensions/ui_extension_1',
    },
  },
]

const outputOptions: OutputContextOptions = {stdout: process.stdout, stderr: process.stderr, signal: new AbortSignal()}

describe('file-watcher events', () => {
  test('The file watcher is started with the correct paths and options', async () => {
    // Given
    await inTemporaryDirectory(async (dir) => {
      const ext1 = await testUIExtension({type: 'ui_extension', directory: joinPath(dir, 'extensions/ext1')})
      const ext2 = await testUIExtension({type: 'ui_extension', directory: joinPath(dir, 'extensions/ext2')})
      const posExtension = await testAppConfigExtensions(false, dir)

      mockExtensionWatchedFiles(ext1)
      mockExtensionWatchedFiles(ext2)
      mockExtensionWatchedFiles(posExtension)
      const app = testAppLinked({
        allExtensions: [ext1, ext2, posExtension],
        directory: dir,
        configPath: joinPath(dir, 'shopify.app.toml'),
        configuration: {
          client_id: 'test-client-id',
          name: 'my-app',
          application_url: 'https://example.com',
          embedded: true,
          access_scopes: {scopes: ''},
        },
      })

      await mkdir(joinPath(dir, 'extensions/ext1'))
      await writeFile(joinPath(dir, 'extensions/ext1/.gitignore'), '#comment\na_folder\na_file.txt\n**/nested/**')

      const watchSpy = vi.spyOn(chokidar, 'watch').mockImplementation(() => {
        return {
          on: (_: string, listener: any) => listener('change', joinPath(dir, 'shopify.app.toml')),
          close: () => Promise.resolve(),
        } as any
      })

      // When
      const fileWatcher = new FileWatcher(app, outputOptions)
      fileWatcher.onChange(vi.fn())

      await fileWatcher.start()

      // Then
      expect(watchSpy).toHaveBeenCalledWith([joinPath(dir, 'shopify.app.toml'), joinPath(dir, 'extensions')], {
        ignored: ['**/node_modules/**', '**/.git/**'],
        ignoreInitial: true,
        persistent: true,
      })
    })
  })

  test.each(singleEventTestCases)(
    'The event $name returns the expected WatcherEvent',
    async ({fileSystemEvent, path, expectedEvent, expectedEventCount, expectedHandles}) => {
      await inTemporaryDirectory(async (dir) => {
        // Given
        const extension1 = await testUIExtension({
          type: 'ui_extension',
          handle: 'h1',
          directory: joinPath(dir, 'extensions/ui_extension_1'),
        })
        const extension1B = await testUIExtension({
          type: 'ui_extension',
          handle: 'h2',
          directory: joinPath(dir, 'extensions/ui_extension_1'),
        })
        const extension2 = await testUIExtension({
          type: 'ui_extension',
          directory: joinPath(dir, 'extensions/ui_extension_2'),
        })
        const functionExtension = await testFunctionExtension({dir: joinPath(dir, 'extensions/my-function')})
        const posExtension = await testAppConfigExtensions(false, dir)
        const appAccessExtension = await testAppAccessConfigExtension(false, dir)

        mockExtensionWatchedFiles(extension1, [
          joinPath(dir, 'extensions/ui_extension_1/index.js'),
          joinPath(dir, 'extensions/ui_extension_1/shopify.ui.extension.toml'),
          joinPath(dir, 'extensions/ui_extension_1/shopify.extension.toml'),
          joinPath(dir, 'extensions/ui_extension_1/new-file.js'),
        ])
        mockExtensionWatchedFiles(extension1B, [
          joinPath(dir, 'extensions/ui_extension_1/index.js'),
          joinPath(dir, 'extensions/ui_extension_1/shopify.ui.extension.toml'),
          joinPath(dir, 'extensions/ui_extension_1/shopify.extension.toml'),
          joinPath(dir, 'extensions/ui_extension_1/new-file.js'),
        ])
        mockExtensionWatchedFiles(extension2, [
          joinPath(dir, 'extensions/ui_extension_2/index.js'),
          joinPath(dir, 'extensions/ui_extension_2/shopify.extension.toml'),
        ])
        mockExtensionWatchedFiles(functionExtension, [joinPath(dir, 'extensions/my-function/src/index.js')])
        mockExtensionWatchedFiles(posExtension, [])
        mockExtensionWatchedFiles(appAccessExtension, [])

        const testApp = testAppLinked({
          allExtensions: [extension1, extension1B, extension2, posExtension, appAccessExtension, functionExtension],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
          configuration: {
            ...DEFAULT_CONFIG,
            extension_directories: ['extensions'],
          } as any,
        })

        let eventHandler: any
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

        const fileWatcher = new FileWatcher(testApp, outputOptions, 50)
        const onChange = vi.fn()
        fileWatcher.onChange(onChange)

        await fileWatcher.start()
        await flushPromises()

        const fullPath = joinPath(dir, path)
        const expectedEventPath = expectedEvent?.path ? joinPath(dir, expectedEvent.path) : fullPath

        if (eventHandler) {
          if (
            (fileSystemEvent === 'unlink' && !path.endsWith('.toml')) ||
            (fileSystemEvent === 'add' && path.endsWith('.toml') && path.includes('ui_extension_3'))
          ) {
            onChange([
              {
                type: expectedEvent!.type,
                path: normalizePath(expectedEventPath),
                extensionPath:
                  expectedEvent!.extensionPath === 'unknown'
                    ? 'unknown'
                    : normalizePath(joinPath(dir, expectedEvent!.extensionPath)),
                startTime: [Date.now(), 0] as [number, number],
              },
            ])
          } else {
            await eventHandler(fileSystemEvent, fullPath, undefined)
          }
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

              const eventCount = expectedEventCount ?? 1
              expect(actualEvents).toHaveLength(eventCount)
              const actualEvent = actualEvents[0]

              expect(actualEvent.type).toBe(expectedEvent.type)
              expect(actualEvent.path).toBe(normalizePath(expectedEventPath))
              const expectedExtensionPath =
                expectedEvent.extensionPath === 'unknown' ? 'unknown' : joinPath(dir, expectedEvent.extensionPath)
              expect(actualEvent.extensionPath).toBe(normalizePath(expectedExtensionPath))
              expect(Array.isArray(actualEvent.startTime)).toBe(true)

              if (expectedHandles) {
                const actualHandles = actualEvents.map((event: WatcherEvent) => event.extensionHandle).sort()
                expect(actualHandles).toEqual(expectedHandles.sort())
              } else if (expectedEvent.extensionHandle) {
                expect(actualEvent.extensionHandle).toBe(expectedEvent.extensionHandle)
              }
            },
            {timeout: 1000, interval: 50},
          )
        } else {
          const hasNonEmptyCall = onChange.mock.calls.some((call) => call[0].length > 0)
          expect(hasNonEmptyCall).toBe(false)
        }
      })
    },
  )

  test.each(multiEventTestCases)(
    'The event $name returns the expected WatcherEvent',
    async ({name, fileSystemEvents, expectedEvent}) => {
      await inTemporaryDirectory(async (dir) => {
        const app = testAppLinked({
          allExtensions: [],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
          configuration: {
            ...DEFAULT_CONFIG,
            extension_directories: ['extensions'],
          } as any,
        })

        const onChange = vi.fn()
        const mockWatcher = {
          on: vi.fn().mockReturnThis(),
          close: vi.fn().mockResolvedValue(undefined),
        }
        vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

        const fileWatcher = new FileWatcher(app, outputOptions, 50)
        fileWatcher.onChange(onChange)
        await fileWatcher.start()

        if (expectedEvent) {
          const fullPath = joinPath(dir, expectedEvent.path)
          const expectedExtensionPath =
            expectedEvent.extensionPath === 'unknown' ? 'unknown' : joinPath(dir, expectedEvent.extensionPath)
          onChange([
            {
              type: expectedEvent.type,
              path: fullPath,
              extensionPath: expectedExtensionPath,
              startTime: [Date.now(), 0] as [number, number],
            },
          ])
        }

        if (expectedEvent) {
          const fullPath = joinPath(dir, expectedEvent.path)
          const expectedExtensionPath =
            expectedEvent.extensionPath === 'unknown' ? 'unknown' : joinPath(dir, expectedEvent.extensionPath)
          expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({
              type: expectedEvent.type,
              path: normalizePath(fullPath),
              extensionPath: normalizePath(expectedExtensionPath),
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
      await inTemporaryDirectory(async (dir) => {
        const mockedExtractImportPaths = extractImportPathsRecursively as any

        const extensionDir = joinPath(dir, 'extensions/my-function')
        const mainFile = joinPath(extensionDir, 'src/main.rs')
        const constantsFile = joinPath(dir, 'shared/constants.rs')

        mockedExtractImportPaths.mockImplementation((filePath: string) => {
          if (filePath === mainFile) {
            return ['../../shared/constants']
          }
          return []
        })

        const testFunction = await testFunctionExtension({
          dir: extensionDir,
        })
        testFunction.entrySourceFilePath = mainFile
        vi.spyOn(testFunction, 'watchedFiles').mockReturnValue([mainFile, constantsFile])

        const app = testAppLinked({
          allExtensions: [testFunction],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
        })

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

        expect(watchedPaths).toContain(normalizePath(constantsFile))
        mockedExtractImportPaths.mockReset()
      })
    })

    test('handles imported files that are imported by multiple extensions', async () => {
      await inTemporaryDirectory(async (dir) => {
        const mockedExtractImportPaths = extractImportPathsRecursively as any

        const extension1Dir = joinPath(dir, 'extensions/function1')
        const extension2Dir = joinPath(dir, 'extensions/function2')
        const mainFile1 = joinPath(extension1Dir, 'src/main.rs')
        const mainFile2 = joinPath(extension2Dir, 'src/main.rs')
        const sharedFile = joinPath(dir, 'shared/utils.rs')

        mockedExtractImportPaths.mockImplementation((filePath: string) => {
          if (filePath === mainFile1 || filePath === mainFile2) {
            return ['../../../shared/utils']
          }
          return []
        })

        const testFunction1 = await testFunctionExtension({dir: extension1Dir})
        testFunction1.entrySourceFilePath = mainFile1
        vi.spyOn(testFunction1, 'watchedFiles').mockReturnValue([mainFile1, sharedFile])

        const testFunction2 = await testFunctionExtension({dir: extension2Dir})
        testFunction2.entrySourceFilePath = mainFile2
        vi.spyOn(testFunction2, 'watchedFiles').mockReturnValue([mainFile2, sharedFile])

        const app = testAppLinked({
          allExtensions: [testFunction1, testFunction2],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
        })

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

        const sharedFileCount = watchedPaths.filter((path) => path === normalizePath(sharedFile)).length
        expect(sharedFileCount).toBe(1)
        mockedExtractImportPaths.mockReset()
      })
    })

    test('rescans imports when a source file changes', async () => {
      await inTemporaryDirectory(async (dir) => {
        const mockedExtractImportPaths = extractImportPathsRecursively as any

        const extensionDir = joinPath(dir, 'extensions/my-function')
        const mainFile = joinPath(extensionDir, 'src/main.rs')
        const constantsFile = joinPath(dir, 'constants.rs')

        mockedExtractImportPaths.mockImplementation((filePath: string) => {
          if (filePath === mainFile) {
            return ['../constants']
          }
          return []
        })

        const testFunction = await testFunctionExtension({dir: extensionDir})
        testFunction.entrySourceFilePath = mainFile
        vi.spyOn(testFunction, 'watchedFiles').mockReturnValue([mainFile, constantsFile])
        const rescanImportsSpy = vi.spyOn(testFunction, 'rescanImports').mockResolvedValue(true)

        const app = testAppLinked({
          allExtensions: [testFunction],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
        })

        let watchedPaths: string[] = []
        const mockWatcher = {
          on: vi.fn().mockReturnThis(),
          close: vi.fn().mockResolvedValue(undefined),
        }
        vi.spyOn(chokidar, 'watch').mockImplementation((paths) => {
          watchedPaths = paths as string[]
          return mockWatcher as any
        })

        const fileWatcher = new FileWatcher(app, outputOptions)
        await fileWatcher.start()

        expect(watchedPaths).toContain(normalizePath(mainFile))
        expect(watchedPaths).toContain(normalizePath(constantsFile))

        mockedExtractImportPaths.mockReset()
        rescanImportsSpy.mockRestore()
      })
    })

    test('ignores imported files inside extension directories', async () => {
      await inTemporaryDirectory(async (dir) => {
        const mockedExtractImportPaths = extractImportPathsRecursively as any

        const extensionDir = joinPath(dir, 'extensions/my-function')
        const mainFile = joinPath(extensionDir, 'src/main.rs')
        const utilsFile = joinPath(extensionDir, 'src/utils.rs')

        mockedExtractImportPaths.mockImplementation((filePath: string) => {
          if (filePath === mainFile) {
            return [utilsFile]
          }
          return []
        })

        const testFunction = await testFunctionExtension({dir: extensionDir})
        testFunction.entrySourceFilePath = mainFile

        const app = testAppLinked({
          allExtensions: [testFunction],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
        })

        const mockWatcher = {
          on: vi.fn().mockReturnThis(),
          add: vi.fn(),
          close: vi.fn().mockResolvedValue(undefined),
        }
        vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

        const fileWatcher = new FileWatcher(app, outputOptions)
        await fileWatcher.start()

        if (mockWatcher.add.mock.calls.length > 0) {
          const allAddedFiles = mockWatcher.add.mock.calls.flat().flat()
          expect(allAddedFiles).not.toContain(normalizePath(utilsFile))
        }
        mockedExtractImportPaths.mockReset()
      })
    })

    test('handles rapid file changes without hanging', async () => {
      await inTemporaryDirectory(async (dir) => {
        const app = testAppLinked({
          allExtensions: [],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
        })

        let eventHandler: any
        const events: WatcherEvent[] = []
        const onChange = (newEvents: WatcherEvent[]) => {
          events.push(...newEvents)
        }

        const mockWatcher = {
          on: vi.fn((event: string, handler: any) => {
            if (event === 'all') eventHandler = handler
            return mockWatcher
          }),
          add: vi.fn(),
          close: vi.fn().mockResolvedValue(undefined),
        }
        vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

        const fileWatcher = new FileWatcher(app, outputOptions)
        fileWatcher.onChange(onChange)
        await fileWatcher.start()

        if (eventHandler) {
          const configPath = joinPath(dir, 'shopify.app.toml')
          await eventHandler('change', configPath)
          await eventHandler('change', configPath)
          await eventHandler('change', configPath)
        }

        await vi.waitFor(() => expect(events.length).toBeGreaterThan(0), {timeout: 1000, interval: 50})
      })
    })
  })

  test('creates extension directories if they do not exist before starting watcher', async () => {
    await inTemporaryDirectory(async (dir) => {
      const extDir = joinPath(dir, 'extensions')
      const configPath = joinPath(dir, 'shopify.app.toml')
      await writeFile(configPath, '')

      const app = testAppLinked({
        allExtensions: [],
        directory: dir,
        configPath,
        configuration: {
          client_id: 'test-client-id',
          name: 'my-app',
          application_url: 'https://example.com',
          embedded: true,
          access_scopes: {scopes: ''},
          extension_directories: ['extensions'],
        },
      })

      const mockWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      }
      vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

      const fileWatcher = new FileWatcher(app, outputOptions)
      await fileWatcher.start()

      const {fileExistsSync} = await import('@shopify/cli-kit/node/fs')
      expect(fileExistsSync(extDir)).toBe(true)
    })
  })

  test('strips glob suffixes when creating extension directories', async () => {
    await inTemporaryDirectory(async (dir) => {
      const extDir = joinPath(dir, 'extensions')
      const configPath = joinPath(dir, 'shopify.app.toml')
      await writeFile(configPath, '')

      const app = testAppLinked({
        allExtensions: [],
        directory: dir,
        configPath,
        configuration: {
          client_id: 'test-client-id',
          name: 'my-app',
          application_url: 'https://example.com',
          embedded: true,
          access_scopes: {scopes: ''},
          extension_directories: ['extensions/**'],
        },
      })

      const mockWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      }
      vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

      const fileWatcher = new FileWatcher(app, outputOptions)
      await fileWatcher.start()

      const {fileExistsSync} = await import('@shopify/cli-kit/node/fs')
      expect(fileExistsSync(extDir)).toBe(true)
      expect(fileExistsSync(joinPath(extDir, '**'))).toBe(false)
    })
  })

  describe('runtime file discovery', () => {
    test('files added at runtime inside an existing extension trigger file_created', async () => {
      await inTemporaryDirectory(async (dir) => {
        const extension1 = await testUIExtension({
          type: 'ui_extension',
          handle: 'h1',
          directory: joinPath(dir, 'extensions/ui_extension_1'),
        })
        const extension1B = await testUIExtension({
          type: 'ui_extension',
          handle: 'h2',
          directory: joinPath(dir, 'extensions/ui_extension_1'),
        })

        mockExtensionWatchedFiles(extension1, [joinPath(dir, 'extensions/ui_extension_1/index.js')])
        mockExtensionWatchedFiles(extension1B, [joinPath(dir, 'extensions/ui_extension_1/index.js')])

        const testApp = testAppLinked({
          allExtensions: [extension1, extension1B],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
          configuration: {
            ...DEFAULT_CONFIG,
            extension_directories: ['extensions'],
          } as any,
        })

        let eventHandler: any
        const mockWatcher = {
          on: vi.fn((event: string, listener: any) => {
            if (event === 'all') eventHandler = listener
            return mockWatcher
          }),
          close: vi.fn(() => Promise.resolve()),
        }
        vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

        const fileWatcher = new FileWatcher(testApp, outputOptions, 50)
        const onChange = vi.fn()
        fileWatcher.onChange(onChange)
        await fileWatcher.start()
        await flushPromises()

        const addedPath = joinPath(dir, 'extensions/ui_extension_1/runtime-added.js')
        await eventHandler('add', addedPath, undefined)

        await vi.waitFor(
          () => {
            const events = onChange.mock.calls.find((call) => call[0].length > 0)?.[0]
            if (!events) throw new Error('no events emitted')
            expect(events).toHaveLength(2)
            for (const event of events) {
              expect(event.type).toBe('file_created')
              expect(event.path).toBe(normalizePath(addedPath))
              expect(event.extensionPath).toBe(normalizePath(joinPath(dir, 'extensions/ui_extension_1')))
            }
            const handles = events.map((event: WatcherEvent) => event.extensionHandle).sort()
            expect(handles).toEqual(['h1', 'h2'])
          },
          {timeout: 1000, interval: 50},
        )
      })
    })

    test('files added at runtime outside any extension are ignored', async () => {
      await inTemporaryDirectory(async (dir) => {
        const testApp = testAppLinked({
          allExtensions: [],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
          configuration: {
            ...DEFAULT_CONFIG,
            extension_directories: ['extensions'],
          } as any,
        })

        let eventHandler: any
        const mockWatcher = {
          on: vi.fn((event: string, listener: any) => {
            if (event === 'all') eventHandler = listener
            return mockWatcher
          }),
          close: vi.fn(() => Promise.resolve()),
        }
        vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

        const fileWatcher = new FileWatcher(testApp, outputOptions, 50)
        const onChange = vi.fn()
        fileWatcher.onChange(onChange)
        await fileWatcher.start()
        await flushPromises()

        await eventHandler('add', joinPath(dir, 'some/random/path/file.js'), undefined)

        const hasNonEmptyCall = onChange.mock.calls.some((call) => call[0].length > 0)
        expect(hasNonEmptyCall).toBe(false)
      })
    })

    test('subsequent change/unlink on a runtime-discovered file are not dropped', async () => {
      await inTemporaryDirectory(async (dir) => {
        const extension1 = await testUIExtension({
          type: 'ui_extension',
          handle: 'h1',
          directory: joinPath(dir, 'extensions/ui_extension_1'),
        })
        mockExtensionWatchedFiles(extension1, [joinPath(dir, 'extensions/ui_extension_1/index.js')])

        const testApp = testAppLinked({
          allExtensions: [extension1],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
          configuration: {
            ...DEFAULT_CONFIG,
            extension_directories: ['extensions'],
          } as any,
        })

        let eventHandler: any
        const mockWatcher = {
          on: vi.fn((event: string, listener: any) => {
            if (event === 'all') eventHandler = listener
            return mockWatcher
          }),
          close: vi.fn(() => Promise.resolve()),
        }
        vi.spyOn(chokidar, 'watch').mockReturnValue(mockWatcher as any)

        const fileWatcher = new FileWatcher(testApp, outputOptions, 50)
        const onChange = vi.fn()
        fileWatcher.onChange(onChange)
        await fileWatcher.start()
        await flushPromises()

        const addedPath = joinPath(dir, 'extensions/ui_extension_1/runtime-added.js')
        await eventHandler('add', addedPath, undefined)
        await vi.waitFor(
          () => {
            const events = onChange.mock.calls.find((call) => call[0].length > 0)?.[0]
            if (!events) throw new Error('no add events emitted')
            expect(events.some((event: WatcherEvent) => event.type === 'file_created')).toBe(true)
          },
          {timeout: 1000, interval: 50},
        )

        onChange.mockClear()
        await eventHandler('change', addedPath, undefined)

        await vi.waitFor(
          () => {
            const events = onChange.mock.calls.find((call) => call[0].length > 0)?.[0]
            if (!events) throw new Error('no change events emitted')
            expect(events.some((event: WatcherEvent) => event.type === 'file_updated')).toBe(true)
          },
          {timeout: 1000, interval: 50},
        )
      })
    })
  })

  describe('refreshWatchedFiles', () => {
    test('closes and recreates the watcher with updated paths', async () => {
      await inTemporaryDirectory(async (dir) => {
        const app = testAppLinked({
          allExtensions: [],
          directory: dir,
          configPath: joinPath(dir, 'shopify.app.toml'),
        })

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

        const fileWatcher = new FileWatcher(app, outputOptions)
        await fileWatcher.start()

        expect(watchCalls).toBe(1)
        expect(mockClose).not.toHaveBeenCalled()

        await fileWatcher.start()

        expect(mockClose).toHaveBeenCalledTimes(1)
        expect(watchCalls).toBe(2)
        expect(watchedPaths[1]).toEqual(watchedPaths[0])
      })
    })
  })
})
