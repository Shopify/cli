import {ShopifyConfig} from './custom-oclif-loader.js'
import {fileExistsSync, readFileSync} from './fs.js'
import {cwd, joinPath, sniffForPath} from './path.js'
import {outputDebug} from './output.js'
import {execaSync} from 'execa'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./fs.js')
vi.mock('./path.js')
vi.mock('./output.js')
vi.mock('execa')

describe('ShopifyConfig', () => {
  let mockOptions: any

  beforeEach(() => {
    delete process.env.IGNORE_HYDROGEN_MONOREPO

    // Reset mockOptions for each test to avoid mutation issues
    mockOptions = {root: '/test/root', channel: 'stable'}

    // Default mocks
    vi.mocked(cwd).mockReturnValue('/test/current')
    vi.mocked(sniffForPath).mockReturnValue('/test/sniffed')
    vi.mocked(joinPath).mockImplementation((...paths) => paths.join('/'))
    vi.mocked(fileExistsSync).mockReturnValue(false)
    vi.mocked(outputDebug).mockImplementation(() => {})
  })

  describe('Hydrogen monorepo detection', () => {
    test('Given: User is in shopify/hydrogen path, When: Creating config, Then: Should use npm prefix for path', () => {
      // Given
      vi.mocked(cwd).mockReturnValue('/Users/dev/shopify/hydrogen/packages/cli')
      vi.mocked(execaSync).mockReturnValue({stdout: '/Users/dev/shopify/hydrogen'} as any)
      vi.mocked(fileExistsSync).mockReturnValue(false)

      // When
      const _config = new ShopifyConfig(mockOptions)

      // Then
      expect(execaSync).toHaveBeenCalledWith('npm', ['prefix'])
    })

    test('Given: User is in hydrogen/hydrogen path (CI), When: Creating config, Then: Should use npm prefix for path', () => {
      // Given
      vi.mocked(cwd).mockReturnValue('/home/runner/hydrogen/hydrogen/packages/cli')
      vi.mocked(execaSync).mockReturnValue({stdout: '/home/runner/hydrogen/hydrogen'} as any)
      vi.mocked(fileExistsSync).mockReturnValue(false)

      // When
      const _config = new ShopifyConfig(mockOptions)

      // Then
      expect(execaSync).toHaveBeenCalledWith('npm', ['prefix'])
    })

    test('Given: IGNORE_HYDROGEN_MONOREPO is set, When: In hydrogen monorepo, Then: Should not use npm prefix', () => {
      // Given
      process.env.IGNORE_HYDROGEN_MONOREPO = 'true'
      vi.mocked(cwd).mockReturnValue('/Users/dev/shopify/hydrogen/packages/cli')
      vi.mocked(fileExistsSync).mockReturnValue(false)

      // When
      const _config = new ShopifyConfig(mockOptions)

      // Then
      expect(execaSync).not.toHaveBeenCalled()
    })

    test('Given: npm prefix command returns empty/whitespace, When: Creating config, Then: Should handle gracefully', () => {
      // Given
      vi.mocked(cwd).mockReturnValue('/Users/dev/shopify/hydrogen/packages/cli')
      vi.mocked(execaSync).mockReturnValue({stdout: '   \n  '} as any)
      vi.mocked(fileExistsSync).mockReturnValue(false)

      // When
      const config = new ShopifyConfig(mockOptions)

      // Then - Should not crash and trim the whitespace
      expect(config).toBeDefined()
    })
  })

  describe('JSON validation error handling', () => {
    test('Given: package.json has malformed JSON (trailing commas), When: Creating config, Then: Should log debug warning and skip plugin loading', () => {
      // Given
      const malformedJSON = '{"name": "test", "version": "1.0.0",}'
      vi.mocked(fileExistsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(Buffer.from(malformedJSON))

      // When
      const config = new ShopifyConfig(mockOptions)

      // Then
      expect(outputDebug).toHaveBeenCalledWith(expect.stringContaining('Skipping Hydrogen plugin loading'))
      expect(outputDebug).toHaveBeenCalledWith(expect.stringContaining('invalid package.json'))
      expect(config.options.pluginAdditions).toBeUndefined()
    })

    test('Given: package.json has malformed JSON (missing quotes), When: Creating config, Then: Should handle gracefully', () => {
      // Given
      const malformedJSON = '{name: "test", version: "1.0.0"}'
      vi.mocked(fileExistsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(Buffer.from(malformedJSON))

      // When
      const config = new ShopifyConfig(mockOptions)

      // Then
      expect(outputDebug).toHaveBeenCalledWith(expect.stringContaining('Skipping Hydrogen plugin loading'))
      expect(config.options.pluginAdditions).toBeUndefined()
    })

    test('Given: package.json has malformed JSON (unclosed brackets), When: Creating config, Then: Should handle gracefully', () => {
      // Given
      const malformedJSON = '{"name": "test", "version": "1.0.0"'
      vi.mocked(fileExistsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(Buffer.from(malformedJSON))

      // When
      const config = new ShopifyConfig(mockOptions)

      // Then
      expect(outputDebug).toHaveBeenCalledWith(expect.stringContaining('Skipping Hydrogen plugin loading'))
      expect(config.options.pluginAdditions).toBeUndefined()
    })

    test('Given: package.json is valid JSON, When: Creating config, Then: Should load Hydrogen plugin', () => {
      // Given
      const validJSON = '{"name": "test", "version": "1.0.0"}'
      vi.mocked(fileExistsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(Buffer.from(validJSON))

      // When
      const config = new ShopifyConfig(mockOptions)

      // Then
      expect(outputDebug).not.toHaveBeenCalledWith(expect.stringContaining('Skipping Hydrogen plugin loading'))
      expect(config.options.pluginAdditions).toEqual({
        core: ['@shopify/cli-hydrogen'],
        path: '/test/sniffed',
      })
    })
  })

  describe('Package.json existence checks', () => {
    test('Given: package.json does not exist, When: Creating config, Then: Should not load plugin additions', () => {
      // Given
      vi.mocked(fileExistsSync).mockReturnValue(false)

      // When
      const _config = new ShopifyConfig(mockOptions)

      // Then
      expect(readFileSync).not.toHaveBeenCalled()
      expect(mockOptions.pluginAdditions).toBeUndefined()
    })

    test('Given: package.json exists at npm prefix path, When: Creating config, Then: Should check at correct path', () => {
      // Given
      vi.mocked(cwd).mockReturnValue('/Users/dev/shopify/hydrogen/packages/cli')
      vi.mocked(execaSync).mockReturnValue({stdout: '/Users/dev/shopify/hydrogen'} as any)
      vi.mocked(fileExistsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(Buffer.from('{"name": "test"}'))

      // When
      const _config = new ShopifyConfig(mockOptions)

      // Then
      expect(fileExistsSync).toHaveBeenCalledWith('/Users/dev/shopify/hydrogen/package.json')
      expect(readFileSync).toHaveBeenCalledWith('/Users/dev/shopify/hydrogen/package.json')
    })
  })

  describe('Normal (non-Hydrogen) project paths', () => {
    test('Given: Normal project path (not hydrogen), When: Creating config, Then: Should use sniffed path', () => {
      // Given
      vi.mocked(cwd).mockReturnValue('/Users/dev/my-project')
      vi.mocked(sniffForPath).mockReturnValue('/Users/dev/my-project')
      vi.mocked(fileExistsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(Buffer.from('{"name": "my-project"}'))

      // When
      const config = new ShopifyConfig(mockOptions)

      // Then
      expect(execaSync).not.toHaveBeenCalled()
      expect(config.options.pluginAdditions).toEqual({
        core: ['@shopify/cli-hydrogen'],
        path: '/Users/dev/my-project',
      })
    })

    test('Given: sniffForPath returns undefined, When: Creating config, Then: Should use current path', () => {
      // Given
      vi.mocked(cwd).mockReturnValue('/Users/dev/my-project')
      vi.mocked(sniffForPath).mockReturnValue(undefined)
      vi.mocked(fileExistsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(Buffer.from('{"name": "my-project"}'))

      // When
      const config = new ShopifyConfig(mockOptions)

      // Then
      expect(config.options.pluginAdditions).toEqual({
        core: ['@shopify/cli-hydrogen'],
        path: '/Users/dev/my-project',
      })
    })
  })

  describe('npm prefix command failure scenarios', () => {
    test('Given: npm prefix throws error, When: Creating config, Then: Should propagate error', () => {
      // Given
      vi.mocked(cwd).mockReturnValue('/Users/dev/shopify/hydrogen/packages/cli')
      vi.mocked(execaSync).mockImplementation(() => {
        throw new Error('npm command failed')
      })

      // When/Then
      expect(() => new ShopifyConfig(mockOptions)).toThrow('npm command failed')
    })
  })

  describe('customPriority method', () => {
    test('Given: External hydrogen plugin, When: Comparing with core plugin, Then: Hydrogen should have priority', async () => {
      // Given
      vi.mocked(fileExistsSync).mockReturnValue(false)

      const config = new ShopifyConfig(mockOptions)
      // Manually set pjson after construction for testing
      ;(config as any).pjson = {oclif: {plugins: ['@shopify/cli-hydrogen', '@shopify/app']}}

      const hydrogenCommand = {
        pluginAlias: '@shopify/cli-hydrogen',
        pluginType: 'user',
        id: 'hydrogen:init',
      } as any

      const coreCommand = {
        pluginAlias: '@shopify/app',
        pluginType: 'core',
        id: 'app:init',
      } as any

      // When
      const result = config.customPriority([coreCommand, hydrogenCommand])

      // Then
      expect(result).toBe(hydrogenCommand)
    })

    test('Given: Two core plugins, When: Comparing priority, Then: Should sort by pjson order', async () => {
      // Given
      vi.mocked(fileExistsSync).mockReturnValue(false)

      const config = new ShopifyConfig(mockOptions)
      // Manually set pjson after construction for testing
      ;(config as any).pjson = {oclif: {plugins: ['@shopify/app', '@shopify/theme']}}

      const appCommand = {
        pluginAlias: '@shopify/app',
        pluginType: 'core',
        id: 'app:init',
      } as any

      const themeCommand = {
        pluginAlias: '@shopify/theme',
        pluginType: 'core',
        id: 'theme:init',
      } as any

      // When
      const result = config.customPriority([themeCommand, appCommand])

      // Then
      expect(result).toBe(appCommand)
    })
  })
})
