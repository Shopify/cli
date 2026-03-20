import {AppLinkedInterface} from '../models/app/app.js'
import {outputResult, stringifyMessage} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

interface ValidateAppOptions {
  json: boolean
}

export async function validateApp(app: AppLinkedInterface, options: ValidateAppOptions = {json: false}): Promise<void> {
  const errors = app.errors

  if (!errors || errors.isEmpty()) {
    if (options.json) {
      outputResult(JSON.stringify({valid: true, errors: []}, null, 2))
      return
    }

    renderSuccess({headline: 'App configuration is valid.'})
    return
  }

  const errorMessages = errors.toJSON().map((error) => stringifyMessage(error).trim())

  if (options.json) {
    outputResult(JSON.stringify({valid: false, errors: errorMessages}, null, 2))
    throw new AbortSilentError()
  }

  renderError({
    headline: 'Validation errors found.',
    body: errorMessages.join('\n\n'),
  })

  throw new AbortSilentError()
}
