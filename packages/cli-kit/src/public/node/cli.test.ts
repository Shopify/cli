import {clearCache, runCLI, runCreateCLI} from './cli.js'
import {findUpAndReadPackageJson} from './node-package-manager.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {cacheClear} from '../../private/node/conf-store.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./node-package-manager.js')
vi.mock('../../private/node/conf-store.js')

describe('cli', () => {
  test('prepares to run the CLI', async () => {
    const launchCLI = vi.fn()
    await runCLI({moduleURL: 'test', development: false}, launchCLI)
    expect(launchCLI).toHaveBeenCalledWith({moduleURL: 'test'})
  })

  test('triggers no colour mode based on --no-color flag', async () => {
    const launchCLI = vi.fn()
    const env = {} as any
    await runCLI({moduleURL: 'test', development: false}, launchCLI, ['--no-color'], env)
    expect(env.FORCE_COLOR).toBe('0')
  })

  test('triggers no colour mode based on NO_COLOR environment variable', async () => {
    const launchCLI = vi.fn()
    const env = {NO_COLOR: 'TRUE'} as any
    await runCLI({moduleURL: 'test', development: false}, launchCLI, [], env)
    expect(env.FORCE_COLOR).toBe('0')
  })

  test('triggers no colour mode based on SHOPIFY_FLAG_NO_COLOR environment variable', async () => {
    const launchCLI = vi.fn()
    const env = {SHOPIFY_FLAG_NO_COLOR: 'TRUE'} as any
    await runCLI({moduleURL: 'test', development: false}, launchCLI, [], env)
    expect(env.FORCE_COLOR).toBe('0')
  })

  test('triggers no colour mode based on TERM environment variable', async () => {
    const launchCLI = vi.fn()
    const env = {TERM: 'dumb'} as any
    await runCLI({moduleURL: 'test', development: false}, launchCLI, [], env)
    expect(env.FORCE_COLOR).toBe('0')
  })

  test('triggers DEBUG based on --verbose flag', async () => {
    const launchCLI = vi.fn()
    const env = {} as any
    await runCLI({moduleURL: 'test', development: false}, launchCLI, ['--verbose'], env)
    expect(env.DEBUG).toBe('*')
  })

  test('triggers SHOPIFY_CLI_ENV based on running in development mode', async () => {
    const launchCLI = vi.fn()
    const env = {} as any
    await runCLI({moduleURL: 'test', development: true}, launchCLI, [], env)
    expect(env.SHOPIFY_CLI_ENV).toBe('development')
  })

  test('exits if running an old Node version', async () => {
    const launchCLI = vi.fn()
    const outputMock = mockAndCaptureOutput()
    const run = runCLI({moduleURL: 'test', development: false}, launchCLI, [], {}, {node: '17.9'} as any)
    await expect(run).rejects.toThrow()
    expect(outputMock.output()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Upgrade to a supported Node version now.                                    │
      │                                                                              │
      │  Node 17 has reached end-of-life and poses security risks. When you upgrade  │
      │   to a supported version [1], you'll be able to use Shopify CLI without      │
      │  interruption.                                                               │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://nodejs.dev/en/about/previous-releases
      "
    `)
  })

  test('changes process.argv when running create-x', async () => {
    const launchCLI = vi.fn()
    const argv = ['node', 'packages/create-app/bin/run.js', '--verbose']
    vi.mocked(findUpAndReadPackageJson).mockResolvedValue({content: {name: '@shopify/create-app'}} as any)
    await runCreateCLI({moduleURL: import.meta.url, development: false}, launchCLI, argv, {})
    expect(argv).toMatchInlineSnapshot(`
      [
        "node",
        "packages/create-app/bin/run.js",
        "init",
        "--verbose",
      ]
    `)
  })

  test('leaves process.argv unchanged if init is already present', async () => {
    const launchCLI = vi.fn()
    const argv = ['node', 'packages/create-app/bin/run.js', 'init', '--verbose']
    vi.mocked(findUpAndReadPackageJson).mockResolvedValue({content: {name: '@shopify/create-app'}} as any)
    await runCreateCLI({moduleURL: import.meta.url, development: false}, launchCLI, argv, {})
    expect(argv).toMatchInlineSnapshot(`
      [
        "node",
        "packages/create-app/bin/run.js",
        "init",
        "--verbose",
      ]
    `)
  })
})

describe('clearCache', () => {
  test('clears the cache', () => {
    clearCache()
    expect(cacheClear).toHaveBeenCalled()
  })
})
