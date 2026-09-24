import {themePullJsonOutputSchema, themePullResultSchema, type ThemePullResult} from './types.js'
import {themeComponent} from '../../utilities/theme-ui.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export function renderThemePullResult(result: ThemePullResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(themePullJsonOutputSchema.encode(result))
    return
  }
  const {environment, theme} = result
  renderSuccess({
    headline: environment ? `Environment: ${environment}` : '',
    body: ['The theme', ...themeComponent(theme), 'has been pulled.'],
    nextSteps: [
      [{link: {label: 'View your theme', url: theme.preview_url}}],
      [{link: {label: 'Customize your theme at the theme editor', url: theme.editor_url}}],
    ],
  })
}

export function renderThemePullEnvironmentResults(results: {environment: string; result: unknown}[]): void {
  const output = results.flatMap(({environment, result}) =>
    result === undefined ? [] : [{...themePullResultSchema.parse(result), environment}],
  )
  outputResult(themePullJsonOutputSchema.encode(output))
}
