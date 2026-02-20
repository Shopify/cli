import {executeBuildManifestStep, ResolvedAsset, ResolvedAssets, PerItemManifest} from './build-manifest-step.js'
import {BuildStep, BuildContext} from '../build-steps.js'
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
      configuration: {},
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

  describe('literal asset entries', () => {
    test('writes a manifest JSON with literal filepath asset', async () => {
      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {filepath: 'index.html'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/output/build-manifest.json',
        JSON.stringify({assets: {main: {filepath: 'index.html'}}}, null, 2),
      )
      expect(result.assets).toEqual({main: {filepath: 'index.html'}})
      expect(result.outputFile).toBe('/test/output/build-manifest.json')
    })

    test('includes static flag when provided', async () => {
      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {tools: {filepath: 'tools.json', static: true}}},
      }

      await executeBuildManifestStep(step, mockContext)

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/output/build-manifest.json',
        JSON.stringify({assets: {tools: {filepath: 'tools.json', static: true}}}, null, 2),
      )
    })

    test('includes module when provided', async () => {
      mockContext = {
        ...mockContext,
        extension: {...mockExtension, configuration: {entry: './src/index.ts'}} as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {filepath: 'dist/index.js', module: {tomlKey: 'entry'}}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets).toEqual({main: {filepath: 'dist/index.js', module: './src/index.ts'}})
    })

    test('uses custom outputFile when specified', async () => {
      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {outputFile: 'manifest.json', assets: {main: {filepath: 'index.js'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.outputFile).toBe('/test/output/manifest.json')
      expect(fs.writeFile).toHaveBeenCalledWith('/test/output/manifest.json', expect.any(String))
    })
  })

  describe('tomlKey asset entries (shorthand)', () => {
    test('resolves filepath from tomlKey in extension configuration', async () => {
      mockContext = {
        ...mockContext,
        extension: {...mockExtension, configuration: {static_root: 'public'}} as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {tomlKey: 'static_root'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets).toEqual({main: {filepath: 'public'}})
    })

    test('skips asset and logs when tomlKey is absent', async () => {
      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {tomlKey: 'missing_key'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets).toEqual({})
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("No value for tomlKey 'missing_key' in asset 'main'"),
      )
    })

    test('includes static flag from tomlKey entry', async () => {
      mockContext = {
        ...mockContext,
        extension: {...mockExtension, configuration: {tools_file: 'tools.json'}} as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {tools: {tomlKey: 'tools_file', static: true}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets).toEqual({tools: {filepath: 'tools.json', static: true}})
    })
  })

  describe('composed filepath', () => {
    test('builds filepath from tomlKey prefix + filename', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {handle: 'my-ext', entry: './src/index.tsx'},
        } as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          assets: {
            main: {filepath: {prefix: {tomlKey: 'handle'}, filename: '.js'}, module: {tomlKey: 'entry'}},
          },
        },
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets.main).toEqual({filepath: 'my-ext.js', module: './src/index.tsx'})
    })

    test('prepends path directory when provided', async () => {
      mockContext = {
        ...mockContext,
        extension: {...mockExtension, configuration: {handle: 'my-ext'}} as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          assets: {
            main: {filepath: {path: 'dist', prefix: {tomlKey: 'handle'}, filename: '.js'}},
          },
        },
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets.main?.filepath).toBe('dist/my-ext.js')
    })

    test('skips asset and logs when prefix tomlKey is absent', async () => {
      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          assets: {
            main: {filepath: {prefix: {tomlKey: 'handle'}, filename: '.js'}},
          },
        },
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets).toEqual({})
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("Could not resolve filepath for asset 'main'"))
    })

    test('uses literal string prefix', async () => {
      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          assets: {
            main: {filepath: {prefix: 'static', filename: '-bundle.js'}},
          },
        },
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets.main?.filepath).toBe('static-bundle.js')
    })
  })

  describe('optional assets', () => {
    test('silently skips optional asset when filepath cannot be resolved', async () => {
      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          assets: {
            main: {filepath: 'index.js'},
            should_render: {filepath: {prefix: {tomlKey: 'handle'}, filename: '-conditions.js'}, optional: true},
          },
        },
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.assets).toEqual({main: {filepath: 'index.js'}})
      expect(mockStdout.write).not.toHaveBeenCalledWith(expect.stringContaining('should_render'))
    })

    test('silently skips optional asset when module tomlKey is absent in item', async () => {
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

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {
            main: {
              filepath: {prefix: {tomlKey: 'handle'}, filename: '.js'},
              module: {tomlKey: 'module'},
            },
            should_render: {
              filepath: {prefix: {tomlKey: 'handle'}, filename: '-conditions.js'},
              module: {tomlKey: 'should_render.module'},
              optional: true,
            },
          },
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests[0]!.build_manifest.assets).toEqual({
        main: {filepath: 'my-ext.js', module: './src/index.tsx'},
      })
    })
  })

  describe('forEach — per-target iteration', () => {
    test('produces one manifest per item in the iterated array', async () => {
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

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {
            main: {
              filepath: {prefix: {tomlKey: 'handle'}, filename: '.js'},
              module: {tomlKey: 'module'},
            },
          },
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests).toHaveLength(2)
      expect(result.manifests[0]).toEqual({
        target: 'purchase.checkout.block.render',
        build_manifest: {assets: {main: {filepath: 'my-ext.js', module: './src/checkout.tsx'}}},
      })
      expect(result.manifests[1]).toEqual({
        target: 'admin.product-details.action.render',
        build_manifest: {assets: {main: {filepath: 'my-ext.js', module: './src/admin.tsx'}}},
      })
    })

    test('mirrors UIExtensionSchema shape with should_render and static tools', async () => {
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

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {
            main: {
              filepath: {prefix: {tomlKey: 'handle'}, filename: '.js'},
              module: {tomlKey: 'module'},
            },
            should_render: {
              filepath: {prefix: {tomlKey: 'handle'}, filename: '-conditions.js'},
              module: {tomlKey: 'should_render.module'},
              optional: true,
            },
            tools: {
              filepath: {prefix: {tomlKey: 'handle'}, filename: '-tools.json'},
              module: {tomlKey: 'tools'},
              static: true,
              optional: true,
            },
          },
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests[0]!.build_manifest.assets).toEqual({
        main: {filepath: 'my-ext.js', module: './src/checkout.tsx'},
        should_render: {filepath: 'my-ext-conditions.js', module: './src/conditions.tsx'},
        tools: {filepath: 'my-ext-tools.json', module: './src/tools.json', static: true},
      })
    })

    test('indexes into config-level nested arrays using the outer iteration index', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extension_points: [
              {target: 'checkout.render', module: './src/checkout.tsx'},
              {target: 'admin.render', module: './src/admin.tsx'},
            ],
          },
        } as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {
            main: {
              // Both prefix and module go through the config-level array → outer index used
              filepath: {prefix: {tomlKey: 'extension_points.target'}, filename: '.js'},
              module: {tomlKey: 'extension_points.module'},
            },
          },
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests[0]!.build_manifest.assets.main).toEqual({
        filepath: 'checkout.render.js',
        module: './src/checkout.tsx',
      })
      expect(result.manifests[1]!.build_manifest.assets.main).toEqual({
        filepath: 'admin.render.js',
        module: './src/admin.tsx',
      })
    })

    test('expands assets when item tomlKey resolves to an inner array', async () => {
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
                should_render: [
                  {module: './src/conditions-a.tsx'},
                  {module: './src/conditions-b.tsx'},
                ],
              },
            ],
          },
        } as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {
            main: {
              filepath: {prefix: {tomlKey: 'handle'}, filename: '.js'},
              module: {tomlKey: 'module'},
            },
            should_render: {
              filepath: {prefix: {tomlKey: 'handle'}, filename: '-conditions.js'},
              module: {tomlKey: 'should_render.module'},
              optional: true,
            },
          },
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests[0]!.build_manifest.assets).toEqual({
        main: {filepath: 'my-ext.js', module: './src/checkout.tsx'},
        should_render: [
          {filepath: 'my-ext-0-conditions.js', module: './src/conditions-a.tsx'},
          {filepath: 'my-ext-1-conditions.js', module: './src/conditions-b.tsx'},
        ],
      })
    })

    test('logs count and returns empty array when forEach tomlKey is not an array', async () => {
      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {main: {filepath: 'index.js'}},
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests).toEqual([])
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("No array found for forEach tomlKey 'extension_points'"),
      )
    })

    test('uses iteration index as prefix when prefix tomlKey resolves to an array', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {
            extension_points: [{target: 'a', module: './a.tsx'}, {target: 'b', module: './b.tsx'}],
          },
        } as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {
            main: {
              // tomlKey resolves to the array itself → use index as prefix
              filepath: {prefix: {tomlKey: 'extension_points'}, filename: '.js'},
              module: {tomlKey: 'module'},
            },
          },
        },
      }

      const result = asForEach(await executeBuildManifestStep(step, mockContext))

      expect(result.manifests[0]!.build_manifest.assets.main?.filepath).toBe('0.js')
      expect(result.manifests[1]!.build_manifest.assets.main?.filepath).toBe('1.js')
    })

    test('logs count in stdout on success', async () => {
      mockContext = {
        ...mockContext,
        extension: {
          ...mockExtension,
          configuration: {extension_points: [{target: 'a', module: './a.tsx'}]},
        } as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {
          forEach: {tomlKey: 'extension_points', keyBy: 'target'},
          assets: {main: {filepath: 'index.js'}},
        },
      }

      await executeBuildManifestStep(step, mockContext)

      expect(mockStdout.write).toHaveBeenCalledWith('Build manifest written to build-manifest.json (1 entries)\n')
    })
  })

  describe('logging', () => {
    test('logs manifest write to stdout', async () => {
      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {filepath: 'index.js'}}},
      }

      await executeBuildManifestStep(step, mockContext)

      expect(mockStdout.write).toHaveBeenCalledWith('Build manifest written to build-manifest.json\n')
    })
  })

  describe('output directory resolution', () => {
    test('uses parent dir of outputPath when outputPath has a file extension', async () => {
      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {filepath: 'index.js'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.outputFile).toBe('/test/output/build-manifest.json')
    })

    test('uses outputPath directly when it has no file extension', async () => {
      mockContext = {
        ...mockContext,
        extension: {...mockExtension, outputPath: '/test/bundle-dir'} as unknown as ExtensionInstance,
      }

      const step: BuildStep = {
        id: 'write-manifest',
        displayName: 'Write Manifest',
        type: 'build_manifest',
        config: {assets: {main: {filepath: 'index.js'}}},
      }

      const result = asSingle(await executeBuildManifestStep(step, mockContext))

      expect(result.outputFile).toBe('/test/bundle-dir/build-manifest.json')
    })
  })
})
