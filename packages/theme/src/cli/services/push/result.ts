import {
  themePushJsonOutputSchema,
  themePushResultSchema,
  type ThemePushResult,
  type ThemePushJsonResult,
} from './types.js'
import {themeComponent} from '../../utilities/theme-ui.js'
import {PushFlags} from '../push.js'
import {runThemeCheck} from '../../commands/theme/check.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {cwd} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {recordError} from '@shopify/cli-kit/node/analytics'
import {Severity} from '@shopify/theme-check-node'

export function themePushJsonResult(result: ThemePushResult): ThemePushJsonResult {
  const {environment, theme, hasErrors, errors} = result
  return {
    environment,
    theme: {
      ...theme,
      ...(hasErrors
        ? {warning: `${environment ? `[${environment}] ` : ''}The theme '${theme.name}' was pushed with errors`}
        : {}),
      ...(Object.keys(errors).length > 0 ? {errors} : {}),
    },
  }
}

export function renderThemePushResult(result: ThemePushResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(themePushJsonOutputSchema.encode(themePushJsonResult(result)))
    return
  }

  const {environment, theme, hasErrors, published} = result
  const header = environment ? [{subdued: `Environment: ${environment}\n\n`}] : []
  const render = hasErrors ? renderWarning : renderSuccess
  if (published) {
    render({
      body: [
        ...header,
        hasErrors
          ? `Your theme was published with errors and is now live at https://${theme.shop}`
          : `Your theme is now live at https://${theme.shop}`,
      ],
    })
    return
  }

  render({
    body: [
      ...header,
      'The theme',
      ...themeComponent(theme),
      hasErrors ? 'was pushed with errors' : 'was pushed successfully.',
    ],
    nextSteps: [
      [{link: {label: 'View your theme', url: theme.preview_url}}],
      [{link: {label: 'Customize your theme at the theme editor', url: theme.editor_url}}],
    ],
  })
}

export async function checkThemeBeforePush(flags: PushFlags, legacyOutput = false): Promise<void> {
  if (!flags.strict) return
  const environment = flags.environment?.[0]
  const jsonFormat = legacyOutput ? 'json' : 'silent'
  const outputFormat = flags.json ? jsonFormat : 'text'
  const {offenses} = await runThemeCheck(flags.path ?? cwd(), outputFormat)
  if (flags.json && !legacyOutput) {
    for (const offense of offenses) {
      emitCommandEvent({
        type: 'diagnostic',
        level: ({[Severity.ERROR]: 'error', [Severity.WARNING]: 'warning', [Severity.INFO]: 'info'} as const)[
          offense.severity
        ],
        code: offense.check,
        message: `${environment ? `[${environment}] ` : ''}${offense.uri}: ${offense.message}`,
      })
    }
  }
  if (offenses.some((offense) => offense.severity === Severity.ERROR)) {
    throw recordError(
      new AbortError(
        `${environment ? `[${environment}] ` : ''}Theme check failed. Please fix the errors before pushing.`,
      ),
    )
  }
}

export function renderThemePushEnvironmentResults(results: {environment: string; result: unknown}[]): void {
  const output = results.flatMap(({environment, result}) =>
    result === undefined
      ? []
      : [{...themePushJsonResult({...themePushResultSchema.parse(result), environment}), environment}],
  )
  outputResult(themePushJsonOutputSchema.encode(output))
}
