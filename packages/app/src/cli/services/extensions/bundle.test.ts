import {bundleExtension, bundleThemeExtension} from './bundle.js'
import {testApp, testUIExtension} from '../../models/app/app.test-data.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {describe, expect, test, vi} from 'vitest'
import {context as esContext} from 'esbuild'
import {glob, inTemporaryDirectory, mkdir, touchFileSync} from '@shopify/cli-kit/node/fs'
import {basename, joinPath} from '@shopify/cli-kit/node/path'

vi.mock('esbuild', async () => {
  const esbuild: any = await vi.importActual('esbuild')
  return {
    ...esbuild,
    context: vi.fn(),
  }
})

vi.mock('@luckycatfactory/esbuild-graphql-loader', () => ({
  default: {
    default: () => {
      return {name: 'graphql-loader', setup: vi.fn()}
    },
  },
}))

describe('bundleExtension()', () => {
  test('invokes ESBuild with the right options and forwards the logs', async () => {
    // Given
    const extension = await testUIExtension()
    const stdout: any = {
      write: vi.fn(),
    }
    const stderr: any = {
      write: vi.fn(),
    }
    const app = testApp({
      directory: '/project',
      dotenv: {
        path: '/project/.env',
        variables: {
          FOO: 'BAR',
        },
      },
      allExtensions: [extension],
    })
    const esbuildWatch = vi.fn()
    const esbuildDispose = vi.fn()
    const esbuildRebuild = vi.fn(esbuildSuccessResultFixture)

    vi.mocked(esContext).mockResolvedValue({
      rebuild: esbuildRebuild,
      watch: esbuildWatch,
      dispose: esbuildDispose,
      cancel: vi.fn(),
      serve: vi.fn(),
    })

    // When
    await bundleExtension(
      {
        env: app.dotenv?.variables ?? {},
        outputPath: extension.outputPath,
        minify: true,
        environment: 'production',
        stdin: {
          contents: 'console.log("mock stdin content")',
          resolveDir: 'mock/resolve/dir',
          loader: 'tsx',
        },
        stdout,
        stderr,
      },
      {VAR_FROM_RUNTIME: 'runtime_var', 'INVALID(VAR)': 'invalid_var', '123NUMERIC_VAR': 'invalid_var'},
    )

    // Then
    const call = vi.mocked(esContext).mock.calls[0]!
    expect(call).not.toBeUndefined()
    const options = call[0]

    expect(esbuildWatch).not.toHaveBeenCalled()
    expect(esbuildDispose).toHaveBeenCalledOnce()
    expect(esbuildRebuild).toHaveBeenCalledOnce()

    expect(options.bundle).toBeTruthy()
    expect(options.stdin).toStrictEqual({
      contents: 'console.log("mock stdin content")',
      resolveDir: 'mock/resolve/dir',
      loader: 'tsx',
    })
    expect(options.outfile).toEqual(extension.outputPath)
    expect(options.loader).toEqual({
      '.esnext': 'ts',
      '.js': 'jsx',
    })
    expect(options.legalComments).toEqual('none')
    expect(options.minify).toBeTruthy()
    expect(options.target).toEqual('es6')
    expect(options.jsx).toEqual('automatic')
    expect(options.resolveExtensions).toEqual(['.tsx', '.ts', '.js', '.json', '.esnext', '.mjs', '.ejs'])
    expect(options.define).toEqual({
      'process.env.FOO': JSON.stringify('BAR'),
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.VAR_FROM_RUNTIME': JSON.stringify('runtime_var'),
    })
    expect(vi.mocked(stdout.write).mock.calls[0][0]).toMatchInlineSnapshot(`
      "▲ [WARNING] warning text [plugin plugin]

      "
    `)
    expect(vi.mocked(stdout.write).mock.calls[0][0]).toMatchInlineSnapshot(`
      "▲ [WARNING] warning text [plugin plugin]

      "
    `)
    const plugins = options.plugins?.map(({name}) => name)
    expect(plugins).toContain('graphql-loader')
    expect(plugins).toContain('shopify:deduplicate-react')
  })

  test('can switch off React deduplication', async () => {
    // Given
    const extension = await testUIExtension()
    const stdout: any = {
      write: vi.fn(),
    }
    const stderr: any = {
      write: vi.fn(),
    }
    const app = testApp({
      directory: '/project',
      dotenv: {
        path: '/project/.env',
        variables: {
          FOO: 'BAR',
        },
      },
      allExtensions: [extension],
    })
    const esbuildWatch = vi.fn()
    const esbuildDispose = vi.fn()
    const esbuildRebuild = vi.fn(esbuildSuccessResultFixture)

    vi.mocked(esContext).mockResolvedValue({
      rebuild: esbuildRebuild,
      watch: esbuildWatch,
      dispose: esbuildDispose,
      cancel: vi.fn(),
      serve: vi.fn(),
    })

    // When
    await bundleExtension(
      {
        env: app.dotenv?.variables ?? {},
        outputPath: extension.outputPath,
        minify: true,
        environment: 'production',
        stdin: {
          contents: 'console.log("mock stdin content")',
          resolveDir: 'mock/resolve/dir',
          loader: 'tsx',
        },
        stdout,
        stderr,
      },
      {
        ...process.env,
        SHOPIFY_CLI_SKIP_ESBUILD_REACT_DEDUPLICATION: 'true',
      },
    )

    // Then
    const call = vi.mocked(esContext).mock.calls[0]!
    expect(call).not.toBeUndefined()
    const options = call[0]

    const plugins = options.plugins?.map(({name}) => name)
    expect(plugins).not.toContain('shopify:deduplicate-react')
  })

  test('throws error when bundling fails and displays formatted errors', async () => {
    // Given
    const extension = await testUIExtension()
    const stdout: any = {
      write: vi.fn(),
    }
    const stderr: any = {
      write: vi.fn(),
    }
    const app = testApp({
      directory: '/project',
      allExtensions: [extension],
    })
    const esbuildWatch = vi.fn()
    const esbuildDispose = vi.fn()
    const esbuildRebuild = vi.fn(esbuildErrorResultFixture)

    vi.mocked(esContext).mockResolvedValue({
      rebuild: esbuildRebuild,
      watch: esbuildWatch,
      dispose: esbuildDispose,
      cancel: vi.fn(),
      serve: vi.fn(),
    })

    // When/Then
    await expect(
      bundleExtension({
        env: {},
        outputPath: extension.outputPath,
        minify: true,
        environment: 'production',
        stdin: {
          contents: 'console.log("mock stdin content")',
          resolveDir: 'mock/resolve/dir',
          loader: 'tsx',
        },
        stdout,
        stderr,
      }),
    ).rejects.toThrow('ESBuild bundling failed')

    // Verify errors were written to stderr
    const errorOutput = vi.mocked(stderr.write).mock.calls[0][0] as string
    expect(errorOutput).toMatch(/[✘X] \[ERROR\] error text \[plugin plugin\]/)
  })

  async function esbuildSuccessResultFixture() {
    return {
      errors: [],
      warnings: [
        {
          id: 'warning',
          pluginName: 'plugin',
          text: 'warning text',
          location: null,
          notes: [],
          detail: {},
        },
      ],
      outputFiles: [],
      metafile: {
        inputs: {},
        outputs: {},
      },
      mangleCache: {},
    }
  }

  async function esbuildErrorResultFixture() {
    return {
      errors: [
        {
          id: 'error',
          pluginName: 'plugin',
          text: 'error text',
          location: null,
          notes: [],
          detail: {},
        },
      ],
      warnings: [],
      outputFiles: [],
      metafile: {
        inputs: {},
        outputs: {},
      },
      mangleCache: {},
    }
  }
  describe('bundleThemeExtension()', () => {
    test('should skip all ignored file patterns', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const allSpecs = await loadLocalExtensionsSpecifications()
        const specification = allSpecs.find((spec) => spec.identifier === 'theme')!
        const themeExtension = new ExtensionInstance({
          configuration: {
            name: 'theme extension name',
            type: 'theme' as const,
            metafields: [],
          },
          configurationPath: '',
          directory: tmpDir,
          specification,
        })

        const outputPath = joinPath(tmpDir, 'dist')
        await mkdir(outputPath)
        themeExtension.outputPath = outputPath

        const app = testApp({
          directory: '/project',
          dotenv: {
            path: '/project/.env',
            variables: {
              FOO: 'BAR',
            },
          },
          allExtensions: [themeExtension],
        })

        const stdout: any = {
          write: vi.fn(),
        }
        const stderr: any = {
          write: vi.fn(),
        }

        const blocksPath = joinPath(tmpDir, 'blocks')
        await mkdir(blocksPath)

        const ignoredFiles = ['.gitkeep', '.DS_Store', '.shopify.theme.extension.toml']
        await Promise.all(
          ['test.liquid', ...ignoredFiles].map(async (filename) => {
            touchFileSync(joinPath(blocksPath, filename))
            touchFileSync(joinPath(tmpDir, filename))
          }),
        )

        // When
        await bundleThemeExtension(themeExtension, {
          app,
          stdout,
          stderr,
          environment: 'production',
        })

        // Then
        const filePaths = await glob(joinPath(themeExtension.outputPath, '/**/*'))
        const hasFiles = filePaths
          .map((filePath) => basename(filePath))
          .some((filename) => ignoredFiles.includes(filename))
        expect(hasFiles).toEqual(false)
      })
    })
  })
})
