import {bundleExtension} from './bundle.js'
import {testApp, testUIExtension} from '../../models/app/app.test-data.js'
import {getBundleExtensionStdIn} from '../dev/extension/bundler.js'
import {describe, expect, it, test, vi} from 'vitest'
import {build as esBuild, BuildOptions, WatchMode} from 'esbuild'
import {abort} from '@shopify/cli-kit'

vi.mock('esbuild', async () => {
  const esbuild: any = await vi.importActual('esbuild')
  return {
    ...esbuild,
    build: vi.fn(),
  }
})

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
      extensions: {
        ui: [extension],
        theme: [],
        function: [],
      },
    })
    vi.mocked(esBuild).mockResolvedValue(esbuildResultFixture())

    // When
    await bundleExtension({
      env: app.dotenv?.variables ?? {},
      outputBundlePath: extension.outputBundlePath,
      minify: true,
      environment: 'production',
      stdin: {
        contents: 'console.log("mock stdin content")',
        resolveDir: 'mock/resolve/dir',
        loader: 'tsx',
      },
      stdout,
      stderr,
    })

    // Then
    const call = vi.mocked(esBuild).mock.calls[0] as any
    expect(call).not.toBeUndefined()
    const options: BuildOptions = call[0]

    expect(options.bundle).toBeTruthy()
    expect(options.stdin).toStrictEqual({
      contents: 'console.log("mock stdin content")',
      resolveDir: 'mock/resolve/dir',
      loader: 'tsx',
    })
    expect(options.outfile).toEqual(extension.outputBundlePath)
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
    })
    expect(vi.mocked(stdout.write).calls[0][0]).toMatchInlineSnapshot(`
      "▲ [WARNING] [plugin plugin] warning text

      "
    `)
    expect(vi.mocked(stdout.write).calls[0][0]).toMatchInlineSnapshot(`
      "▲ [WARNING] [plugin plugin] warning text

      "
    `)
  })

  test('stops the ESBuild when the abort signal receives an event', async () => {
    // Given
    const extension = await testUIExtension()
    const app = testApp({
      directory: '/project',
      dotenv: {
        path: '/project/.env',
        variables: {
          FOO: 'BAR',
        },
      },
      extensions: {
        ui: [extension],
        theme: [],
        function: [],
      },
    })
    const stdout: any = {
      write: vi.fn(),
    }
    const stderr: any = {
      write: vi.fn(),
    }
    const esbuildStop: any = vi.fn()

    vi.mocked(esBuild).mockResolvedValue({
      errors: [],
      warnings: [],
      stop: esbuildStop,
    })
    const abortController = new abort.Controller()

    // When
    await bundleExtension({
      env: app.dotenv?.variables ?? {},
      outputBundlePath: extension.outputBundlePath,
      minify: true,
      environment: 'production',
      stdin: {
        contents: 'console.log("mock stdin content")',
        resolveDir: 'mock/resolve/dir',
        loader: 'tsx',
      },
      stdout,
      stderr,
      watchSignal: abortController.signal,
    })
    abortController.abort()

    // Then
    expect(esbuildStop).toHaveBeenCalled()
  })

  test('forwards and outputs watch events', async () => {
    // Given
    const extension = await testUIExtension()
    const app = testApp({
      directory: '/project',
      dotenv: {
        path: '/project/.env',
        variables: {
          FOO: 'BAR',
        },
      },
      extensions: {
        ui: [extension],
        theme: [],
        function: [],
      },
    })
    const stdout: any = {
      write: vi.fn(),
    }
    const stderr: any = {
      write: vi.fn(),
    }
    const watcher = vi.fn()

    // When
    await bundleExtension({
      env: app.dotenv?.variables ?? {},
      outputBundlePath: extension.outputBundlePath,
      minify: true,
      environment: 'production',
      stdin: {
        contents: 'console.log("mock stdin content")',
        resolveDir: 'mock/resolve/dir',
        loader: 'tsx',
      },
      stdout,
      stderr,
      watch: watcher,
    })

    // Then
    const call = vi.mocked(esBuild).mock.calls[0] as any
    expect(call).not.toBeUndefined()
    const options: BuildOptions = call[0]
    const onRebuild = (options.watch as any).onRebuild as NonNullable<WatchMode['onRebuild']>
    onRebuild(null, esbuildResultFixture())
    expect(vi.mocked(stdout.write).calls[0][0]).toMatchInlineSnapshot(`
      "▲ [WARNING] [plugin plugin] warning text

      "
    `)
    expect(vi.mocked(stdout.write).calls[0][0]).toMatchInlineSnapshot(`
      "▲ [WARNING] [plugin plugin] warning text

      "
    `)
  })

  function esbuildResultFixture() {
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
    }
  }
})

describe('getBundleExtensionStdIn()', () => {
  describe('if the extension is a ui_extension type', () => {
    it('imports each extension entryPoint module', async () => {
      const extension = await testUIExtension({
        directory: 'mock/directory',
        entrySourceFilePath: undefined,
        configuration: {
          name: 'name',
          type: 'ui_extension',
          metafields: [],
          extensionPoints: [
            {module: './src/mock1.js', target: 'MOCK::1'},
            {module: './src/mock2.js', target: 'MOCK::2'},
          ],
        },
      })

      const result = getBundleExtensionStdIn(extension)

      expect(result).toContain("import './src/mock1.js';")
      expect(result).toContain("import './src/mock2.js';")
    })
  })

  describe('if the extension is not a ui_extension type', () => {
    it('imports each the entrySourceFilePath', async () => {
      const extension = await testUIExtension({
        directory: 'mock/directory',
        entrySourceFilePath: 'mock/directory/src/mock1.js',
        configuration: {
          name: 'name',
          metafields: [],
          type: 'pos_ui_extension',
        },
      })

      const result = getBundleExtensionStdIn(extension)

      expect(result).toBe("import './src/mock1.js';")
    })
  })
})
