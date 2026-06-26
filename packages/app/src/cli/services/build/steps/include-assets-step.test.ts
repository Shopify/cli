import {executeIncludeAssetsStep} from './include-assets-step.js'
import {LifecycleStep, BuildContext} from '../client-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {inTemporaryDirectory, writeFile, mkdir, fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('executeIncludeAssetsStep', () => {
  let mockExtension: ExtensionInstance
  let mockContext: BuildContext
  let mockStdout: any
  let mockStderr: any

  beforeEach(() => {
    mockStdout = {write: vi.fn()}
    mockStderr = {write: vi.fn()}
  })

  describe('static entries', () => {
    test('copies directory under its own name when no destination is given', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        const distDir = joinPath(extensionDir, 'dist')
        await mkdir(distDir)
        await mkdir(outputDir)
        await writeFile(joinPath(distDir, 'index.html'), '<html></html>')
        await writeFile(joinPath(distDir, 'logo.png'), 'png-content')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        await expect(fileExists(joinPath(outputDir, 'dist/index.html'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'dist/logo.png'))).resolves.toBe(true)
        expect(result.filesCopied).toBe(2)
        expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included dist'))
      })
    })

    test('throws when source directory does not exist', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
    })

    test('copies file to explicit destination path', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'src'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'src/icon.png'), 'icon-content')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        await expect(fileExists(joinPath(outputDir, 'assets/icon.png'))).resolves.toBe(true)
        expect(result.filesCopied).toBe(1)
        expect(mockStdout.write).toHaveBeenCalledWith('Included src/icon.png\n')
      })
    })

    test('throws when source file does not exist (with destination)', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
    })

    test('handles multiple static entries in inclusions', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'dist'))
        await mkdir(joinPath(extensionDir, 'src'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'dist/index.html'), 'html')
        await writeFile(joinPath(extensionDir, 'src/icon.png'), 'icon')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        await expect(fileExists(joinPath(outputDir, 'dist/index.html'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'assets/icon.png'))).resolves.toBe(true)
        expect(result.filesCopied).toBe(2)
      })
    })

    test('copies a file to output root when source is a file and no destination is given', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'README.md'), 'readme')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        await expect(fileExists(joinPath(outputDir, 'README.md'))).resolves.toBe(true)
        expect(result.filesCopied).toBe(1)
        expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included README.md'))
      })
    })

    test('copies a directory to explicit destination path and returns actual file count', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'dist'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'dist/a.js'), 'a')
        await writeFile(joinPath(extensionDir, 'dist/b.js'), 'b')
        await writeFile(joinPath(extensionDir, 'dist/c.js'), 'c')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        await expect(fileExists(joinPath(outputDir, 'assets/dist/a.js'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'assets/dist/b.js'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'assets/dist/c.js'))).resolves.toBe(true)
        expect(result.filesCopied).toBe(3)
        expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included dist'))
      })
    })
  })

  describe('configKey entries', () => {
    test('copies directory contents for resolved configKey', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'public'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'public/index.html'), 'html')
        await writeFile(joinPath(extensionDir, 'public/logo.png'), 'logo')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {static_root: 'public'},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        const result = await executeIncludeAssetsStep(step, mockContext)

        // Then
        await expect(fileExists(joinPath(outputDir, 'index.html'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'logo.png'))).resolves.toBe(true)
        expect(result.filesCopied).toBe(2)
      })
    })

    test('skips silently when configKey is absent from config', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — configuration has no static_root
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        const result = await executeIncludeAssetsStep(step, mockContext)

        // Then — no error, no copies
        expect(result.filesCopied).toBe(0)
      })
    })

    test('throws an error when the referenced file does not exist on disk', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {static_root: 'nonexistent'},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

        const step: LifecycleStep = {
          id: 'copy-static',
          name: 'Copy Static',
          type: 'include_assets',
          config: {
            inclusions: [{type: 'configKey', key: 'static_root'}],
          },
        }

        await expect(executeIncludeAssetsStep(step, mockContext)).rejects.toThrow(
          `Couldn't find ${joinPath(extensionDir, 'nonexistent')}\n  Please check the path 'nonexistent' in your configuration`,
        )
      })
    })

    test('throws an error when an intent schema file does not exist on disk', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            targeting: [
              {
                target: 'admin.app.intent.link',
                intents: [{type: 'application/email', action: 'edit', schema: './email-schema.json'}],
              },
            ],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

        const step: LifecycleStep = {
          id: 'copy-intents',
          name: 'Copy Intents',
          type: 'include_assets',
          config: {
            inclusions: [{type: 'configKey', key: 'targeting[].intents[].schema'}],
          },
        }

        await expect(executeIncludeAssetsStep(step, mockContext)).rejects.toThrow(
          `Couldn't find ${joinPath(extensionDir, 'email-schema.json')}\n  Please check the path './email-schema.json' in your configuration`,
        )
      })
    })

    test('does not throw when intent config key is absent', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            targeting: [{target: 'admin.app.intent.link'}],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

        const step: LifecycleStep = {
          id: 'copy-intents',
          name: 'Copy Intents',
          type: 'include_assets',
          config: {
            inclusions: [{type: 'configKey', key: 'targeting[].intents[].schema'}],
          },
        }

        const result = await executeIncludeAssetsStep(step, mockContext)
        expect(result.filesCopied).toBe(0)
      })
    })

    test('overwrites existing file on rebuild', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools.json'), 'tools')
        await writeFile(joinPath(outputDir, 'tools.json'), 'old-tools')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {tools: './tools.json'},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

        const step: LifecycleStep = {
          id: 'copy-tools',
          name: 'Copy Tools',
          type: 'include_assets',
          config: {
            inclusions: [{type: 'configKey', key: 'tools'}],
          },
        }

        const result = await executeIncludeAssetsStep(step, mockContext)

        // Overwrites the existing file rather than creating tools-1.json
        await expect(readFile(joinPath(outputDir, 'tools.json'))).resolves.toBe('tools')
        expect(result.filesCopied).toBe(1)
      })
    })

    test('renames file to avoid collision when two different sources share the same basename', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'a'))
        await mkdir(joinPath(extensionDir, 'b'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'a/schema.json'), 'schema-a')
        await writeFile(joinPath(extensionDir, 'b/schema.json'), 'schema-b')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {tools_a: './a/schema.json', tools_b: './b/schema.json'},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

        const step: LifecycleStep = {
          id: 'copy-tools',
          name: 'Copy Tools',
          type: 'include_assets',
          config: {
            inclusions: [
              {type: 'configKey', key: 'tools_a'},
              {type: 'configKey', key: 'tools_b'},
            ],
          },
        }

        const result = await executeIncludeAssetsStep(step, mockContext)

        await expect(readFile(joinPath(outputDir, 'schema.json'))).resolves.toBe('schema-a')
        await expect(readFile(joinPath(outputDir, 'schema-1.json'))).resolves.toBe('schema-b')
        expect(result.filesCopied).toBe(2)
      })
    })

    test('resolves array config value and copies each path', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — static_root is an array
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'public'))
        await mkdir(joinPath(extensionDir, 'assets'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'public/file1.html'), 'html1')
        await writeFile(joinPath(extensionDir, 'assets/file2.html'), 'html2')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {static_root: ['public', 'assets']},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then — both paths copied
        await expect(fileExists(joinPath(outputDir, 'file1.html'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'file2.html'))).resolves.toBe(true)
      })
    })

    test('resolves nested configKey with [] flatten and collects all leaf values', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — TOML array-of-tables: extensions[].targeting[].tools
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools-a.js'), 'a')
        await writeFile(joinPath(extensionDir, 'tools-b.js'), 'b')
        await writeFile(joinPath(extensionDir, 'tools-c.js'), 'c')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            extensions: [
              {targeting: [{tools: 'tools-a.js'}, {tools: 'tools-b.js'}]},
              {targeting: [{tools: 'tools-c.js'}]},
            ],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then — all three tools paths resolved and copied (file paths → copyFile)
        await expect(readFile(joinPath(outputDir, 'tools-a.js'))).resolves.toBe('a')
        await expect(readFile(joinPath(outputDir, 'tools-b.js'))).resolves.toBe('b')
        await expect(readFile(joinPath(outputDir, 'tools-c.js'))).resolves.toBe('c')
      })
    })

    test('skips silently when [] flatten key resolves to a non-array', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — targeting is a plain object, not an array
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {extensions: {targeting: {tools: 'tools.js'}}},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        const result = await executeIncludeAssetsStep(step, mockContext)

        // Then — contract violated, skipped silently
        expect(result.filesCopied).toBe(0)
      })
    })

    test('handles mixed configKey and source entries in inclusions', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'public'))
        await mkdir(joinPath(extensionDir, 'src'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'public/index.html'), 'html')
        await writeFile(joinPath(extensionDir, 'src/icon.png'), 'icon')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {static_root: 'public'},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        const result = await executeIncludeAssetsStep(step, mockContext)

        // Then — directory configKey uses copyDirectoryContents; file static uses copyFile
        await expect(fileExists(joinPath(outputDir, 'index.html'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'assets/icon.png'))).resolves.toBe(true)
        expect(result.filesCopied).toBe(2)
      })
    })
  })

  describe('pattern entries', () => {
    test('copies files matching include patterns', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'public'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'public/logo.png'), 'logo')
        await writeFile(joinPath(extensionDir, 'public/style.css'), 'css')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        await expect(fileExists(joinPath(outputDir, 'logo.png'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'style.css'))).resolves.toBe(true)
      })
    })

    test('uses extension directory as source when source is omitted', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'index.js'), 'js')
        await writeFile(joinPath(extensionDir, 'manifest.json'), 'json')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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

        // Then
        await expect(fileExists(joinPath(outputDir, 'index.js'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'manifest.json'))).resolves.toBe(true)
      })
    })

    test('respects ignore patterns', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'public'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'public/logo.png'), 'logo')
        await writeFile(joinPath(extensionDir, 'public/style.css'), 'css')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

        const step: LifecycleStep = {
          id: 'copy-public',
          name: 'Copy Public',
          type: 'include_assets',
          config: {
            inclusions: [{type: 'pattern', baseDir: 'public', ignore: ['**/*.png']}],
          },
        }

        // When
        const result = await executeIncludeAssetsStep(step, mockContext)

        // Then
        expect(result.filesCopied).toBe(1)
        await expect(fileExists(joinPath(outputDir, 'style.css'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'logo.png'))).resolves.toBe(false)
      })
    })

    test('copies to destination subdirectory when specified', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'public'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'public/logo.png'), 'logo')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        await expect(fileExists(joinPath(outputDir, 'static/logo.png'))).resolves.toBe(true)
      })
    })

    test('returns zero and warns when no files match', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'public'))
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
  })

  describe('mixed inclusions', () => {
    test('executes all entry types in parallel and aggregates filesCopied count', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'theme'))
        await mkdir(joinPath(extensionDir, 'assets'))
        await mkdir(joinPath(extensionDir, 'src'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'theme/index.html'), 'html')
        await writeFile(joinPath(extensionDir, 'theme/style.css'), 'css')
        await writeFile(joinPath(extensionDir, 'assets/logo.png'), 'png')
        await writeFile(joinPath(extensionDir, 'assets/icon.svg'), 'svg')
        await writeFile(joinPath(extensionDir, 'src/manifest.json'), 'json')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {theme_root: 'theme'},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        const result = await executeIncludeAssetsStep(step, mockContext)

        // Then
        // 5 = 2 pattern + 2 configKey dir contents + 1 explicit file
        expect(result.filesCopied).toBe(5)
        await expect(fileExists(joinPath(outputDir, 'manifest.json'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'index.html'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'style.css'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'logo.png'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'icon.svg'))).resolves.toBe(true)
      })
    })
  })

  describe('manifest generation', () => {
    test('writes manifest.json with a single configKey inclusion using anchor and groupBy', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools.json'), 'tools')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            extensions: [
              {
                targeting: [{target: 'admin.app.intent.link', tools: './tools.json', url: '/editor'}],
              },
            ],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
        expect(manifestContent).toEqual({
          'admin.app.intent.link': {
            tools: 'tools.json',
          },
        })
      })
    })

    test('merges multiple inclusions per target when they share the same anchor and groupBy', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools.json'), 'tools')
        await writeFile(joinPath(extensionDir, 'instructions.md'), 'instructions')
        await writeFile(joinPath(extensionDir, 'email-schema.json'), 'schema')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
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
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then — url is NOT in the manifest because no inclusion references it
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
        expect(manifestContent).toEqual({
          'admin.app.intent.link': {
            tools: 'tools.json',
            instructions: 'instructions.md',
            intents: [{schema: 'email-schema.json'}],
          },
        })
      })
    })

    test('produces one manifest key per targeting entry when multiple entries exist', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools-a.js'), 'a')
        await writeFile(joinPath(extensionDir, 'schema1.json'), 's1')
        await writeFile(joinPath(extensionDir, 'tools-b.js'), 'b')
        await writeFile(joinPath(extensionDir, 'schema2.json'), 's2')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
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
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then — two top-level keys, one per targeting entry
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
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
    })

    test('does NOT write manifest.json when generatesAssetsManifest is false (default)', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools.json'), 'tools')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            extensions: [
              {
                targeting: [{target: 'admin.intent.link', tools: './tools.json'}],
              },
            ],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        await executeIncludeAssetsStep(step, mockContext)

        // Then
        await expect(fileExists(joinPath(outputDir, 'manifest.json'))).resolves.toBe(false)
      })
    })

    test('writes manifest.json with files array when generatesAssetsManifest is true and only pattern inclusions exist', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'public'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'public/logo.png'), 'logo')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
        expect(manifestContent).toEqual({files: ['logo.png']})
      })
    })

    test('writes manifest.json with files array from static entry when generatesAssetsManifest is true', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — static file entry contributes its output path to the manifest "files" array
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'src'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'src/schema.json'), 'schema')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
        expect(manifestContent).toEqual({files: ['schema.json']})
      })
    })

    test('writes root-level manifest entry from non-anchored configKey inclusion', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — configKey without anchor/groupBy contributes at manifest root
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools.json'), 'tools')
        await writeFile(joinPath(extensionDir, 'instructions.md'), 'instructions')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {targeting: {tools: './tools.json', instructions: './instructions.md'}},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then — root-level keys use last path segment; values are output-relative paths
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
        expect(manifestContent).toEqual({
          tools: 'tools.json',
          instructions: 'instructions.md',
        })
      })
    })

    test('maps a directory configKey to a file list in the manifest', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(joinPath(extensionDir, 'dist'))
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'dist/index.html'), 'html')
        await writeFile(joinPath(extensionDir, 'dist/style.css'), 'css')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {admin: {static_root: 'dist'}},
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

        const step: LifecycleStep = {
          id: 'copy-static',
          name: 'Copy Static',
          type: 'include_assets',
          config: {
            generatesAssetsManifest: true,
            // no destination → contents merged into output root
            inclusions: [{type: 'configKey', key: 'admin.static_root'}],
          },
        }

        // When
        await executeIncludeAssetsStep(step, mockContext)

        // Then — directory produces a file list, not an opaque directory marker
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
        expect(manifestContent).toEqual({static_root: expect.arrayContaining(['index.html', 'style.css'])})
      })
    })

    test('throws a validation error when only anchor is set without groupBy', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — inclusion has anchor but no groupBy — schema now rejects this at parse time
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
        } as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
        }

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
    })

    test('merges manifest.json when it already exists in the output directory', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — a prior inclusion already copied a manifest.json to the output dir
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools.json'), 'tools')
        await writeFile(joinPath(outputDir, 'manifest.json'), '{ "old": "manifest" }')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            extensions: [{targeting: [{target: 'admin.intent.link', tools: './tools.json'}]}],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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

        // When / Then — merges with existing manifest.json
        await expect(executeIncludeAssetsStep(step, mockContext)).resolves.not.toThrow()
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
        expect(manifestContent).toEqual({
          'admin.intent.link': {
            tools: 'tools.json',
          },
          old: 'manifest',
        })
      })
    })

    test('writes an empty manifest when anchor resolves to a non-array value', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — "extensions" is a plain string, not an array; the [] flatten marker
        // returns undefined, so the anchor group is skipped and the manifest is empty
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            extensions: 'not-an-array',
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then — no entries produced; manifest.json is NOT written, warning is logged
        await expect(fileExists(joinPath(outputDir, 'manifest.json'))).resolves.toBe(false)
        expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('no manifest entries produced'))
      })
    })

    test('skips items whose groupBy field is not a string', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — one entry has a numeric target, the other has a valid string target
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools-bad.js'), 'bad')
        await writeFile(joinPath(extensionDir, 'tools-good.js'), 'good')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
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
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then — only the string-keyed entry appears
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
        expect(manifestContent).toEqual({
          'admin.link': {tools: 'tools-good.js'},
        })
        expect(manifestContent).not.toHaveProperty('42')
      })
    })

    test('writes manifest.json to outputDir derived from extension.outputPath', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — outputPath is a file, so outputDir is its dirname (/test/output)
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools.json'), 'tools')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            extensions: [{targeting: [{target: 'admin.intent.link', tools: './tools.json'}]}],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then — manifest is placed under /test/output, which is dirname of extension.js
        await expect(fileExists(joinPath(outputDir, 'manifest.json'))).resolves.toBe(true)
      })
    })

    test('still copies files AND writes manifest when generatesAssetsManifest is true', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools.json'), 'tools')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            extensions: [{targeting: [{target: 'admin.intent.link', tools: './tools.json'}]}],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then — file copying happened AND manifest was written
        await expect(fileExists(joinPath(outputDir, 'tools.json'))).resolves.toBe(true)
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
        expect(manifestContent).toEqual({
          'admin.intent.link': {tools: 'tools.json'},
        })
      })
    })

    test('resolves bare filename in manifest even without ./ prefix', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — config value is a bare filename with no ./ prefix; pathMap.has() must catch it
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)
        await writeFile(joinPath(extensionDir, 'tools.json'), 'tools')

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            extensions: [{targeting: [{target: 'admin.intent.link', tools: 'tools.json'}]}],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
        await executeIncludeAssetsStep(step, mockContext)

        // Then — 'tools.json' (no ./ prefix) must be resolved to its output-relative path in the manifest
        await expect(fileExists(joinPath(outputDir, 'tools.json'))).resolves.toBe(true)
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
        expect(manifestContent).toEqual({
          'admin.intent.link': {tools: 'tools.json'},
        })
      })
    })

    test('includes the full item when anchor equals key (relPath is empty string)', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given — anchor === key, so stripAnchorPrefix returns "" and buildRelativeEntry returns the whole item
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            extensions: [
              {
                targeting: [{target: 'admin.intent.link', tools: './tools.json', url: '/editor'}],
              },
            ],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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
                // anchor === key → the whole targeting item becomes the manifest value
                key: 'extensions[].targeting[]',
                anchor: 'extensions[].targeting[]',
                groupBy: 'target',
              },
            ],
          },
        }

        // When
        await executeIncludeAssetsStep(step, mockContext)

        // Then — manifest value is the full targeting object (including url).
        // tools: './tools.json' was never copied (configKey resolved to an object, not a string),
        // so the path is left as-is and a warning is logged.
        const manifestContent = JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
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
    })

    test('throws when a referenced source file does not exist on disk', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        await mkdir(extensionDir)
        await mkdir(outputDir)

        const mockExtension = {
          directory: extensionDir,
          outputPath: joinPath(outputDir, 'extension.js'),
          configuration: {
            extensions: [{targeting: [{target: 'admin.intent.link', tools: './tools.json'}]}],
          },
        } as unknown as ExtensionInstance

        const mockContext = {
          extension: mockExtension,
          options: {
            stdout: mockStdout,
            stderr: mockStderr,
            app: {directory: tmpDir} as any,
            environment: 'production' as 'production' | 'development',
          },
          stepResults: new Map(),
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

        await expect(executeIncludeAssetsStep(step, mockContext)).rejects.toThrow(
          `Couldn't find ${joinPath(extensionDir, 'tools.json')}\n  Please check the path './tools.json' in your configuration`,
        )
      })
    })
  })
})
