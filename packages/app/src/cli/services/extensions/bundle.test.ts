import {bundleExtension, bundleThemeExtension, copyFilesForExtension} from './bundle.js'
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
    const esbuildRebuild = vi.fn(esbuildResultFixture)

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
    const esbuildRebuild = vi.fn(esbuildResultFixture)

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

  async function esbuildResultFixture() {
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

describe('copyFilesForExtension()', () => {
  test('copies files matching include patterns to output directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const outputDir = joinPath(tmpDir, 'output')

      // Create extension directory structure
      await mkdir(joinPath(extensionDir, 'src'))
      await mkdir(joinPath(extensionDir, 'assets'))
      await mkdir(joinPath(extensionDir, 'assets', 'images'))

      // Create test files
      touchFileSync(joinPath(extensionDir, 'config.json'))
      touchFileSync(joinPath(extensionDir, 'src', 'index.js'))
      touchFileSync(joinPath(extensionDir, 'src', 'styles.css'))
      touchFileSync(joinPath(extensionDir, 'assets', 'logo.png'))
      touchFileSync(joinPath(extensionDir, 'assets', 'images', 'banner.jpg'))

      const extension = {
        directory: extensionDir,
        outputPath: outputDir,
        localIdentifier: 'test-extension',
      } as ExtensionInstance

      const stdout = {write: vi.fn()}
      const stderr = {write: vi.fn()}
      const options = {stdout, stderr} as any

      // When - copy all .json and .png files
      await copyFilesForExtension(extension, options, ['*.json', '*.png'], [])

      // Then
      const copiedFiles = await glob(joinPath(outputDir, '**/*'))
      const relativeFiles = copiedFiles.map((file) => file.replace(`${outputDir}/`, ''))

      expect(relativeFiles.sort()).toEqual(['assets/logo.png', 'config.json'])
      expect(stdout.write).toHaveBeenCalledWith('Copying files for extension test-extension...')
      expect(stdout.write).toHaveBeenCalledWith('test-extension successfully built')
    })
  })

  test('respects ignore patterns when copying files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const outputDir = joinPath(tmpDir, 'output')

      // Create extension directory structure
      await mkdir(joinPath(extensionDir, 'dist'))
      await mkdir(joinPath(extensionDir, 'src'))
      await mkdir(joinPath(extensionDir, 'test'))

      // Create test files
      touchFileSync(joinPath(extensionDir, 'README.md'))
      touchFileSync(joinPath(extensionDir, 'package.json'))
      touchFileSync(joinPath(extensionDir, 'dist', 'bundle.js'))
      touchFileSync(joinPath(extensionDir, 'src', 'index.js'))
      touchFileSync(joinPath(extensionDir, 'test', 'test.js'))
      touchFileSync(joinPath(extensionDir, 'test', 'README.md'))

      const extension = {
        directory: extensionDir,
        outputPath: outputDir,
        localIdentifier: 'test-extension',
      } as ExtensionInstance

      const stdout = {write: vi.fn()}
      const stderr = {write: vi.fn()}
      const options = {stdout, stderr} as any

      // When - copy all files but ignore test directory and dist files
      await copyFilesForExtension(extension, options, ['*'], ['test/**', 'dist/**'])

      // Then
      const copiedFiles = await glob(joinPath(outputDir, '**/*'))
      const relativeFiles = copiedFiles.map((file) => file.replace(`${outputDir}/`, ''))

      expect(relativeFiles.sort()).toEqual(['README.md', 'package.json', 'src/index.js'])
      // Verify ignored files were not copied
      expect(relativeFiles).not.toContain('test/test.js')
      expect(relativeFiles).not.toContain('test/README.md')
      expect(relativeFiles).not.toContain('dist/bundle.js')
    })
  })

  test('handles empty include patterns gracefully', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const outputDir = joinPath(tmpDir, 'output')

      await mkdir(extensionDir)
      touchFileSync(joinPath(extensionDir, 'file.txt'))

      const extension = {
        directory: extensionDir,
        outputPath: outputDir,
        localIdentifier: 'test-extension',
      } as ExtensionInstance

      const stdout = {write: vi.fn()}
      const stderr = {write: vi.fn()}
      const options = {stdout, stderr} as any

      // When - no include patterns provided
      await copyFilesForExtension(extension, options, [], [])

      // Then - no files should be copied
      const copiedFiles = await glob(joinPath(outputDir, '**/*'))
      expect(copiedFiles).toEqual([])
    })
  })
})
