import {AppLinkedInterface} from '../models/app/app.js'
import {formatConfigurationError} from '../models/app/loader.js'
import metadata from '../metadata.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

interface ValidateAppOptions {
  json: boolean
}

async function recordValidationMetadata(valid: boolean, errors: {file: string}[]) {
  const fileCount = new Set(errors.map((error) => error.file)).size

  await metadata.addPublicMetadata(() => ({
    cmd_app_validate_valid: valid,
    cmd_app_validate_issue_count: errors.length,
    cmd_app_validate_file_count: fileCount,
  }))
}

export async function validateApp(app: AppLinkedInterface, options: ValidateAppOptions = {json: false}): Promise<void> {
  const appErrors = app.errors

  if (!appErrors || appErrors.isEmpty()) {
    await recordValidationMetadata(true, [])

    if (options.json) {
      outputResult(JSON.stringify({valid: true, issues: []}, null, 2))
      return
    }

    renderSuccess({headline: 'App configuration is valid.'})
    return
  }

  const errors = appErrors.getErrors()
  await recordValidationMetadata(false, errors)

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
