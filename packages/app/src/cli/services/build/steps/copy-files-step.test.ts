import {executeCopyFilesStep} from './copy-files-step.js'
import {BuildStep, BuildContext} from '../build-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')

describe('executeCopyFilesStep', () => {
  let mockExtension: ExtensionInstance
  let mockContext: BuildContext
  let mockStdout: any
  let mockStderr: any

  beforeEach(() => {
    mockStdout = {write: vi.fn()}
    mockStderr = {write: vi.fn()}
    mockExtension = {
      directory: '/test/extension',
      outputPath: '/test/output/extension.js',
    } as ExtensionInstance

    mockContext = {
      extension: mockExtension,
      options: {
        stdout: mockStdout,
        stderr: mockStderr,
        app: {} as any,
        environment: 'production',
      },
      stepResults: new Map(),
    }

    vi.clearAllMocks()
  })

  describe('directory strategy', () => {
    test('copies entire directory when source exists', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['file1.js', 'file2.js', 'dir/file3.js'])
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-dir',
        displayName: 'Copy Directory',
        type: 'copy_files',
        config: {
          strategy: 'directory',
          source: 'assets',
        },
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.fileExists).toHaveBeenCalledWith('/test/extension/assets')
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith(
        '/test/extension/assets',
        '/test/output',
      )
      expect(result.filesCopied).toBe(3)
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Copied directory'),
      )
    })

    test('throws error when source does not exist and optional is false', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(false)

      const step: BuildStep = {
        id: 'copy-dir',
        displayName: 'Copy Directory',
        type: 'copy_files',
        config: {
          strategy: 'directory',
          source: 'missing',
          optional: false,
        },
      }

      // When/Then
      await expect(executeCopyFilesStep(step, mockContext)).rejects.toThrow(
        'Source directory does not exist',
      )
    })

    test('throws error when source directory does not exist', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(false)

      const step: BuildStep = {
        id: 'copy-dir',
        displayName: 'Copy Directory',
        type: 'copy_files',
        config: {
          strategy: 'directory',
          source: 'optional-assets',
        },
      }

      // When/Then
      await expect(executeCopyFilesStep(step, mockContext)).rejects.toThrow(
        'Source directory does not exist: /test/extension/optional-assets',
      )
    })

    test('copies to custom destination when specified', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['file1.js'])
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-dir',
        displayName: 'Copy Directory',
        type: 'copy_files',
        config: {
          strategy: 'directory',
          source: 'assets',
          destination: 'public',
        },
      }

      // When
      await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith(
        '/test/extension/assets',
        '/test/output/public',
      )
    })
  })

  describe('pattern strategy', () => {
    test('copies files matching patterns', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue([
        '/test/extension/assets/image1.png',
        '/test/extension/assets/image2.jpg',
      ])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-images',
        displayName: 'Copy Images',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          source: 'assets',
          patterns: ['*.png', '*.jpg'],
        },
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.glob).toHaveBeenCalledWith(
        ['*.png', '*.jpg'],
        expect.objectContaining({
          absolute: true,
          cwd: '/test/extension/assets',
        }),
      )
      expect(fs.copyFile).toHaveBeenCalledTimes(2)
      expect(result.filesCopied).toBe(2)
    })

    test('respects ignore patterns', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/file1.js'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-js',
        displayName: 'Copy JS',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          patterns: ['**/*.js'],
          ignore: ['**/*.test.js'],
        },
      }

      // When
      await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.glob).toHaveBeenCalledWith(
        ['**/*.js'],
        expect.objectContaining({
          ignore: ['**/*.test.js'],
        }),
      )
    })

    test('uses default pattern when none specified', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/file.txt'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-all',
        displayName: 'Copy All',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
        },
      }

      // When
      await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.glob).toHaveBeenCalledWith(
        ['**/*'],
        expect.objectContaining({
          cwd: '/test/extension',
        }),
      )
    })

    test('preserves directory structure when preserveStructure is true', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue([
        '/test/extension/src/components/Button.tsx',
      ])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-src',
        displayName: 'Copy Source',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          source: 'src',
          patterns: ['**/*.tsx'],
          preserveStructure: true,
        },
      }

      // When
      await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.copyFile).toHaveBeenCalledWith(
        '/test/extension/src/components/Button.tsx',
        '/test/output/components/Button.tsx',
      )
    })

    test('flattens files when preserveStructure is false', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue([
        '/test/extension/src/components/Button.tsx',
      ])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-src',
        displayName: 'Copy Source',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          source: 'src',
          patterns: ['**/*.tsx'],
          preserveStructure: false,
        },
      }

      // When
      await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.copyFile).toHaveBeenCalledWith(
        '/test/extension/src/components/Button.tsx',
        '/test/output/Button.tsx',
      )
    })

    test('returns zero files when no matches and optional is false', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue([])
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-none',
        displayName: 'Copy None',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          patterns: ['*.nonexistent'],
          optional: false,
        },
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(result.filesCopied).toBe(0)
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('No files matched patterns'),
      )
    })

    test('skips copy when same source and destination', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/output/file.js'])
      vi.mocked(fs.mkdir).mockResolvedValue()

      mockExtension.directory = '/test/output'

      const step: BuildStep = {
        id: 'copy-same',
        displayName: 'Copy Same',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          patterns: ['*.js'],
        },
      }

      // When
      await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.copyFile).not.toHaveBeenCalled()
    })
  })

  describe('files strategy', () => {
    test('copies specific file list', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-files',
        displayName: 'Copy Specific Files',
        type: 'copy_files',
        config: {
          strategy: 'files',
          files: [
            {source: 'config.json', destination: 'config.json'},
            {source: 'assets/logo.png', destination: 'images/logo.png'},
          ],
        },
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.copyFile).toHaveBeenCalledWith(
        '/test/extension/config.json',
        '/test/output/config.json',
      )
      expect(fs.copyFile).toHaveBeenCalledWith(
        '/test/extension/assets/logo.png',
        '/test/output/images/logo.png',
      )
      expect(result.filesCopied).toBe(2)
    })

    test('throws error when file does not exist and optional is false', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(false)
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-missing',
        displayName: 'Copy Missing File',
        type: 'copy_files',
        config: {
          strategy: 'files',
          files: [{source: 'missing.txt', destination: 'missing.txt'}],
          optional: false,
        },
      }

      // When/Then
      await expect(executeCopyFilesStep(step, mockContext)).rejects.toThrow(
        'Source file does not exist',
      )
    })

    test('throws error when file in list does not exist', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-partial',
        displayName: 'Copy Partial',
        type: 'copy_files',
        config: {
          strategy: 'files',
          files: [
            {source: 'exists.txt', destination: 'exists.txt'},
            {source: 'missing.txt', destination: 'missing.txt'},
          ],
        },
      }

      // When/Then
      await expect(executeCopyFilesStep(step, mockContext)).rejects.toThrow(
        'Source file does not exist: /test/extension/missing.txt',
      )
    })

    test('returns zero when file list is empty', async () => {
      // Given
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-empty',
        displayName: 'Copy Empty',
        type: 'copy_files',
        config: {
          strategy: 'files',
          files: [],
        },
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(result.filesCopied).toBe(0)
      expect(mockStdout.write).toHaveBeenCalledWith('No files specified in file list\n')
    })

    test('skips copy when source and destination are the same', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.mkdir).mockResolvedValue()

      mockExtension.directory = '/test/output'

      const step: BuildStep = {
        id: 'copy-same',
        displayName: 'Copy Same',
        type: 'copy_files',
        config: {
          strategy: 'files',
          files: [{source: 'file.js', destination: 'file.js'}],
        },
      }

      // When
      await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.copyFile).not.toHaveBeenCalled()
    })
  })

  describe('config validation', () => {
    test('throws error for unknown strategy', async () => {
      // Given
      const step: BuildStep = {
        id: 'invalid',
        displayName: 'Invalid Strategy',
        type: 'copy_files',
        config: {
          strategy: 'invalid_strategy',
        },
      }

      // When/Then
      await expect(executeCopyFilesStep(step, mockContext)).rejects.toThrow()
    })

    test('uses default values for optional config', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue([])
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'minimal',
        displayName: 'Minimal Config',
        type: 'copy_files',
        config: {},
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(result.filesCopied).toBe(0)
      // Should use default strategy 'pattern'
      expect(fs.glob).toHaveBeenCalled()
    })
  })

  describe('undefined source handling (ConfigurableValue)', () => {
    test('skips silently when source is undefined and optional is true', async () => {
      // Given - source will resolve to undefined
      const contextWithoutConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {}, // No static_root field
        } as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'copy-optional',
        displayName: 'Copy Optional Assets',
        type: 'copy_files',
        config: {
          strategy: 'directory',
          source: {configPath: 'static_root', optional: true}, // Will resolve to undefined, but that's okay
        },
      }

      // When
      const result = await executeCopyFilesStep(step, contextWithoutConfig)

      // Then
      expect(result.filesCopied).toBe(0)
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Skipping Copy Optional Assets: source is not configured'),
      )
      // Should not attempt any file operations
      expect(fs.fileExists).not.toHaveBeenCalled()
      expect(fs.copyDirectoryContents).not.toHaveBeenCalled()
    })

    test('throws error when source is undefined and optional is false', async () => {
      // Given - source will resolve to undefined
      const contextWithoutConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {}, // No static_root field
        } as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'copy-required',
        displayName: 'Copy Required Assets',
        type: 'copy_files',
        config: {
          strategy: 'directory',
          source: {configPath: 'static_root'}, // Will resolve to undefined - should error
        },
      }

      // When/Then
      await expect(executeCopyFilesStep(step, contextWithoutConfig)).rejects.toThrow(
        'Build step "Copy Required Assets" failed: source configuration is required but resolved to undefined',
      )
    })

    test('works normally when source resolves to a value', async () => {
      // Given - source will resolve to 'public'
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {static_root: 'public'},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['file1.js', 'file2.js'])
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-configured',
        displayName: 'Copy Configured Assets',
        type: 'copy_files',
        config: {
          strategy: 'directory',
          source: {configPath: 'static_root'}, // Will resolve to 'public'
          optional: true,
        },
      }

      // When
      const result = await executeCopyFilesStep(step, contextWithConfig)

      // Then
      expect(result.filesCopied).toBe(2)
      expect(fs.fileExists).toHaveBeenCalledWith(expect.stringContaining('public'))
      expect(fs.copyDirectoryContents).toHaveBeenCalled()
    })
  })
})
