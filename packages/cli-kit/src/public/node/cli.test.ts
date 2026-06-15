import {clearCache, runCLI, runCreateCLI, portFlag} from './cli.js'
import {findUpAndReadPackageJson} from './node-package-manager.js'
import {mockAndCaptureOutput} from './testing/output.js'
import * as confStore from '../../private/node/conf-store.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./node-package-manager.js')

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

  test('triggers no colour mode based on --json flag', async () => {
    const launchCLI = vi.fn()
    const env = {} as any
    await runCLI({moduleURL: 'test', development: false}, launchCLI, ['--json'], env)
    expect(env.FORCE_COLOR).toBe('0')
  })

  test('triggers no colour mode based on -j flag', async () => {
    const launchCLI = vi.fn()
    const env = {} as any
    await runCLI({moduleURL: 'test', development: false}, launchCLI, ['-j'], env)
    expect(env.FORCE_COLOR).toBe('0')
  })

  test('triggers no colour mode based on SHOPIFY_FLAG_JSON environment variable', async () => {
    const launchCLI = vi.fn()
    const env = {SHOPIFY_FLAG_JSON: 'TRUE'} as any
    await runCLI({moduleURL: 'test', development: false}, launchCLI, [], env)
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
  test('clears the cache', async () => {
    const spy = vi.spyOn(confStore, 'cacheClear')
    await clearCache()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('portFlag', () => {
  const flag = portFlag()
  test('parses a valid port to a number', async () => {
    await expect(flag.parse('9292', {} as any, flag as any)).resolves.toBe(9292)
  })
  test.each(['13245574', '65536', '0', '-1', 'abc', '92.5', '', '0x10', '1e2', ' 9293 ', '+9292'])(
    'rejects invalid port %s',
    async (input) => {
      await expect(flag.parse(input, {} as any, flag as any)).rejects.toThrowError(/Expected an integer/)
    },
  )
})
