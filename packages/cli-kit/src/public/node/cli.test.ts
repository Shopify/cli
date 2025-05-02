import {clearCache, runCLI, runCreateCLI, showMultipleCLIWarningIfNeeded} from './cli.js'
import {findUpAndReadPackageJson} from './node-package-manager.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {globalCLIVersion, localCLIVersion} from './version.js'
import {currentProcessIsGlobal} from './is-global.js'
import * as confStore from '../../private/node/conf-store.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./node-package-manager.js')
vi.mock('./version.js')
vi.mock('./is-global.js')

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
    const spy = vi.spyOn(confStore, 'cacheClear')
    clearCache()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('showMultipleCLIWarningIfNeeded', () => {
  beforeEach(() => {
    clearCache()
  })

  test('shows warning if using global CLI but app has local dependency', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(globalCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
    vi.mocked(localCLIVersion).mockResolvedValue('3.70.0')
    const mockOutput = mockAndCaptureOutput()

    // When
    await showMultipleCLIWarningIfNeeded('path', {'@shopify/cli': '3.70.0'})

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Two Shopify CLI installations found – using global installation             │
      │                                                                              │
      │  A global installation (v${CLI_KIT_VERSION}) and a local dependency (v3.70.0) were       │
      │  detected.                                                                   │
      │  We recommend removing the @shopify/cli and @shopify/app dependencies from   │
      │  your package.json, unless you want to use different versions across         │
      │  multiple apps.                                                              │
      │                                                                              │
      │  See Shopify CLI documentation. [1]                                          │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/build/cli-for-apps#switch-to-a-global-executab
      le-or-local-dependency
      "
    `)
    mockOutput.clear()
  })

  test('shows warning if using local CLI but app has global dependency', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
    vi.mocked(globalCLIVersion).mockResolvedValue('3.70.0')
    vi.mocked(localCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
    const mockOutput = mockAndCaptureOutput()

    // When
    await showMultipleCLIWarningIfNeeded('path', {'@shopify/cli': CLI_KIT_VERSION})

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Two Shopify CLI installations found – using local dependency                │
      │                                                                              │
      │  A global installation (v3.70.0) and a local dependency (v${CLI_KIT_VERSION}) were       │
      │  detected.                                                                   │
      │  We recommend removing the @shopify/cli and @shopify/app dependencies from   │
      │  your package.json, unless you want to use different versions across         │
      │  multiple apps.                                                              │
      │                                                                              │
      │  See Shopify CLI documentation. [1]                                          │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/build/cli-for-apps#switch-to-a-global-executab
      le-or-local-dependency
      "
    `)
    mockOutput.clear()
  })

  test('does not show two consecutive warnings', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(globalCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
    vi.mocked(localCLIVersion).mockResolvedValue('3.70.0')
    const mockOutput = mockAndCaptureOutput()

    // When
    await showMultipleCLIWarningIfNeeded('path', {'@shopify/cli': '3.70.0'})
    await showMultipleCLIWarningIfNeeded('path', {'@shopify/cli': '3.70.0'})

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Two Shopify CLI installations found – using global installation             │
      │                                                                              │
      │  A global installation (v${CLI_KIT_VERSION}) and a local dependency (v3.70.0) were       │
      │  detected.                                                                   │
      │  We recommend removing the @shopify/cli and @shopify/app dependencies from   │
      │  your package.json, unless you want to use different versions across         │
      │  multiple apps.                                                              │
      │                                                                              │
      │  See Shopify CLI documentation. [1]                                          │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/build/cli-for-apps#switch-to-a-global-executab
      le-or-local-dependency
      "
    `)
  })

  test('does not show a warning if there is no local dependency', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(globalCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
    vi.mocked(localCLIVersion).mockResolvedValue(undefined)
    const mockOutput = mockAndCaptureOutput()

    // When
    await showMultipleCLIWarningIfNeeded('path', {})

    // Then
    expect(mockOutput.warn()).toBe('')
    mockOutput.clear()
  })

  test('does not show a warning if there is no global dependency', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
    vi.mocked(globalCLIVersion).mockResolvedValue(undefined)
    vi.mocked(localCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
    const mockOutput = mockAndCaptureOutput()

    // When
    await showMultipleCLIWarningIfNeeded('path', {'@shopify/cli': CLI_KIT_VERSION})

    // Then
    expect(mockOutput.warn()).toBe('')
    mockOutput.clear()
  })
})
