import {bundleExtension} from './bundle.js'
import {testApp, testUIExtension} from '../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import {build as esBuild, BuildOptions, WatchMode} from 'esbuild'
import {AbortController} from '@shopify/cli-kit/node/abort'

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
        configurations: [],
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
    const plugins = options.plugins?.map(({name}) => name)
    expect(plugins).toContain('graphql-loader')
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
        configurations: [],
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
    const abortController = new AbortController()

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
        configurations: [],
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
