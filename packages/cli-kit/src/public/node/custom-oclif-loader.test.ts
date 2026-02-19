import {ShopifyConfig} from './custom-oclif-loader.js'
import {isDevelopment} from './context/local.js'
import {fileExistsSync} from './fs.js'
import {cwd, joinPath, sniffForPath} from './path.js'
import {execaSync} from 'execa'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import type {Config as OclifConfig} from '@oclif/core'
import type {Options} from '@oclif/core/interfaces'

vi.mock('./context/local.js')
vi.mock('./fs.js')
vi.mock('./path.js')
vi.mock('execa')

// Provide a controllable base class so tests can inspect `plugins`, `_commands`,
// and whether `loadCommands` was invoked without depending on real oclif internals.
vi.mock('@oclif/core', () => {
  class Config {
    plugins = new Map<string, unknown>()
    _commands = new Map<string, unknown>()
    loadCommandsCalls: unknown[] = []

    constructor(_options: unknown) {}

    async load(): Promise<void> {}

    loadCommands(plugin: unknown): void {
      this.loadCommandsCalls.push(plugin)
    }
  }

  return {Config}
})

// Convenience type so tests can reach mock-only properties without ts-expect-error on every line.
type MockConfig = {
  plugins: Map<string, unknown>
  _commands: Map<string, unknown> | undefined
  loadCommandsCalls: unknown[]
}

function asMock(config: ShopifyConfig): MockConfig {
  return config as unknown as MockConfig
}

