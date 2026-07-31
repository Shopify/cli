import {runThemeCheck} from './theme-check.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {Severity, SourceCodeType, themeCheckRun, type Config, type Offense, type Theme} from '@shopify/theme-check-node'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/theme-check-node', async () => {
  const actual: typeof import('@shopify/theme-check-node') = await vi.importActual('@shopify/theme-check-node')
  return {...actual, themeCheckRun: vi.fn()}
})

describe('runThemeCheck', () => {
  test('renders snippets from the in-memory theme', async () => {
    await inTemporaryDirectory(async (directory) => {
      const uri = 'file:///file-that-does-not-exist.liquid'
      const theme: Theme = [
        {
          uri,
          type: SourceCodeType.LiquidHtml,
          source: 'Line1\nLine2\nLine3',
          ast: new Error('unparsed'),
        },
      ]
      const offenses: Offense[] = [
        {
          type: SourceCodeType.LiquidHtml,
          check: 'LiquidHTMLSyntaxError',
          message: 'Attempting to close HtmlElement',
          uri,
          severity: Severity.ERROR,
          start: {index: 0, line: 1, character: 0},
          end: {index: 10, line: 1, character: 10},
        },
      ]
      const config: Config = {
        context: 'app',
        settings: {},
        checks: [],
        rootUri: '',
      }
      vi.mocked(themeCheckRun).mockResolvedValue({offenses, theme, config})

      const result = await runThemeCheck(directory)

      expect(themeCheckRun).toHaveBeenCalledWith(directory, 'theme-check:theme-app-extension')
      expect(result).toContain('2  Line2')
    })
  })
})
