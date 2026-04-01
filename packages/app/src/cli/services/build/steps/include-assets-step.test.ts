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

    test('copies a directory to explicit destination path and returns actual file count', async () => {
      // Given
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['a.js', 'b.js', 'c.js'])
      vi.mocked(fs.mkdir).mockResolvedValue()

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

      // Then — uses copyDirectoryContents (not copyFile) and counts actual files via glob
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/dist', '/test/output/assets/dist')
      expect(fs.copyFile).not.toHaveBeenCalled()
      expect(result.filesCopied).toBe(3)
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Copied dist to assets/dist'))
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

    test('renames output file to avoid collision when candidate path already exists', async () => {
      // Given — tools.json already exists in the output dir; findUniqueDestPath must try tools-1.json
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {tools: './tools.json'},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockImplementation(async (path) => {
        const pathStr = String(path)
        // Source file exists; first candidate output path is taken; suffixed path is free
        return pathStr === '/test/extension/tools.json' || pathStr === '/test/output/tools.json'
      })
      vi.mocked(fs.isDirectory).mockResolvedValue(false)
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'copy-tools',
        name: 'Copy Tools',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'configKey', key: 'tools'}],
        },
      }

      // When
      const result = await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — copied to tools-1.json, not tools.json
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/tools.json', '/test/output/tools-1.json')
      expect(result.filesCopied).toBe(1)
    })

    test('throws after exhausting 1000 rename attempts', async () => {
      // Given — every candidate path (tools.json, tools-1.json … tools-1000.json) is taken
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {tools: './tools.json'},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockImplementation(async (path) => {
        const pathStr = String(path)
        // Source file exists; all 1001 output candidates are occupied
        return pathStr.startsWith('/test/extension/') || pathStr.startsWith('/test/output/tools')
      })
      vi.mocked(fs.isDirectory).mockResolvedValue(false)
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'copy-tools',
        name: 'Copy Tools',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'configKey', key: 'tools'}],
        },
      }

      // When / Then
      await expect(executeIncludeAssetsStep(step, contextWithConfig)).rejects.toThrow(
        "Unable to find unique destination path for 'tools.json' in '/test/output' after 1000 attempts",
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

      vi.mocked(fs.fileExists).mockImplementation(
        async (path) => typeof path === 'string' && path.startsWith('/test/extension'),
      )
      vi.mocked(fs.isDirectory).mockResolvedValue(false)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['file.js'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

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

      // Then — all three tools paths resolved and copied (file paths → copyFile)
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/tools-a.js', '/test/output/tools-a.js')
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/tools-b.js', '/test/output/tools-b.js')
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/tools-c.js', '/test/output/tools-c.js')
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
      // Directories have no file extension; files do
      vi.mocked(fs.isDirectory).mockImplementation(async (path) => !/\.\w+$/.test(String(path)))
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

      // Then — directory configKey uses copyDirectoryContents; file static uses copyFile
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
      // Directories have no file extension; files do
      vi.mocked(fs.isDirectory).mockImplementation(async (path) => !/\.\w+$/.test(String(path)))
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()
      // configKey entries run sequentially first, then pattern/static in parallel.
      // glob: first call for configKey dir listing, second for pattern source files.
      vi.mocked(fs.glob)
        .mockResolvedValueOnce(['index.html', 'style.css'])
        .mockResolvedValueOnce(['/test/extension/assets/logo.png', '/test/extension/assets/icon.svg'])

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
      // 5 = 2 pattern + 2 configKey dir contents + 1 explicit file (manifest.json is a file → copyFile → 1)
      expect(result.filesCopied).toBe(5)
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/src/manifest.json', '/test/output/manifest.json')
      expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/test/extension/theme', '/test/output')
    })
  })

  describe('manifest generation', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()
      // Source files exist; destination paths don't yet (so findUniqueDestPath
      // resolves on the first candidate without looping). Individual tests can
      // override for specific scenarios.
      vi.mocked(fs.fileExists).mockImplementation(
        async (path) => typeof path === 'string' && path.startsWith('/test/extension'),
      )
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue([])
    })

    test('writes manifest.json with a single configKey inclusion using anchor and groupBy', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [
              {
                targeting: [{target: 'admin.app.intent.link', tools: './tools.json', url: '/editor'}],
              },
            ],
          },
        } as unknown as ExtensionInstance,
      }

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0]!
      expect(writeFileCall[0]).toBe('/test/output/manifest.json')
      const manifestContent = JSON.parse(writeFileCall[1] as string)
      expect(manifestContent).toEqual({
        'admin.app.intent.link': {
          tools: 'tools.json',
        },
      })
    })

    test('merges multiple inclusions per target when they share the same anchor and groupBy', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [
              {
                targeting: [
                  {
                    target: 'admin.app.intent.link',
                    tools: './tools.json',
                    instructions: './instructions.md',
                    url: '/editor',
                    intents: [{type: 'application/email', action: 'open', schema: './email-schema.json'}],
                  },
                ],
              },
            ],
          },
        } as unknown as ExtensionInstance,
      }

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
            {
              type: 'configKey',
              key: 'extensions[].targeting[].instructions',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
            {
              type: 'configKey',
              key: 'extensions[].targeting[].intents[].schema',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — url is NOT in the manifest because no inclusion references it
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0]!
      const manifestContent = JSON.parse(writeFileCall[1] as string)
      expect(manifestContent).toEqual({
        'admin.app.intent.link': {
          tools: 'tools.json',
          instructions: 'instructions.md',
          intents: [{schema: 'email-schema.json'}],
        },
      })
    })

    test('produces one manifest key per targeting entry when multiple entries exist', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [
              {
                targeting: [
                  {target: 'admin.intent.link', tools: './tools-a.js', intents: [{schema: './schema1.json'}]},
                  {target: 'admin.other.target', tools: './tools-b.js', intents: [{schema: './schema2.json'}]},
                ],
              },
            ],
          },
        } as unknown as ExtensionInstance,
      }

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
            {
              type: 'configKey',
              key: 'extensions[].targeting[].intents[].schema',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — two top-level keys, one per targeting entry
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0]!
      const manifestContent = JSON.parse(writeFileCall[1] as string)
      expect(manifestContent).toEqual({
        'admin.intent.link': {
          tools: 'tools-a.js',
          intents: [{schema: 'schema1.json'}],
        },
        'admin.other.target': {
          tools: 'tools-b.js',
          intents: [{schema: 'schema2.json'}],
        },
      })
    })

    test('does NOT write manifest.json when generatesAssetsManifest is false (default)', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [
              {
                targeting: [{target: 'admin.intent.link', tools: './tools.json'}],
              },
            ],
          },
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(false)

      // No generatesAssetsManifest field — defaults to false
      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then
      expect(fs.writeFile).not.toHaveBeenCalled()
    })

    test('writes manifest.json with files array when generatesAssetsManifest is true and only pattern inclusions exist', async () => {
      // Given — pattern entries contribute output paths to the manifest "files" array
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/public/logo.png'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()
      vi.mocked(fs.fileExists).mockResolvedValue(false)
      vi.mocked(fs.writeFile).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [{type: 'pattern', baseDir: 'public', include: ['**/*']}],
        },
      }

      // When
      await executeIncludeAssetsStep(step, mockContext)

      // Then — pattern entry contributes its output path to the manifest
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const manifestContent = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0]![1] as string)
      expect(manifestContent).toEqual({files: ['logo.png']})
    })

    test('writes manifest.json with files array from static entry when generatesAssetsManifest is true', async () => {
      // Given — static file entry contributes its output path to the manifest "files" array
      vi.mocked(fs.fileExists).mockResolvedValue(true)
      vi.mocked(fs.isDirectory).mockResolvedValue(false)
      vi.mocked(fs.mkdir).mockResolvedValue()
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.writeFile).mockResolvedValue()

      // fileExists returns false for the manifest.json output path check
      vi.mocked(fs.fileExists).mockImplementation(async (path) => String(path) !== '/test/output/manifest.json')

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [{type: 'static', source: 'src/schema.json'}],
        },
      }

      // When
      await executeIncludeAssetsStep(step, mockContext)

      // Then — static entry contributes its output path to the manifest
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const manifestContent = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0]![1] as string)
      expect(manifestContent).toEqual({files: ['schema.json']})
    })

    test('writes root-level manifest entry from non-anchored configKey inclusion', async () => {
      // Given — configKey without anchor/groupBy contributes at manifest root
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {targeting: {tools: './tools.json', instructions: './instructions.md'}},
        } as unknown as ExtensionInstance,
      }

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {type: 'configKey', key: 'targeting.tools'},
            {type: 'configKey', key: 'targeting.instructions'},
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — root-level keys use last path segment; values are output-relative paths
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const manifestContent = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0]![1] as string)
      expect(manifestContent).toEqual({
        tools: 'tools.json',
        instructions: 'instructions.md',
      })
    })

    test('maps a directory configKey to a file list in the manifest', async () => {
      // Directory sources produce a string[] of output-relative file paths rather
      // than an opaque directory marker like "." or "".
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {admin: {static_root: 'dist'}},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockImplementation(async (pathArg) => {
        // The source 'dist' directory must exist so the copy runs; manifest.json must not
        return String(pathArg) === '/test/extension/dist'
      })
      vi.mocked(fs.isDirectory).mockResolvedValue(true)
      vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
      vi.mocked(fs.glob).mockResolvedValue(['index.html', 'style.css'])

      const step: LifecycleStep = {
        id: 'copy-static',
        name: 'Copy Static',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          // no destination, no preserveStructure → contents merged into output root
          inclusions: [{type: 'configKey', key: 'admin.static_root'}],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — directory produces a file list, not an opaque directory marker
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const manifestContent = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0]![1] as string)
      expect(manifestContent).toEqual({static_root: ['index.html', 'style.css']})
    })

    test('throws a validation error when only anchor is set without groupBy', async () => {
      // Given — inclusion has anchor but no groupBy — schema now rejects this at parse time
      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [{type: 'configKey', key: 'targeting.tools', anchor: 'targeting'}],
        },
      }

      // When / Then — schema refinement rejects anchor without groupBy
      await expect(executeIncludeAssetsStep(step, mockContext)).rejects.toThrow(
        '`anchor` and `groupBy` must both be set or both be omitted',
      )
    })

    test('throws when manifest.json already exists in the output directory', async () => {
      // Given — a prior inclusion already copied a manifest.json to the output dir
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [{targeting: [{target: 'admin.intent.link', tools: './tools.json'}]}],
          },
        } as unknown as ExtensionInstance,
      }

      // Source files exist; output manifest.json already exists (simulating conflict);
      // candidate output paths for tools.json are free so copyConfigKeyEntry succeeds.
      vi.mocked(fs.fileExists).mockImplementation(async (path) => {
        const pathStr = String(path)
        return pathStr === '/test/output/manifest.json' || pathStr.startsWith('/test/extension/')
      })
      vi.mocked(fs.glob).mockResolvedValue([])

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When / Then — throws rather than silently overwriting
      await expect(executeIncludeAssetsStep(step, contextWithConfig)).rejects.toThrow(
        `Can't write manifest.json: a file already exists at '/test/output/manifest.json'`,
      )
    })

    test('writes an empty manifest when anchor resolves to a non-array value', async () => {
      // Given — "extensions" is a plain string, not an array; the [] flatten marker
      // returns undefined, so the anchor group is skipped and the manifest is empty
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: 'not-an-array',
          },
        } as unknown as ExtensionInstance,
      }

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — no entries produced; manifest.json is NOT written, warning is logged
      expect(fs.writeFile).not.toHaveBeenCalled()
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('no manifest entries produced'))
    })

    test('skips items whose groupBy field is not a string', async () => {
      // Given — one entry has a numeric target, the other has a valid string target
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [
              {
                targeting: [
                  {target: 42, tools: './tools-bad.js'},
                  {target: 'admin.link', tools: './tools-good.js'},
                ],
              },
            ],
          },
        } as unknown as ExtensionInstance,
      }

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — only the string-keyed entry appears
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0]!
      const manifestContent = JSON.parse(writeFileCall[1] as string)
      expect(manifestContent).toEqual({
        'admin.link': {tools: 'tools-good.js'},
      })
      expect(manifestContent).not.toHaveProperty('42')
    })

    test('writes manifest.json to outputDir derived from extension.outputPath', async () => {
      // Given — outputPath is a file, so outputDir is its dirname (/test/output)
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          outputPath: '/test/output/extension.js',
          configuration: {
            extensions: [{targeting: [{target: 'admin.intent.link', tools: './tools.json'}]}],
          },
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(false)

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — manifest is placed under /test/output, which is dirname of extension.js
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0]!
      expect(writeFileCall[0]).toBe('/test/output/manifest.json')
    })

    test('still copies files AND writes manifest when generatesAssetsManifest is true', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [{targeting: [{target: 'admin.intent.link', tools: './tools.json'}]}],
          },
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.glob).mockResolvedValue([])

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — file copying happened AND manifest was written
      // joinPath normalises './tools.json' → 'tools.json', so the resolved source path has no leading './'
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/tools.json', '/test/output/tools.json')
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0]!
      const manifestContent = JSON.parse(writeFileCall[1] as string)
      expect(manifestContent).toEqual({
        'admin.intent.link': {tools: 'tools.json'},
      })
    })

    test('resolves bare filename in manifest even without ./ prefix', async () => {
      // Given — config value is a bare filename with no ./ prefix; pathMap.has() must catch it
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [{targeting: [{target: 'admin.intent.link', tools: 'tools.json'}]}],
          },
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.glob).mockResolvedValue([])

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — 'tools.json' (no ./ prefix) must be resolved to its output-relative path in the manifest
      expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/tools.json', '/test/output/tools.json')
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0]!
      const manifestContent = JSON.parse(writeFileCall[1] as string)
      expect(manifestContent).toEqual({
        'admin.intent.link': {tools: 'tools.json'},
      })
    })

    test('includes the full item when anchor equals key (relPath is empty string)', async () => {
      // Given — anchor === key, so stripAnchorPrefix returns "" and buildRelativeEntry returns the whole item
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [
              {
                targeting: [{target: 'admin.intent.link', tools: './tools.json', url: '/editor'}],
              },
            ],
          },
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(false)

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              // anchor === key → the whole targeting item becomes the manifest value
              key: 'extensions[].targeting[]',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — manifest value is the full targeting object (including url).
      // tools: './tools.json' was never copied (configKey resolved to an object, not a string),
      // so the path is left as-is and a warning is logged.
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0]!
      const manifestContent = JSON.parse(writeFileCall[1] as string)
      expect(manifestContent).toEqual({
        'admin.intent.link': {
          target: 'admin.intent.link',
          tools: './tools.json',
          url: '/editor',
        },
      })
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("manifest entry 'admin.intent.link' contains unresolved paths"),
      )
    })

    test('warns when a manifest entry contains an unresolved path because the source file was missing', async () => {
      // Given — tools.json is referenced in config but does not exist on disk,
      // so copyConfigKeyEntry skips it and it never enters pathMap.
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [{targeting: [{target: 'admin.intent.link', tools: './tools.json'}]}],
          },
        } as unknown as ExtensionInstance,
      }

      // Source file does not exist; output paths are free
      vi.mocked(fs.fileExists).mockResolvedValue(false)
      vi.mocked(fs.glob).mockResolvedValue([])

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {
              type: 'configKey',
              key: 'extensions[].targeting[].tools',
              anchor: 'extensions[].targeting[]',
              groupBy: 'target',
            },
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — raw './tools.json' appears in manifest (not copied → not resolved),
      // and a diagnostic warning is logged so the user knows a file is missing.
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0]!
      const manifestContent = JSON.parse(writeFileCall[1] as string)
      expect(manifestContent).toEqual({'admin.intent.link': {tools: './tools.json'}})
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("manifest entry 'admin.intent.link' contains unresolved paths"),
      )
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("path './tools.json' does not exist"))
    })
  })
})
