import {
  themeInfoJsonOutputSchema,
  type ThemeEnvironmentInfo,
  type ThemeInfoResult,
  type ThemeInfoThemeResult,
} from './types.js'
import {recordEvent} from '@shopify/cli-kit/node/analytics'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, type AlertCustomSection, type InlineToken} from '@shopify/cli-kit/node/ui'

type ThemeInfoOutputFormat = 'text' | 'json'

interface ThemeInfoPresentationOptions {
  environment?: string | string[]
  developmentTheme?: string
}

export function renderThemeInfoResult(
  result: ThemeInfoResult,
  format: ThemeInfoOutputFormat,
  options: ThemeInfoPresentationOptions = {},
): void {
  if (format === 'json') {
    outputResult(themeInfoJsonOutputSchema.encode(result))
    return
  }

  if ('theme' in result) {
    renderInfo(formatThemeInfo(result, options))
  } else {
    renderInfo({customSections: themeEnvironmentInfoSections(result, options)})
  }
}

function formatThemeInfo(output: ThemeInfoThemeResult, options: ThemeInfoPresentationOptions) {
  const tabularData = Object.entries(output.theme).map(([key, value]) => {
    if (key === 'editor_url' || key === 'preview_url') {
      const url = String(value)
      const label = key === 'editor_url' ? 'Open in Theme Editor' : 'Preview Theme'
      return [formatKey(key), {link: {url, label}}]
    }
    if (key === 'id') return [formatKey(key), `#${value}`]
    return [formatKey(key), `${value}`]
  })

  return {
    customSections: [
      ...(options.environment
        ? [
            {
              title: 'Theme information',
              body: [{subdued: `Environment name: ${options.environment}`}],
            },
          ]
        : []),
      {
        title: 'Theme Details',
        body: {tabularData, firstColumnSubdued: true},
      },
    ],
  }
}

function themeEnvironmentInfoSections(
  result: ThemeEnvironmentInfo,
  options: ThemeInfoPresentationOptions,
): AlertCustomSection[] {
  const developmentTheme = Object.hasOwn(options, 'developmentTheme')
    ? options.developmentTheme
    : result.development_theme_id
  recordEvent(`theme-command:info:dev-theme-loaded:${developmentTheme}`)

  return [
    tabularSection('Theme Configuration', [
      ['Store', result.store],
      ['Development Theme ID', developmentTheme ? `#${developmentTheme}` : {subdued: 'Not set'}],
    ]),
    tabularSection('Tooling and System', [
      ['Shopify CLI', result.cli_version],
      ['OS', result.os],
      ['Shell', result.shell],
      ['Node version', result.node_version],
    ]),
  ]
}

function tabularSection(title: string, data: InlineToken[][]): AlertCustomSection {
  return {
    title,
    body: {tabularData: data, firstColumnSubdued: true},
  }
}

function formatKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
