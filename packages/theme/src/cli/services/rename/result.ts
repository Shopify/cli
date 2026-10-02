import {themeRenameJsonOutputSchema, type ThemeRenameResult} from './types.js'
import {themeComponent} from '../../utilities/theme-ui.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export function renderThemeRenameResult(
  result: ThemeRenameResult,
  format: 'text' | 'json',
  environment?: string[],
): void {
  if (format === 'json') {
    outputResult(themeRenameJsonOutputSchema.encode(result.data))
    return
  }
  renderSuccess({
    body: [
      ...(environment ? [{subdued: `Environment: ${environment}\n\n`}] : []),
      'The theme',
      ...themeComponent(result.originalTheme),
      'was renamed to',
      `'${result.requestedName}'`,
    ],
  })
}
