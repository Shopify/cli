import {executeBuildManifestStep, ResolvedAsset, ResolvedAssets, PerItemManifest} from './build-manifest-step.js'
import {ClientStep, BuildContext} from '../client-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')

// Helpers to narrow the union return type
function asSingle(result: Awaited<ReturnType<typeof executeBuildManifestStep>>) {
  return result as {outputFile: string; assets: ResolvedAssets}
}
function asForEach(result: Awaited<ReturnType<typeof executeBuildManifestStep>>) {
  return result as {outputFile: string; manifests: PerItemManifest[]}
}

describe('executeBuildManifestStep', () => {
  let mockExtension: ExtensionInstance
  let mockContext: BuildContext
  let mockStdout: {write: ReturnType<typeof vi.fn>}

  beforeEach(() => {
    mockStdout = {write: vi.fn()}
    mockExtension = {
      directory: '/test/extension',
      outputPath: '/test/output/extension.js',
      configuration: {handle: 'my-ext'},
    } as unknown as ExtensionInstance

    mockContext = {
      extension: mockExtension,
      options: {
        stdout: mockStdout as any,
        stderr: {write: vi.fn()} as any,
        app: {} as any,
        environment: 'production',
      },
      stepResults: new Map(),
    }

    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.writeFile).mockResolvedValue()
  })

  // ── Filepath generation ──────────────────────────────────────────────────

  describe('filepath generation — single mode', () => {
    test('generates {handle}-{assetKey}{extension} for each asset', async () => {
      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {
          assets: {
            main: {moduleKey: 'module'},
            should_render: {moduleKey: 'should_render.module'},
          },
        },
      }

      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', module: './src/index.tsx', should_render: {module: './src/conditions.tsx'}},
        } as unknown as ExtensionInstance,
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect((result.assets.main as ResolvedAsset).filepath).toBe('my-ext-main.js')
      expect((result.assets.should_render as ResolvedAsset).filepath).toBe('my-ext-should_render.js')
    })

    test('uses custom extension when specified', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', tools: './src/tools.json'},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {
          assets: {
            tools: {moduleKey: 'tools', static: true},
          },
        },
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect((result.assets.tools as ResolvedAsset).filepath).toBe('my-ext-tools.json')
    })

    test('throws when handle is missing from extension config', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {module: './src/index.tsx'},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {moduleKey: 'module'}}},
      }

      await expect(executeBuildManifestStep(step, mockContext)).rejects.toThrow("'handle' field")
    })
  })

  // ── Module resolution ────────────────────────────────────────────────────

  describe('module resolution', () => {
    test("resolves module from moduleKey: 'module' pointing to the extension's module field", async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', module: './src/index.tsx'},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {moduleKey: 'module'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect((result.assets.main as ResolvedAsset).module).toBe('./src/index.tsx')
    })

    test('resolves module from a custom moduleKey', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', entry: './src/entry.tsx'},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {moduleKey: 'entry'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect((result.assets.main as ResolvedAsset).module).toBe('./src/entry.tsx')
    })

    test('resolves nested module key (dot notation)', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', should_render: {module: './src/conditions.tsx'}},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {should_render: {moduleKey: 'should_render.module'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect((result.assets.should_render as ResolvedAsset).module).toBe('./src/conditions.tsx')
    })

    test('includes static flag when set', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', tools: './src/tools.json'},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {tools: {moduleKey: 'tools', static: true, extension: '.json'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect((result.assets.tools as ResolvedAsset).static).toBe(true)
    })
  })

  // ── Optional assets ──────────────────────────────────────────────────────

  describe('optional assets', () => {
    test('silently skips optional asset when moduleKey cannot be resolved', async () => {
      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {
          assets: {
            main: {moduleKey: 'module'},
            should_render: {moduleKey: 'should_render.module', optional: true},
          },
        },
      }

      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', module: './src/index.tsx'},
        } as unknown as ExtensionInstance,
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets.should_render).toBeUndefined()
      expect(mockStdout.write).not.toHaveBeenCalledWith(expect.stringContaining('should_render'))
    })

    test('logs warning and skips non-optional asset when moduleKey cannot be resolved', async () => {
      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {moduleKey: 'missing_key'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets).toEqual({})
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("Could not resolve module for asset 'main'"),
      )
    })
  })

  // ── forEach — per-target iteration ───────────────────────────────────────

  describe('forEach — per-target iteration', () => {
    test('generates {handle}-{target}-{assetKey}.js filepath for each item', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            handle: 'my-ext',
            extension_points: [
              {target: 'purchase.checkout.block.render', module: './src/checkout.tsx'},
              {target: 'admin.product-details.action.render', module: './src/admin.tsx'},
            ],
          },
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {main: {moduleKey: 'module'}},
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests).toHaveLength(2)
      expect(result.manifests[0]).toEqual({
        target: 'purchase.checkout.block.render',
        build_manifest: {
          assets: {main: {filepath: 'my-ext-purchase.checkout.block.render-main.js', module: './src/checkout.tsx'}},
        },
      })
      expect(result.manifests[1]).toEqual({
        target: 'admin.product-details.action.render',
        build_manifest: {
          assets: {main: {filepath: 'my-ext-admin.product-details.action.render-main.js', module: './src/admin.tsx'}},
        },
      })
    })

    test('includes all asset types with correct filepaths and static flag', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            handle: 'my-ext',
            extension_points: [
              {
                target: 'purchase.checkout.block.render',
                module: './src/checkout.tsx',
                should_render: {module: './src/conditions.tsx'},
                tools: './src/tools.json',
              },
            ],
          },
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {
            main: {moduleKey: 'module'},
            should_render: {moduleKey: 'should_render.module', optional: true},
            tools: {moduleKey: 'tools', static: true, optional: true},
          },
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))
      const target = 'purchase.checkout.block.render'

      expect(result.manifests[0]!.build_manifest.assets).toEqual({
        main: {filepath: `my-ext-${target}-main.js`, module: './src/checkout.tsx'},
        should_render: {filepath: `my-ext-${target}-should_render.js`, module: './src/conditions.tsx'},
        tools: {filepath: `my-ext-${target}-tools.json`, module: './src/tools.json', static: true},
      })
    })

    test('skips optional asset when its moduleKey cannot be resolved in the item', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            handle: 'my-ext',
            extension_points: [{target: 'checkout.render', module: './src/index.tsx'}],
          },
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {
            main: {moduleKey: 'module'},
            should_render: {moduleKey: 'should_render.module', optional: true},
          },
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests[0]!.build_manifest.assets).toEqual({
        main: {filepath: 'my-ext-checkout.render-main.js', module: './src/index.tsx'},
      })
    })

    test('expands asset into array when item module key resolves to an inner string array', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            handle: 'my-ext',
            extension_points: [
              {
                target: 'checkout.render',
                module: './src/checkout.tsx',
                should_render: [{module: './src/conditions-a.tsx'}, {module: './src/conditions-b.tsx'}],
              },
            ],
          },
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {
            main: {moduleKey: 'module'},
            should_render: {moduleKey: 'should_render.module', optional: true},
          },
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests[0]!.build_manifest.assets).toEqual({
        main: {filepath: 'my-ext-checkout.render-main.js', module: './src/checkout.tsx'},
        should_render: [
          {filepath: 'my-ext-checkout.render-should_render-0.js', module: './src/conditions-a.tsx'},
          {filepath: 'my-ext-checkout.render-should_render-1.js', module: './src/conditions-b.tsx'},
        ],
      })
    })

    test('logs count and returns empty array when forEach tomlKey is not an array', async () => {
      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {main: {moduleKey: 'module'}},
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests).toEqual([])
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("No array found for forEach tomlKey 'extension_points'"),
      )
    })

    test('resolves module from item before falling back to top-level config', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            handle: 'my-ext',
            module: './src/fallback.tsx',
            extension_points: [
              {target: 'a', module: './src/a.tsx'},
              // no module on item → falls back to config
              {target: 'b'},
            ],
          },
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {main: {moduleKey: 'module'}},
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect((result.manifests[0]!.build_manifest.assets.main as ResolvedAsset).module).toBe('./src/a.tsx')
      expect((result.manifests[1]!.build_manifest.assets.main as ResolvedAsset).module).toBe('./src/fallback.tsx')
    })

    test('logs count in stdout on success', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            handle: 'my-ext',
            extension_points: [{target: 'a', module: './a.tsx'}],
          },
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {main: {moduleKey: 'module'}},
        },
      }

      await executeBuildManifestStep(step, mockContext)

      expect(mockStdout.write).toHaveBeenCalledWith('Build manifest written to build-manifest.json (1 entries)\n')
    })
  })

  // ── Output file ──────────────────────────────────────────────────────────

  describe('output file', () => {
    test('uses custom outputFile when specified', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', module: './src/index.tsx'},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {outputFile: 'manifest.json', assets: {main: {moduleKey: 'module'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.outputFile).toBe('/test/output/manifest.json')
      expect(fs.writeFile).toHaveBeenCalledWith('/test/output/manifest.json', expect.any(String))
    })

    test('uses parent dir of outputPath when outputPath has a file extension', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', module: './src/index.tsx'},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {moduleKey: 'module'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.outputFile).toBe('/test/output/build-manifest.json')
    })

    test('uses outputPath directly when it has no file extension', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          outputPath: '/test/bundle-dir',
          configuration: {handle: 'my-ext', module: './src/index.tsx'},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {moduleKey: 'module'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.outputFile).toBe('/test/bundle-dir/build-manifest.json')
    })

    test('logs manifest write to stdout', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', module: './src/index.tsx'},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {moduleKey: 'module'}}},
      }

      await executeBuildManifestStep(step, mockContext)

      expect(mockStdout.write).toHaveBeenCalledWith('Build manifest written to build-manifest.json\n')
    })

    test('writes the correct JSON content to disk', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', module: './src/index.tsx'},
        } as unknown as ExtensionInstance,
      }

      const step: ClientStep = {
        id: 'write-manifest',
        name: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {moduleKey: 'module'}}},
      }

      await executeBuildManifestStep(step, mockContext)

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/output/build-manifest.json',
        JSON.stringify({assets: {main: {filepath: 'my-ext-main.js', module: './src/index.tsx'}}}, null, 2),
      )
    })
  })
})
