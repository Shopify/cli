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

  describe('manifest generation', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()
      // Source files exist; destination paths don't yet (so findUniqueDestPath
      // resolves on the first candidate without looping). Individual tests can
      // override for specific scenarios.
      vi.mocked(fs.fileExists).mockImplementation(async (p) =>
        typeof p === 'string' && p.startsWith('/test/extension'),
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
                targeting: [
                  {target: 'admin.app.intent.link', tools: './tools.json', url: '/editor'},
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
          generateManifest: true,
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
          generateManifest: true,
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
          generateManifest: true,
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

    test('does NOT write manifest.json when generateManifest is false (default)', async () => {
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

      // No generateManifest field — defaults to false
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

    test('does NOT write manifest.json when generateManifest is true but all inclusions are pattern/static', async () => {
      // Given — pattern and static entries never contribute to the manifest
      vi.mocked(fs.glob).mockResolvedValue(['/test/extension/public/logo.png'])
      vi.mocked(fs.copyFile).mockResolvedValue()
      vi.mocked(fs.mkdir).mockResolvedValue()

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generateManifest: true,
          inclusions: [
            {type: 'pattern', baseDir: 'public', include: ['**/*']},
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, mockContext)

      // Then — no configKey inclusions → no manifest written
      expect(fs.writeFile).not.toHaveBeenCalled()
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
          generateManifest: true,
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

    test('logs a warning and treats inclusion as root-level when only anchor is set (no groupBy)', async () => {
      // Given — inclusion has anchor but no groupBy
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {targeting: {tools: './tools.json'}},
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.fileExists).mockResolvedValue(false)

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generateManifest: true,
          inclusions: [
            {type: 'configKey', key: 'targeting.tools', anchor: 'targeting'},
          ],
        },
      }

      // When
      await executeIncludeAssetsStep(step, contextWithConfig)

      // Then — warning logged, inclusion treated as root entry
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('anchor without groupBy (or vice versa)'),
      )
      const manifestContent = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0]![1] as string)
      expect(manifestContent).toHaveProperty('tools')
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
          generateManifest: true,
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

      // Then — the anchor group was skipped; manifest.json is written but contains no entries
      expect(fs.writeFile).toHaveBeenCalledOnce()
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0]!
      const manifestContent = JSON.parse(writeFileCall[1] as string)
      expect(manifestContent).toEqual({})
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
          generateManifest: true,
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
            extensions: [
              {targeting: [{target: 'admin.intent.link', tools: './tools.json'}]},
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
          generateManifest: true,
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

    test('still copies files AND writes manifest when generateManifest is true', async () => {
      // Given
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [
              {targeting: [{target: 'admin.intent.link', tools: './tools.json'}]},
            ],
          },
        } as unknown as ExtensionInstance,
      }

      vi.mocked(fs.glob).mockResolvedValue([])

      const step: LifecycleStep = {
        id: 'gen-manifest',
        name: 'Generate Manifest',
        type: 'include_assets',
        config: {
          generateManifest: true,
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

    test('includes the full item when anchor equals key (relPath is empty string)', async () => {
      // Given — anchor === key, so stripAnchorPrefix returns "" and buildRelativeEntry returns the whole item
      const contextWithConfig = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extensions: [
              {
                targeting: [
                  {target: 'admin.intent.link', tools: './tools.json', url: '/editor'},
                ],
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
          generateManifest: true,
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

      // Then — manifest value is the full targeting object (including url)
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
    })
  })
})
