import {executeCopyFilesStep} from './copy-files-step.js'
import {BuildStep, BuildContext} from '../build-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')

describe('executeCopyFilesStep', () => {
  let mockExtension: ExtensionInstance
  let mockContext: BuildContext
  let mockStdout: any

  beforeEach(() => {
    mockStdout = {write: vi.fn()}
    mockExtension = {
      directory: '/test/extension',
      outputPath: '/test/output/extension.js',
    } as ExtensionInstance

    mockContext = {
      extension: mockExtension,
      options: {
        stdout: mockStdout,
        stderr: {write: vi.fn()},
        app: {} as any,
        environment: 'production',
      },
      stepResults: new Map(),
    }
  })

  describe('files strategy — explicit file list', () => {
    test('copies directory contents to output root when no destination', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['index.html', 'assets/logo.png'])

      const step: BuildStep = {
        id: 'copy-dist',
        displayName: 'Copy Dist',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {
            files: [{source: 'dist'}],
          },
        },
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/dist', '/test/output')
      expect(result.filesCopied).toBe(2)
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Copied contents of dist to output root'))
    })

    test('throws when source directory does not exist', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(false)

      const step: BuildStep = {
        id: 'copy-dist',
        displayName: 'Copy Dist',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {
            files: [{source: 'dist'}],
          },
        },
      }

      // When/Then
      await expect(executeCopyFilesStep(step, mockContext)).rejects.toThrow('Source does not exist')
    })

    test('copies file to explicit destination path', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-icon',
        displayName: 'Copy Icon',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {
            files: [{source: 'src/icon.png', destination: 'assets/icon.png'}],
          },
        },
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/src/icon.png', '/test/output/assets/icon.png')
      expect(result.filesCopied).toBe(1)
      expect(mockStdout.write).toHaveBeenCalledWith('Copied src/icon.png to assets/icon.png\n')
    })

    test('throws when source file does not exist (with destination)', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(false)

      const step: BuildStep = {
        id: 'copy-icon',
        displayName: 'Copy Icon',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {
            files: [{source: 'src/missing.png', destination: 'assets/missing.png'}],
          },
        },
      }

      // When/Then
      await expect(executeCopyFilesStep(step, mockContext)).rejects.toThrow('Source does not exist')
    })

    test('handles mixed entries: directory-to-root and explicit file', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['index.html'])

      const step: BuildStep = {
        id: 'copy-mixed',
        displayName: 'Copy Mixed',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {
            files: [{source: 'dist'}, {source: 'src/icon.png', destination: 'assets/icon.png'}],
          },
        },
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/dist', '/test/output')
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/src/icon.png', '/test/output/assets/icon.png')
      expect(result.filesCopied).toBe(2)
    })
  })

  describe('files strategy — tomlKey entries', () => {
    test('copies directory contents for resolved tomlKey', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {static_root: 'public'},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['index.html', 'logo.png'])

      const step: BuildStep = {
        id: 'copy-static',
        displayName: 'Copy Static',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {files: [{tomlKey: 'static_root'}]},
        },
      }

      // When
      const result = await executeCopyFilesStep(step, contextWithConfig)

      // Then
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/public', '/test/output')
      expect(result.filesCopied).toBe(2)
    })

    test('skips silently when tomlKey is absent from config', async () => {
      // Given — configuration has no static_root
      const contextWithoutConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {},
        } as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'copy-static',
        displayName: 'Copy Static',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {files: [{tomlKey: 'static_root'}]},
        },
      }

      // When
      const result = await executeCopyFilesStep(step, contextWithoutConfig)

      // Then — no error, no copies
      expect(result.filesCopied).toBe(0)
      expect(fs.copyDirectoryContents).not.toHaveBeenCalled()
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("No value for tomlKey 'static_root'"))
    })

    test('skips path that does not exist on disk but logs a warning', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {static_root: 'nonexistent'},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(false)

      const step: BuildStep = {
        id: 'copy-static',
        displayName: 'Copy Static',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {files: [{tomlKey: 'static_root'}]},
        },
      }

      // When
      const result = await executeCopyFilesStep(step, contextWithConfig)

      // Then — no error, logged warning
      expect(result.filesCopied).toBe(0)
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("Warning: path 'nonexistent' does not exist"),
      )
    })

    test('resolves TOML array field and copies each path', async () => {
      // Given — static_root is an array
      const contextWithArrayConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {static_root: ['public', 'assets']},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['file.html'])

      const step: BuildStep = {
        id: 'copy-static',
        displayName: 'Copy Static',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {files: [{tomlKey: 'static_root'}]},
        },
      }

      // When
      await executeCopyFilesStep(step, contextWithArrayConfig)

      // Then — both paths copied
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/public', '/test/output')
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/assets', '/test/output')
    })

    test('handles mixed source and tomlKey entries in a single step', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {static_root: 'public'},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['index.html'])

      const step: BuildStep = {
        id: 'copy-mixed',
        displayName: 'Copy Mixed',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {
            files: [{tomlKey: 'static_root'}, {source: 'src/icon.png', destination: 'assets/icon.png'}],
          },
        },
      }

      // When
      const result = await executeCopyFilesStep(step, contextWithConfig)

      // Then
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/public', '/test/output')
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/src/icon.png', '/test/output/assets/icon.png')
      expect(result.filesCopied).toBe(2)
    })
  })

  describe('pattern strategy', () => {
    test('copies files matching patterns', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/public/logo.png', '/test/extension/public/style.css'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-public',
        displayName: 'Copy Public',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          definition: {
            source: 'public',
            patterns: ['**/*'],
          },
        },
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(result.filesCopied).toBe(2)
      expect(fs.copyFile).toHaveBeenCalledTimes(2)
    })

    test('respects ignore patterns', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/public/style.css'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-public',
        displayName: 'Copy Public',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          definition: {
            source: 'public',
            ignore: ['**/*.png'],
          },
        },
      }

      // When
      await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.glob).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ignore: ['**/*.png']}))
    })

    test('copies to destination subdirectory when specified', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/public/logo.png'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-public',
        displayName: 'Copy Public',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          definition: {
            source: 'public',
            destination: 'static',
          },
        },
      }

      // When
      await executeCopyFilesStep(step, mockContext)

      // Then
      expect(fs.glob).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({cwd: '/test/extension/public'}))
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/public/logo.png', '/test/output/static/logo.png')
    })

    test('flattens files when preserveStructure is false', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/src/components/Button.tsx'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-src',
        displayName: 'Copy Source',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          definition: {
            source: 'src',
            preserveStructure: false,
          },
        },
      }

      // When
      await executeCopyFilesStep(step, mockContext)

      // Then — filename only, no subdirectory
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/src/components/Button.tsx', '/test/output/Button.tsx')
    })

    test('returns zero and warns when no files match', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue([])
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: BuildStep = {
        id: 'copy-public',
        displayName: 'Copy Public',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          definition: {source: 'public'},
        },
      }

      // When
      const result = await executeCopyFilesStep(step, mockContext)

      // Then
      expect(result.filesCopied).toBe(0)
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('No files matched patterns'))
    })

    test('throws when source is missing', async () => {
      // Given — no source provided
      const step: BuildStep = {
        id: 'copy-build',
        displayName: 'Copy Build',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          definition: {},
        },
      }

      // When/Then
      await expect(executeCopyFilesStep(step, mockContext)).rejects.toThrow('Build step "Copy Build" requires a source')
    })
  })
})