describe('ShopifyConfig', () => {
  beforeEach(() => {
    vi.mocked(isDevelopment).mockReturnValue(false)
    vi.mocked(cwd).mockReturnValue('/workspace')
    vi.mocked(sniffForPath).mockReturnValue(undefined)
    vi.mocked(joinPath).mockImplementation((...args: string[]) => args.join('/'))
    vi.mocked(fileExistsSync).mockReturnValue(false)
    delete process.env.IGNORE_HYDROGEN_MONOREPO
  })

  describe('constructor', () => {
    test('does not set pluginAdditions when not in dev mode', () => {
      const options = {root: '/workspace'} as Options
      new ShopifyConfig(options)
      expect((options as {pluginAdditions?: unknown}).pluginAdditions).toBeUndefined()
      expect(options.ignoreManifest).toBeUndefined()
    })

    test('sets pluginAdditions and ignoreManifest when package.json exists in dev mode', () => {
      vi.mocked(isDevelopment).mockReturnValue(true)
      vi.mocked(fileExistsSync).mockReturnValue(true)

      const options = {root: '/workspace'} as Options
      new ShopifyConfig(options)

      expect((options as {pluginAdditions?: unknown}).pluginAdditions).toEqual({
        core: ['@shopify/cli-hydrogen'],
        path: '/workspace',
      })
      expect(options.ignoreManifest).toBe(true)
    })

    test('does not set pluginAdditions when package.json is absent in dev mode', () => {
      vi.mocked(isDevelopment).mockReturnValue(true)
      vi.mocked(fileExistsSync).mockReturnValue(false)

      const options = {root: '/workspace'} as Options
      new ShopifyConfig(options)

      expect((options as {pluginAdditions?: unknown}).pluginAdditions).toBeUndefined()
    })

    test('uses sniffForPath result over cwd when available', () => {
      vi.mocked(isDevelopment).mockReturnValue(true)
      vi.mocked(sniffForPath).mockReturnValue('/sniffed/path')
      vi.mocked(fileExistsSync).mockReturnValue(true)

      const options = {root: '/workspace'} as Options
      new ShopifyConfig(options)

      expect((options as {pluginAdditions?: unknown}).pluginAdditions).toMatchObject({path: '/sniffed/path'})
    })

    test('runs npm prefix when cwd matches hydrogen monorepo pattern', () => {
      vi.mocked(isDevelopment).mockReturnValue(true)
      vi.mocked(cwd).mockReturnValue('/home/user/shopify/hydrogen/packages/cli')
      vi.mocked(execaSync).mockReturnValue({stdout: '/home/user/shopify/hydrogen'} as unknown as ReturnType<typeof execaSync>)
      vi.mocked(fileExistsSync).mockReturnValue(true)

      const options = {root: '/workspace'} as Options
      new ShopifyConfig(options)

      expect(execaSync).toHaveBeenCalledWith('npm', ['prefix'])
      expect((options as {pluginAdditions?: unknown}).pluginAdditions).toMatchObject({path: '/home/user/shopify/hydrogen'})
    })

    test('also matches hydrogen/hydrogen CI path pattern', () => {
      vi.mocked(isDevelopment).mockReturnValue(true)
      vi.mocked(cwd).mockReturnValue('/runner/hydrogen/hydrogen/packages/cli')
      vi.mocked(execaSync).mockReturnValue({stdout: '/runner/hydrogen/hydrogen'} as unknown as ReturnType<typeof execaSync>)
      vi.mocked(fileExistsSync).mockReturnValue(true)

      new ShopifyConfig({root: '/workspace'} as Options)

      expect(execaSync).toHaveBeenCalledWith('npm', ['prefix'])
    })

    test('skips npm prefix when IGNORE_HYDROGEN_MONOREPO is set', () => {
      vi.mocked(isDevelopment).mockReturnValue(true)
      vi.mocked(cwd).mockReturnValue('/home/user/shopify/hydrogen/packages/cli')
      vi.mocked(fileExistsSync).mockReturnValue(true)
      process.env.IGNORE_HYDROGEN_MONOREPO = '1'

      new ShopifyConfig({root: '/workspace'} as Options)

      expect(execaSync).not.toHaveBeenCalled()
    })
  })

  describe('load()', () => {
    test('does not replace commands when not in dev mode', async () => {
      vi.mocked(isDevelopment).mockReturnValue(false)

      const config = new ShopifyConfig({root: '/workspace'} as Options)
      const hydrogenPlugin = {name: '@shopify/cli-hydrogen', isRoot: false, commands: [{id: 'hydrogen:dev', aliases: [], hiddenAliases: []}]}
      asMock(config).plugins.set('@shopify/cli-hydrogen', hydrogenPlugin)
      asMock(config)._commands!.set('hydrogen:dev', {bundled: true})

      await config.load()

      expect(asMock(config)._commands!.has('hydrogen:dev')).toBe(true)
      expect(asMock(config).loadCommandsCalls).toHaveLength(0)
    })

    test('does not replace commands when no external hydrogen plugin is present', async () => {
      vi.mocked(isDevelopment).mockReturnValue(true)

      const config = new ShopifyConfig({root: '/workspace'} as Options)
      asMock(config)._commands!.set('hydrogen:dev', {bundled: true})

      await config.load()

      expect(asMock(config)._commands!.has('hydrogen:dev')).toBe(true)
      expect(asMock(config).loadCommandsCalls).toHaveLength(0)
    })

    test('does not replace commands when the hydrogen plugin is the root plugin', async () => {
      vi.mocked(isDevelopment).mockReturnValue(true)

      const config = new ShopifyConfig({root: '/workspace'} as Options)
      asMock(config).plugins.set('@shopify/cli-hydrogen', {name: '@shopify/cli-hydrogen', isRoot: true, commands: []})
      asMock(config)._commands!.set('hydrogen:dev', {bundled: true})

      await config.load()

      expect(asMock(config)._commands!.has('hydrogen:dev')).toBe(true)
      expect(asMock(config).loadCommandsCalls).toHaveLength(0)
    })

    test('removes bundled hydrogen commands and reloads from external plugin', async () => {
      vi.mocked(isDevelopment).mockReturnValue(true)

      const config = new ShopifyConfig({root: '/workspace'} as Options)
      const externalPlugin = {
        name: '@shopify/cli-hydrogen',
        isRoot: false,
        commands: [
          {id: 'hydrogen:dev', aliases: ['h:dev'], hiddenAliases: ['hydrogen:develop']},
          {id: 'hydrogen:build', aliases: [], hiddenAliases: undefined},
        ],
      }
      asMock(config).plugins.set('@shopify/cli-hydrogen', externalPlugin)

      // Populate _commands with bundled versions of hydrogen commands plus an unrelated one
      asMock(config)._commands!.set('hydrogen:dev', {bundled: true})
      asMock(config)._commands!.set('h:dev', {bundled: true})
      asMock(config)._commands!.set('hydrogen:develop', {bundled: true})
      asMock(config)._commands!.set('hydrogen:build', {bundled: true})
      asMock(config)._commands!.set('app:dev', {bundled: true})

      await config.load()

      // All bundled hydrogen entries (canonical + aliases + hidden aliases) are gone
      expect(asMock(config)._commands!.has('hydrogen:dev')).toBe(false)
      expect(asMock(config)._commands!.has('h:dev')).toBe(false)
      expect(asMock(config)._commands!.has('hydrogen:develop')).toBe(false)
      expect(asMock(config)._commands!.has('hydrogen:build')).toBe(false)

      // Non-hydrogen commands are untouched
      expect(asMock(config)._commands!.has('app:dev')).toBe(true)

      // loadCommands is called exactly once with the external plugin
      expect(asMock(config).loadCommandsCalls).toHaveLength(1)
      expect(asMock(config).loadCommandsCalls[0]).toBe(externalPlugin)
    })

    test('only removes commands whose id starts with "hydrogen"', async () => {
      vi.mocked(isDevelopment).mockReturnValue(true)

      const config = new ShopifyConfig({root: '/workspace'} as Options)
      const externalPlugin = {
        name: '@shopify/cli-hydrogen',
        isRoot: false,
        // A non-hydrogen-prefixed command shipped by the hydrogen plugin
        commands: [{id: 'app:generate:route', aliases: [], hiddenAliases: []}],
      }
      asMock(config).plugins.set('@shopify/cli-hydrogen', externalPlugin)
      asMock(config)._commands!.set('app:generate:route', {bundled: true})

      await config.load()

      // The command is not hydrogen-prefixed so it must not be removed
      expect(asMock(config)._commands!.has('app:generate:route')).toBe(true)
    })

    test('throws a descriptive error when _commands is unavailable, catching future oclif API changes', async () => {
      vi.mocked(isDevelopment).mockReturnValue(true)

      const config = new ShopifyConfig({root: '/workspace'} as Options)
      asMock(config).plugins.set('@shopify/cli-hydrogen', {
        name: '@shopify/cli-hydrogen',
        isRoot: false,
        commands: [],
      })

      // Simulate oclif removing the private _commands property
      asMock(config)._commands = undefined

      await expect(config.load()).rejects.toThrow(
        'ShopifyConfig: oclif internals changed. _commands is no longer available.',
      )
    })
  })

  // These tests use the REAL @oclif/core (via vi.importActual) so they will fail
  // if oclif removes or renames the private APIs that ShopifyConfig depends on.
  // The mock above intentionally replaces oclif for logic isolation; this block
  // provides the missing contract check against the installed package version.
  describe('oclif API contract', () => {
    test('Config still has a loadCommands method on its prototype', async () => {
      const {Config: RealConfig} = await vi.importActual<typeof import('@oclif/core')>('@oclif/core')

      // ShopifyConfig calls this.loadCommands(plugin) via @ts-expect-error.
      // If oclif removes or renames this method, this assertion will catch it.
      expect(typeof (RealConfig as unknown as {prototype: Record<string, unknown>}).prototype.loadCommands).toBe(
        'function',
      )
    })

    test('Config instances still have a _commands own property after construction', async () => {
      const {Config: RealConfig} = await vi.importActual<typeof import('@oclif/core')>('@oclif/core')

      // _commands is a class field initialized in the constructor, so it appears as an
      // own property on every instance even before load() is called.
      // ShopifyConfig reads and mutates this._commands as a Map — if oclif renames or
      // restructures it, this assertion will fail.
      const instance = new (RealConfig as new (options: {root: string}) => OclifConfig)({root: process.cwd()})
      expect(Object.prototype.hasOwnProperty.call(instance, '_commands')).toBe(true)
    })
  })
})
