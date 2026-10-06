import {themeDeleteJsonOutputSchema, type ThemeDeleteResult} from './types.js'
import {themeComponent, themesComponent} from '../../utilities/theme-ui.js'
import {pluralize} from '@shopify/cli-kit/common/string'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export function renderThemeDeleteResult(
  result: ThemeDeleteResult,
  format: 'text' | 'json',
  context: {store: string; environment?: string[]},
): void {
  if (format === 'json') {
    outputResult(themeDeleteJsonOutputSchema.encode(result))
    return
  }
  const environment = context.environment ? [{subdued: `Environment: ${context.environment}\n\n`}] : []
  const render = result.status === 'partial' ? renderWarning : renderSuccess
  render({
    body: pluralize(
      result.themes,
      (themes) => [...environment, `The following themes were deleted from ${context.store}:`, themesComponent(themes)],
      (theme) => [...environment, 'The theme', ...themeComponent(theme), `was deleted from ${context.store}.`],
    ),
    ...(result.errors ? {nextSteps: result.errors.map((error) => [`Theme #${error.themeId}: ${error.message}`])} : {}),
  })
}
