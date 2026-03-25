import {AppLinkedInterface} from '../models/app/app.js'
import {stringifyMessage} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

export async function validateApp(app: AppLinkedInterface): Promise<void> {
  const errors = app.errors

  if (errors.isEmpty()) {
    renderSuccess({headline: 'App configuration is valid.'})
    return
  }

  const errorMessages = errors.toJSON().map((error) => stringifyMessage(error).trim())

  renderError({
    headline: 'Validation errors found.',
    body: errorMessages.join('\n\n'),
  })

  throw new AbortSilentError()
}
