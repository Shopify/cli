import {themeOpenJsonOutputSchema, type ThemeOpenResult} from './types.js'
import {themeComponent} from '../../utilities/theme-ui.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export function renderThemeOpenResult(result: ThemeOpenResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(themeOpenJsonOutputSchema.encode(result))
    return
  }

  renderInfo({
    body: [
      'Preview information for theme',
      ...themeComponent(result.theme),
      '\n\n',
      {
        list: {
          items: [
            {link: {label: 'Preview your theme', url: result.preview_url}},
            {link: {label: 'Customize your theme at the theme editor', url: result.editor_url}},
          ],
        },
      },
    ],
  })
}
