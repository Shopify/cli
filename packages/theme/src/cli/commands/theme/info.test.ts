import Info from './info.js'
import {themeEnvironmentInfoJSON, fetchDevInfo, fetchThemeInfo, formatThemeInfo} from '../../services/info.js'
import {describe, vi, expect, test} from 'vitest'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

vi.mock('../../services/info.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

const CommandConfig = new Config({root: __dirname})

const session = {
  token: 'test-token',
  storeFqdn: 'my-shop.myshopify.com',
}

describe('Info', () => {
  async function run(argv: string[]) {
    await CommandConfig.load()
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
    const info = new Info(['--store=my-shop.myshopify.com', '--password=test-password', ...argv], CommandConfig)
    await info.run()
  }

  describe('when theme or development flag is provided', () => {
    const mockThemeInfo = {
      theme: {
        id: 123,
        name: 'my theme',
        role: 'live',
        shop: 'my-shop.myshopify.com',
        preview_url: 'https://my-shop.myshopify.com/preview',
        editor_url: 'https://my-shop.myshopify.com/editor',
      },
    }

    test('outputs JSON when --json flag is passed', async () => {
      vi.mocked(fetchThemeInfo).mockResolvedValue(mockThemeInfo)

      await run(['--theme', '123', '--json'])

      expect(fetchThemeInfo).toHaveBeenCalled()
      expect(outputResult).toHaveBeenCalledWith(JSON.stringify(mockThemeInfo, null, 2))
      expect(renderInfo).not.toHaveBeenCalled()
    })

    test('renders formatted info when no --json flag is passed', async () => {
      const mockFormatted = {
        customSections: [{title: 'Theme Details', body: {tabularData: [], firstColumnSubdued: true}}],
      }
      vi.mocked(fetchThemeInfo).mockResolvedValue(mockThemeInfo)
      vi.mocked(formatThemeInfo).mockResolvedValue(mockFormatted)

      await run(['--theme', '123'])

      expect(fetchThemeInfo).toHaveBeenCalled()
      expect(formatThemeInfo).toHaveBeenCalled()
      expect(renderInfo).toHaveBeenCalled()
      expect(outputResult).not.toHaveBeenCalled()
    })

    test('throws error when theme is not found', async () => {
      vi.mocked(fetchThemeInfo).mockResolvedValue(undefined)

      await expect(run(['--theme', '999'])).rejects.toThrow()
    })
  })

  describe('when no theme or development flag is provided', () => {
    test('outputs JSON when --json flag is passed', async () => {
      const mockDevInfo = {
        store: 'my-shop.myshopify.com',
        development_theme_id: null,
        cli_version: '3.91.0',
        os: 'darwin-arm64',
        shell: '/bin/zsh',
        node_version: 'v23.6.1',
      }
      vi.mocked(themeEnvironmentInfoJSON).mockReturnValue(mockDevInfo)

      await run(['--json'])

      expect(themeEnvironmentInfoJSON).toHaveBeenCalled()
      expect(outputResult).toHaveBeenCalledWith(JSON.stringify(mockDevInfo, null, 2))
      expect(renderInfo).not.toHaveBeenCalled()
    })

    test('renders info when no --json flag is passed', async () => {
      const mockSections = [{title: 'Theme Configuration', body: {tabularData: [], firstColumnSubdued: true}}]
      vi.mocked(fetchDevInfo).mockResolvedValue(mockSections)

      await run([])

      expect(fetchDevInfo).toHaveBeenCalled()
      expect(renderInfo).toHaveBeenCalled()
      expect(outputResult).not.toHaveBeenCalled()
    })
  })
})
