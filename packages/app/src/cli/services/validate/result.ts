import {appConfigValidateJsonOutputSchema, type AppConfigValidateResult} from './types.js'
import {formatConfigurationError} from '../../models/app/loader.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {basename} from '@shopify/cli-kit/node/path'

export function renderAppConfigValidateResult(
  result: AppConfigValidateResult,
  configPath: string,
  format: 'json' | 'text',
): void {
  if (format === 'json') {
    outputResult(appConfigValidateJsonOutputSchema.encode(result))
  } else if (result.valid) {
    renderSuccess({headline: `App configuration '${basename(configPath)}' is valid.`})
  } else {
    renderError({
      headline: 'Validation errors found.',
      // Issues produced by early command failure paths carry no file; fall back to the validated config path.
      body: result.issues
        .map((issue) => `• ${formatConfigurationError({...issue, file: issue.file ?? configPath})}`)
        .join('\n'),
    })
  }
}
