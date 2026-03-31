import {AppLinkedInterface} from '../models/app/app.js'
import {formatConfigurationError} from '../models/app/loader.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

interface ValidateAppOptions {
  json: boolean
}

export async function validateApp(app: AppLinkedInterface, options: ValidateAppOptions = {json: false}): Promise<void> {
  const appErrors = app.errors

  if (!appErrors || appErrors.isEmpty()) {
    if (options.json) {
      outputResult(JSON.stringify({valid: true, issues: []}, null, 2))
      return
    }

    renderSuccess({headline: 'App configuration is valid.'})
    return
  }

  const errors = appErrors.getErrors()

  if (options.json) {
    const issues = errors.map(({file, message, path, code}) => ({file, message, path, code}))
    outputResult(JSON.stringify({valid: false, issues}, null, 2))
    throw new AbortSilentError()
  }

  renderError({
    headline: 'Validation errors found.',
    body: errors.map((err) => `• ${formatConfigurationError(err)}`).join('\n'),
  })

  throw new AbortSilentError()
}
