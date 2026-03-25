import {executeIncludeAssetsStep} from './include-assets-step.js'
import {LifecycleStep, BuildContext} from '../client-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')

describe('executeIncludeAssetsStep', () => {
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
  })

  describe('static entries', () => {
    test('copies directory under its own name when no destination is given', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['index.html', 'assets/logo.png'])

      const step: LifecycleStep = {
        id: 'copy-dist',
        name: 'Copy Dist',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'static', source: 'dist'}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, mockContext)

      // Then — directory is placed under its own name, not merged into output root
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/dist', '/test/output/dist')
      expect(result.filesCopied).toBe(2)
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included dist'))
    })

    test('throws when source directory does not exist', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(false)

      const step: LifecycleStep = {
        id: 'copy-dist',
        name: 'Copy Dist',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'static', source: 'dist'}],
        },
      }

      // When/Then
      await expect(executeIncludeAssetsStep(step, mockContext)).rejects.toThrow('Source does not exist')
    })

    test('copies file to explicit destination path', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'copy-icon',
        name: 'Copy Icon',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'static', source: 'src/icon.png', destination: 'assets/icon.png'}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, mockContext)

      // Then
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/src/icon.png', '/test/output/assets/icon.png')
      expect(result.filesCopied).toBe(1)
      expect(mockStdout.write).toHaveBeenCalledWith('Included src/icon.png\n')
    })

    test('throws when source file does not exist (with destination)', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(false)

      const step: LifecycleStep = {
        id: 'copy-icon',
        name: 'Copy Icon',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'static', source: 'src/missing.png', destination: 'assets/missing.png'}],
        },
      }

      // When/Then
      await expect(executeIncludeAssetsStep(step, mockContext)).rejects.toThrow('Source does not exist')
    })

    test('handles multiple static entries in inclusions', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['index.html'])

      const step: LifecycleStep = {
        id: 'copy-mixed',
        name: 'Copy Mixed',
        type: 'include_assets',
        config: {
          inclusions: [
            {type: 'static', source: 'dist'},
            {type: 'static', source: 'src/icon.png', destination: 'assets/icon.png'},
          ],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, mockContext)

      // Then
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/dist', '/test/output/dist')
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/src/icon.png', '/test/output/assets/icon.png')
      expect(result.filesCopied).toBe(2)
    })

    test('copies a file to output root when source is a file and no destination is given', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockResolvedValue(false)
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'copy-readme',
        name: 'Copy README',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'static', source: 'README.md'}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, mockContext)

      // Then
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/README.md', '/test/output/README.md')
      expect(result.filesCopied).toBe(1)
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included README.md'))
    })

    test('copies a directory to explicit destination path', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['a.js', 'b.js'])

      const step: LifecycleStep = {
        id: 'copy-dist',
        name: 'Copy Dist',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'static', source: 'dist', destination: 'assets/dist'}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, mockContext)

      // Then
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/dist', '/test/output/assets/dist')
      expect(result.filesCopied).toBe(2)
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included dist'))
    })
  })

  describe('configKey entries', () => {
    test('copies directory contents for resolved configKey', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {static_root: 'public'},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['index.html', 'logo.png'])

      const step: LifecycleStep = {
        id: 'copy-static',
        name: 'Copy Static',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'configKey', key: 'static_root'}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, contextWithConfig)

      // Then
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/public', '/test/output')
      expect(result.filesCopied).toBe(2)
    })

    test('skips silently when configKey is absent from config', async () => {
      // Given — configuration has no static_root
      const contextWithoutConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {},
        } as unknown as ExtensionInstance,
      }

      const step: LifecycleStep = {
        id: 'copy-static',
        name: 'Copy Static',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'configKey', key: 'static_root'}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, contextWithoutConfig)

      // Then — no error, no copies
      expect(result.filesCopied).toBe(0)
      expect(fs.copyDirectoryContents).not.toHaveBeenCalled()
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("No value for configKey 'static_root'"))
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

      const step: LifecycleStep = {
        id: 'copy-static',
        name: 'Copy Static',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'configKey', key: 'static_root'}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — no error, logged warning
      expect(result.filesCopied).toBe(0)
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("Warning: path 'nonexistent' does not exist"),
      )
    })

    test('resolves array config value and copies each path', async () => {
      // Given — static_root is an array
      const contextWithArrayConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {static_root: ['public', 'assets']},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['file.html'])

      const step: LifecycleStep = {
        id: 'copy-static',
        name: 'Copy Static',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'configKey', key: 'static_root'}],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithArrayConfig)

      // Then — both paths copied
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/public', '/test/output')
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/assets', '/test/output')
    })

    test('resolves nested configKey with [] flatten and collects all leaf values', async () => {
      // Given — TOML array-of-tables: extensions[].targeting[].tools
      const contextWithNestedConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [
              {targeting: [{tools: 'tools-a.js'}, {tools: 'tools-b.js'}]},
              {targeting: [{tools: 'tools-c.js'}]},
            ],
          },
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['file.js'])

      const step: LifecycleStep = {
        id: 'copy-tools',
        name: 'Copy Tools',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'configKey', key: 'extensions[].targeting[].tools'}],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithNestedConfig)

      // Then — all three tools paths resolved and copied
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/tools-a.js', '/test/output')
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/tools-b.js', '/test/output')
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/tools-c.js', '/test/output')
    })

    test('skips silently when [] flatten key resolves to a non-array', async () => {
      // Given — targeting is a plain object, not an array
      const contextWithBadConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {extensions: {targeting: {tools: 'tools.js'}}},
        } as unknown as ExtensionInstance,
      }

      const step: LifecycleStep = {
        id: 'copy-tools',
        name: 'Copy Tools',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'configKey', key: 'extensions[].targeting[].tools'}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, contextWithBadConfig)

      // Then — contract violated, skipped silently
      expect(result.filesCopied).toBe(0)
      expect(fs.copyDirectoryContents).not.toHaveBeenCalled()
    })

    test('handles mixed configKey and source entries in inclusions', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {static_root: 'public'},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockImplementation((path) => Promise.resolve(!String(path).endsWith('.png')))
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['index.html'])

      const step: LifecycleStep = {
        id: 'copy-mixed',
        name: 'Copy Mixed',
        type: 'include_assets',
        config: {
          inclusions: [
            {type: 'configKey', key: 'static_root'},
            {type: 'static', source: 'src/icon.png', destination: 'assets/icon.png'},
          ],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, contextWithConfig)

      // Then
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/public', '/test/output')
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/src/icon.png', '/test/output/assets/icon.png')
      expect(result.filesCopied).toBe(2)
    })
  })

  describe('pattern entries', () => {
    test('copies files matching include patterns', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/public/logo.png', '/test/extension/public/style.css'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'copy-public',
        name: 'Copy Public',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'pattern', baseDir: 'public', include: ['**/*']}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, mockContext)

      // Then
      expect(result.filesCopied).toBe(2)
      expect(fs.copyFile).toHaveBeenCalledTimes(2)
    })

    test('uses extension directory as source when source is omitted', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/index.js', '/test/extension/manifest.json'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'copy-root',
        name: 'Copy Root',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'pattern', include: ['*.js', '*.json']}],
        },
      }

      // When
      await executeIncludeAssetsStep(step, mockContext)

      // Then — glob is called with extension.directory as cwd
      expect(fs.glob).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({cwd: '/test/extension'}))
    })

    test('respects ignore patterns', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/public/style.css'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'copy-public',
        name: 'Copy Public',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'pattern', baseDir: 'public', ignore: ['**/*.png']}],
        },
      }

      // When
      await executeIncludeAssetsStep(step, mockContext)

      // Then
      expect(fs.glob).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ignore: ['**/*.png']}))
    })

    test('copies to destination subdirectory when specified', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/public/logo.png'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'copy-public',
        name: 'Copy Public',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'pattern', baseDir: 'public', destination: 'static'}],
        },
      }

      // When
      await executeIncludeAssetsStep(step, mockContext)

      // Then
      expect(fs.glob).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({cwd: '/test/extension/public'}))
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/public/logo.png', '/test/output/static/logo.png')
    })

    test('returns zero and warns when no files match', async () => {
      // Given
      vi.mocked(fs.glob).mockResolvedValue([])
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'copy-public',
        name: 'Copy Public',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'pattern', baseDir: 'public'}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, mockContext)

      // Then
      expect(result.filesCopied).toBe(0)
    })
  })

  describe('mixed inclusions', () => {
    test('executes all entry types in parallel and aggregates filesCopied count', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {theme_root: 'theme'},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockImplementation((path) => Promise.resolve(!String(path).endsWith('.json')))
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()
      // glob: first call for pattern entry, second for configKey dir listing
      vi.mocked(fs.glob)
        .mockResolvedValueOnce(['/test/extension/assets/logo.png', '/test/extension/assets/icon.svg'])
        .mockResolvedValueOnce(['index.html', 'style.css'])

      const step: LifecycleStep = {
        id: 'include-all',
        name: 'Include All',
        type: 'include_assets',
        config: {
          inclusions: [
            {type: 'pattern', baseDir: 'assets', include: ['**/*.png', '**/*.svg']},
            {type: 'configKey', key: 'theme_root'},
            {type: 'static', source: 'src/manifest.json', destination: 'manifest.json'},
          ],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, contextWithConfig)

      // Then
      // 5 = 2 pattern + 2 configKey dir contents + 1 explicit file
      expect(result.filesCopied).toBe(5)
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/src/manifest.json', '/test/output/manifest.json')
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/theme', '/test/output')
    })
  })
})
