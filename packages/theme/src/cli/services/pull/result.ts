import {themePullJsonOutputSchema, type ThemePullResult} from './types.js'
import {ThemeEnvironmentResult} from '../json-output/schema.js'
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

export function renderThemePullEnvironmentResults(results: ThemeEnvironmentResult[]): void {
  const environments = results.map((entry) =>
    'error' in entry
      ? entry
      : {
          ...entry,
          result: entry.result ?? {status: 'skipped', reason: 'unsafe-directory'},
        },
  )
  outputResult(themePullJsonOutputSchema.encode({environments}))
}
