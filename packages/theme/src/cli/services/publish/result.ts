import {themePublishJsonOutputSchema, type ThemePublishResult} from './types.js'
import {themeComponent} from '../../utilities/theme-ui.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export function renderThemePublishResult(
  result: ThemePublishResult,
  format: 'text' | 'json',
  environment?: string[],
): void {
  if (format === 'json') {
    outputResult(themePublishJsonOutputSchema.encode(result.data))
    return
  }
  renderSuccess({
    headline: environment ? `Environment: ${environment}` : undefined,
    body: [
      'The theme',
      ...themeComponent(result.originalTheme),
      'is now live at',
      {link: {label: result.previewUrl, url: result.previewUrl}},
      {char: '.'},
    ],
  })
}
