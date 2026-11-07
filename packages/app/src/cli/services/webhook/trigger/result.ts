import {appWebhookTriggerJsonOutputSchema, WebhookTriggerResult} from './types.js'
import {UserErrors} from '../request-sample.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult, outputSuccess, outputWarn} from '@shopify/cli-kit/node/output'

export function renderWebhookTriggerResult(result: WebhookTriggerResult, format: 'json' | 'text'): void {
  if (result.status === 'failed') {
    if (format === 'json') {
      const error = new AbortError(
        result.reason === 'sample-request' ? 'Webhook sample request failed.' : 'Localhost delivery failed',
      )
      if (result.reason === 'sample-request') {
        error.details = {userErrors: result.userErrors.map(({message, fields}) => ({message, fieldPath: fields}))}
      }
      throw error
    }
    outputWarn(
      result.reason === 'sample-request'
        ? `Request errors:\n${formatErrors(result.userErrors)}`
        : 'Localhost delivery failed',
    )
    return
  }

  if (format === 'json') {
    outputResult(appWebhookTriggerJsonOutputSchema.encode({status: result.status, delivery: result.delivery}))
  } else if (result.delivery.status === 'delivered') {
    outputSuccess('Localhost delivery sucessful')
  } else if (result.samplePayloadIsEmpty) {
    outputSuccess('Webhook has been enqueued for delivery')
  }
}

function formatErrors(errors: UserErrors[]): string {
  try {
    return errors
      .map((element) =>
        JSON.parse(element.message)
          .map((msg: string) => `  · ${msg}`)
          .join('\n'),
      )
      .join('\n')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    return JSON.stringify(errors)
  }
}
